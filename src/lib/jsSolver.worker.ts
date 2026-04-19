/**
 * jsSolver.worker.ts
 * ブラウザ内で動作する時間割自動生成ソルバー（Web Worker）
 * 2フェーズ解法: 改善貪欲法（25%）+ 焼きなまし局所探索（75%）
 */

import { DAYS, PERIODS } from "@/constants";
import type {
  CrossGradeGroup,
  DayOfWeek,
  Period,
  SolverInput,
  SubjectPairing,
  SubjectPlacement,
  Teacher,
  TeacherConstraintSettings,
  TeacherGroup,
  TimetableEntry,
} from "@/types";

// ── 型定義 ────────────────────────────────────────────────────────────

interface ClassInfo {
  grade: number;
  class_name: string;
  isSpecial: boolean;
}

interface TeacherUsageState {
  slots: Set<string>; // `${id}|${day}|${period}`
  daily: Map<string, number>; // `${id}|${day}` → count
  weekly: Map<string, number>; // `${id}` → count
}

type FacilityUsage = Set<string>; // `${facilityId}|${day}|${period}`

interface TryOnceParams {
  classes: ClassInfo[];
  classRequiredSlots: Record<string, string[]>;
  teachers: Teacher[];
  teacherGroups: TeacherGroup[];
  fixedSlotKeys: Set<string>;
  fixedEntries: TimetableEntry[];
  subjectPlacement: Record<string, SubjectPlacement>;
  lunchAfterPeriod: number;
  crossGradeGroups: CrossGradeGroup[];
  subjectPairings: SubjectPairing[];
  altTasks: AltTask[];
  classGroupTasks: ClassGroupTask[];
  sequenceTasks: SequenceTask[];
  teacherConstraints: Record<string, TeacherConstraintSettings>;
  subjectFacility: Record<string, string | null>;
}

interface AltTask {
  grade: number;
  class_name: string;
  isSpecial: boolean;
  subject_a: string;
  subject_b: string;
}

interface ClassGroupTask {
  grade: number;
  classNames: string[];
  subject: string;
}

interface SequenceTask {
  grade: number;
  class_name: string;
  isSpecial: boolean;
  subject_a: string;
  subject_b: string;
}

interface TryOnceResult {
  entries: TimetableEntry[];
  placed_count: number;
  required_count: number;
}

// ── ユーティリティ ────────────────────────────────────────────────────

function shuffle<T>(arr: T[] | readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 教員使用状況管理 ──────────────────────────────────────────────────

function makeUsage(): TeacherUsageState {
  return { slots: new Set(), daily: new Map(), weekly: new Map() };
}

function markTeacher(
  u: TeacherUsageState,
  id: string,
  day: DayOfWeek,
  period: Period,
): void {
  u.slots.add(`${id}|${day}|${period}`);
  const dk = `${id}|${day}`;
  u.daily.set(dk, (u.daily.get(dk) ?? 0) + 1);
  u.weekly.set(id, (u.weekly.get(id) ?? 0) + 1);
}

function unmarkTeacher(
  u: TeacherUsageState,
  id: string,
  day: DayOfWeek,
  period: Period,
): void {
  u.slots.delete(`${id}|${day}|${period}`);
  const dk = `${id}|${day}`;
  u.daily.set(dk, Math.max(0, (u.daily.get(dk) ?? 1) - 1));
  u.weekly.set(id, Math.max(0, (u.weekly.get(id) ?? 1) - 1));
}

function calcConsecutiveAfterPlace(
  slots: Set<string>,
  id: string,
  day: DayOfWeek,
  period: Period,
): number {
  let run = 1;
  for (let p = (period as number) - 1; p >= 1; p--) {
    if (slots.has(`${id}|${day}|${p}`)) run++;
    else break;
  }
  for (let p = (period as number) + 1; p <= 6; p++) {
    if (slots.has(`${id}|${day}|${p}`)) run++;
    else break;
  }
  return run;
}

// ── 教員または教員グループを探す ──────────────────────────────────────

function findTeacherOrGroup(
  grade: number,
  isSpecial: boolean,
  subject: string,
  day: DayOfWeek,
  period: Period,
  teachers: Teacher[],
  teacherGroups: TeacherGroup[],
  usage: TeacherUsageState,
  teacherConstraints: Record<string, TeacherConstraintSettings> = {},
  groupSubjects?: Set<string>,
): {
  teacher_id: string | null;
  teacher_group_id: string | null;
  usageKey: string;
} | null {
  // 教員グループに登録されている教科はグループを優先
  const isGroupSubject = groupSubjects?.has(subject) ?? false;

  if (!isGroupSubject) {
    for (const t of teachers) {
      const isTokkiShien = t.subjects.includes("特別支援");
      if (isTokkiShien && !isSpecial) continue;
      if (!isTokkiShien && !t.subjects.includes(subject)) continue;
      if (!t.target_grades.includes(grade)) continue;
      if (
        t.unavailable_times?.some(
          (u) => u.day_of_week === day && u.period === period,
        )
      )
        continue;
      if (usage.slots.has(`${t.id}|${day}|${period}`)) continue;
      const c = teacherConstraints[t.id];
      if (c) {
        if (
          c.max_weekly != null &&
          (usage.weekly.get(t.id) ?? 0) >= c.max_weekly
        )
          continue;
        if (
          c.max_daily != null &&
          (usage.daily.get(`${t.id}|${day}`) ?? 0) >= c.max_daily
        )
          continue;
        if (
          c.max_consecutive != null &&
          calcConsecutiveAfterPlace(usage.slots, t.id, day, period) >
            c.max_consecutive
        )
          continue;
      }
      return { teacher_id: t.id, teacher_group_id: null, usageKey: t.id };
    }
  }

  for (const g of teacherGroups || []) {
    const gSubjects = g.subjects || [];
    const gGrades = g.target_grades || [];
    if (gSubjects.length === 0 || !gSubjects.includes(subject)) continue;
    if (gGrades.length > 0 && !gGrades.includes(grade)) continue;
    // 教員グループの配置不可時間チェック（グループに属する全教員をチェック）
    const groupMembersUnavailable = teachers
      .filter((t) => g.teacher_ids?.includes(t.id))
      .some((t) =>
        t.unavailable_times?.some(
          (u) => u.day_of_week === day && u.period === period,
        ),
      );
    if (groupMembersUnavailable) continue;
    if (usage.slots.has(`${g.id}|${day}|${period}`)) continue;
    return { teacher_id: null, teacher_group_id: g.id, usageKey: g.id };
  }

  // グループ教科でグループが見つからなかった場合は個別教員にフォールバック
  if (isGroupSubject) {
    for (const t of teachers) {
      const isTokkiShien = t.subjects.includes("特別支援");
      if (isTokkiShien && !isSpecial) continue;
      if (!isTokkiShien && !t.subjects.includes(subject)) continue;
      if (!t.target_grades.includes(grade)) continue;
      if (
        t.unavailable_times?.some(
          (u) => u.day_of_week === day && u.period === period,
        )
      )
        continue;
      if (usage.slots.has(`${t.id}|${day}|${period}`)) continue;
      const c = teacherConstraints[t.id];
      if (c) {
        if (
          c.max_weekly != null &&
          (usage.weekly.get(t.id) ?? 0) >= c.max_weekly
        )
          continue;
        if (
          c.max_daily != null &&
          (usage.daily.get(`${t.id}|${day}`) ?? 0) >= c.max_daily
        )
          continue;
        if (
          c.max_consecutive != null &&
          calcConsecutiveAfterPlace(usage.slots, t.id, day, period) >
            c.max_consecutive
        )
          continue;
      }
      return { teacher_id: t.id, teacher_group_id: null, usageKey: t.id };
    }
  }

  return null;
}

// ── 1回の試行 ─────────────────────────────────────────────────────────

function tryOnce({
  classes,
  classRequiredSlots,
  teachers,
  teacherGroups,
  fixedSlotKeys,
  fixedEntries,
  subjectPlacement,
  lunchAfterPeriod,
  crossGradeGroups,
  subjectPairings,
  altTasks,
  classGroupTasks,
  sequenceTasks,
  teacherConstraints,
  subjectFacility,
}: TryOnceParams): TryOnceResult {
  const placed = new Map<string, TimetableEntry>();
  const usage = makeUsage();
  const facilityUsage: FacilityUsage = new Set();
  let placed_count = 0;
  let required_count = 0;

  // 教員グループに登録されている教科の集合（優先配置用）
  const groupSubjects = new Set<string>(
    (teacherGroups || []).flatMap((g) => g.subjects || []),
  );

  const markFacility = (subject: string, day: DayOfWeek, period: Period) => {
    const fid = subjectFacility[subject];
    if (fid) facilityUsage.add(`${fid}|${day}|${period}`);
  };

  for (const entry of fixedEntries) {
    const key = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
    placed.set(key, entry);
    if (entry.teacher_id)
      markTeacher(usage, entry.teacher_id, entry.day_of_week, entry.period);
    markFacility(entry.subject, entry.day_of_week, entry.period);
  }

  const slotOk = (
    grade: number,
    className: string,
    subject: string,
    day: DayOfWeek,
    period: Period,
  ) => {
    const cellKey = `${grade}|${className}|${day}|${period}`;
    if (placed.has(cellKey) || fixedSlotKeys.has(cellKey)) return false;
    const sp = subjectPlacement?.[subject];
    if (sp?.allowed_days?.length && !sp.allowed_days.includes(day))
      return false;
    if (sp?.allowed_periods?.length && !sp.allowed_periods.includes(period))
      return false;
    const maxDaily = sp?.max_daily ?? 1;
    let dailyCnt = 0;
    for (const e of placed.values()) {
      if (
        e.grade === grade &&
        e.class_name === className &&
        e.day_of_week === day &&
        e.subject === subject
      )
        dailyCnt++;
    }
    if (dailyCnt >= maxDaily) return false;
    if (sp?.max_afternoon_daily != null && period > lunchAfterPeriod) {
      let afternoonCnt = 0;
      for (const e of placed.values()) {
        if (
          e.grade === grade &&
          e.class_name === className &&
          e.day_of_week === day &&
          e.period > lunchAfterPeriod &&
          e.subject === subject
        )
          afternoonCnt++;
      }
      if (afternoonCnt >= sp.max_afternoon_daily) return false;
    }
    const facilityId = subjectFacility[subject];
    if (facilityId && facilityUsage.has(`${facilityId}|${day}|${period}`))
      return false;
    return true;
  };

  // 1. 学年横断合同授業
  for (const grp of crossGradeGroups) {
    if (!grp.subject || !grp.participants || grp.participants.length < 2)
      continue;
    const count = grp.count || 1;
    for (let i = 0; i < count; i++) {
      required_count += grp.participants.length;
      const slots = shuffle(
        DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
      );
      for (const { day, period } of slots) {
        if (
          !grp.participants.every((p) =>
            slotOk(p.grade, p.class_name, grp.subject, day, period),
          )
        )
          continue;
        const gradeSet = new Set(grp.participants.map((p) => p.grade));
        let assignment: {
          teacher_id: string | null;
          teacher_group_id: string | null;
          usageKey: string;
        } | null = null;
        for (const t of teachers) {
          if (!t.subjects.includes(grp.subject)) continue;
          if (
            t.unavailable_times?.some(
              (u) => u.day_of_week === day && u.period === period,
            )
          )
            continue;
          if (usage.slots.has(`${t.id}|${day}|${period}`)) continue;
          if (![...gradeSet].some((g) => t.target_grades.includes(g))) continue;
          const c = teacherConstraints[t.id];
          if (
            c?.max_daily != null &&
            (usage.daily.get(`${t.id}|${day}`) ?? 0) >= c.max_daily
          )
            continue;
          if (
            c?.max_weekly != null &&
            (usage.weekly.get(t.id) ?? 0) >= c.max_weekly
          )
            continue;
          assignment = {
            teacher_id: t.id,
            teacher_group_id: null,
            usageKey: t.id,
          };
          break;
        }
        if (!assignment) {
          for (const g of teacherGroups || []) {
            if (!g.subjects?.includes(grp.subject)) continue;
            if (
              g.target_grades?.length &&
              ![...gradeSet].some((gr) => g.target_grades?.includes(gr))
            )
              continue;
            const groupUnavail = teachers
              .filter((t) => g.teacher_ids?.includes(t.id))
              .some((t) =>
                t.unavailable_times?.some(
                  (u) => u.day_of_week === day && u.period === period,
                ),
              );
            if (groupUnavail) continue;
            if (usage.slots.has(`${g.id}|${day}|${period}`)) continue;
            assignment = {
              teacher_id: null,
              teacher_group_id: g.id,
              usageKey: g.id,
            };
            break;
          }
        }
        if (!assignment) continue;
        for (const p of grp.participants) {
          placed.set(`${p.grade}|${p.class_name}|${day}|${period}`, {
            day_of_week: day,
            period,
            grade: p.grade,
            class_name: p.class_name,
            subject: grp.subject,
            teacher_id: assignment.teacher_id,
            teacher_group_id: assignment.teacher_group_id,
          });
          placed_count++;
        }
        markTeacher(usage, assignment.usageKey, day, period);
        markFacility(grp.subject, day, period);
        break;
      }
    }
  }

  // 2. 合同クラス
  for (const { grade, classNames, subject } of shuffle(classGroupTasks)) {
    required_count += classNames.length;
    const candidateSlots = shuffle(
      DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
    );
    for (const { day, period } of candidateSlots) {
      if (!classNames.every((cn) => slotOk(grade, cn, subject, day, period)))
        continue;
      const assignment = findTeacherOrGroup(
        grade,
        false,
        subject,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignment) continue;
      for (const cn of classNames) {
        placed.set(`${grade}|${cn}|${day}|${period}`, {
          day_of_week: day,
          period,
          grade,
          class_name: cn,
          subject,
          teacher_id: assignment.teacher_id,
          teacher_group_id: assignment.teacher_group_id,
        });
        placed_count++;
      }
      markTeacher(usage, assignment.usageKey, day, period);
      markFacility(subject, day, period);
      break;
    }
  }

  // 3. 連続配置
  for (const { grade, class_name, isSpecial, subject_a, subject_b } of shuffle(
    sequenceTasks,
  )) {
    required_count += 2;
    const candidateSlots = shuffle(
      DAYS.flatMap((day) =>
        PERIODS.slice(0, -1).map((period) => ({ day, period })),
      ),
    );
    for (const { day, period } of candidateSlots) {
      const periodB = (period + 1) as Period;
      if (!slotOk(grade, class_name, subject_a, day, period)) continue;
      if (!slotOk(grade, class_name, subject_b, day, periodB)) continue;
      const assignA = findTeacherOrGroup(
        grade,
        isSpecial,
        subject_a,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignA) continue;
      markTeacher(usage, assignA.usageKey, day, period);
      const assignB = findTeacherOrGroup(
        grade,
        isSpecial,
        subject_b,
        day,
        periodB,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignB) {
        unmarkTeacher(usage, assignA.usageKey, day, period);
        continue;
      }
      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name,
        subject: subject_a,
        teacher_id: assignA.teacher_id,
        teacher_group_id: assignA.teacher_group_id,
      });
      placed.set(`${grade}|${class_name}|${day}|${periodB}`, {
        day_of_week: day,
        period: periodB,
        grade,
        class_name,
        subject: subject_b,
        teacher_id: assignB.teacher_id,
        teacher_group_id: assignB.teacher_group_id,
      });
      markTeacher(usage, assignB.usageKey, day, periodB);
      markFacility(subject_a, day, period);
      markFacility(subject_b, day, periodB);
      placed_count += 2;
      break;
    }
  }

  // 4. 隔週授業
  for (const { grade, class_name, isSpecial, subject_a, subject_b } of shuffle(
    altTasks,
  )) {
    required_count++;
    const candidateSlots = shuffle(
      DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
    );
    for (const { day, period } of candidateSlots) {
      if (!slotOk(grade, class_name, subject_a, day, period)) continue;
      const assignment = findTeacherOrGroup(
        grade,
        isSpecial,
        subject_a,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignment) continue;
      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name,
        subject: subject_a,
        alt_subject: subject_b,
        teacher_id: assignment.teacher_id,
        teacher_group_id: assignment.teacher_group_id,
      });
      markTeacher(usage, assignment.usageKey, day, period);
      markFacility(subject_a, day, period);
      placed_count++;
      break;
    }
  }

  // 5. 抱き合わせ + 単体タスクの準備
  const remainingSlots: Record<string, string[]> = {};
  for (const cls of classes) {
    const key = `${cls.grade}|${cls.class_name}`;
    remainingSlots[key] = [...(classRequiredSlots[key] || [])];
    required_count += remainingSlots[key].length;
  }

  const pairTasks: {
    grade: number;
    clsA: ClassInfo;
    clsB: ClassInfo;
    subjectA: string;
    subjectB: string;
  }[] = [];
  for (const pairing of subjectPairings || []) {
    const { grade, classA, subjectA, classB, subjectB } = pairing;
    const keyA = `${grade}|${classA}`;
    const keyB = `${grade}|${classB}`;
    const clsA = classes.find(
      (c) => c.grade === grade && c.class_name === classA,
    );
    const clsB = classes.find(
      (c) => c.grade === grade && c.class_name === classB,
    );
    if (!clsA || !clsB) continue;
    while (true) {
      const idxA = remainingSlots[keyA]?.indexOf(subjectA) ?? -1;
      const idxB = remainingSlots[keyB]?.indexOf(subjectB) ?? -1;
      if (idxA < 0 || idxB < 0) break;
      remainingSlots[keyA].splice(idxA, 1);
      remainingSlots[keyB].splice(idxB, 1);
      pairTasks.push({ grade, clsA, clsB, subjectA, subjectB });
    }
  }

  // requires_double な教科を連続ペアとして分離
  const doubleTasks: SequenceTask[] = [];
  const soloTasks: {
    grade: number;
    className: string;
    subject: string;
    isSpecial: boolean;
  }[] = [];
  for (const cls of classes) {
    const key = `${cls.grade}|${cls.class_name}`;
    const subjs = remainingSlots[key] || [];
    const dblCount: Record<string, number> = {};
    const regular: string[] = [];
    for (const s of subjs) {
      if (subjectPlacement[s]?.requires_double)
        dblCount[s] = (dblCount[s] ?? 0) + 1;
      else regular.push(s);
    }
    for (const [s, cnt] of Object.entries(dblCount)) {
      const pairs = Math.floor(cnt / 2);
      for (let i = 0; i < pairs; i++)
        doubleTasks.push({
          grade: cls.grade,
          class_name: cls.class_name,
          isSpecial: cls.isSpecial,
          subject_a: s,
          subject_b: s,
        });
      for (let i = 0; i < cnt % 2; i++) regular.push(s);
    }
    for (const s of regular)
      soloTasks.push({
        grade: cls.grade,
        className: cls.class_name,
        subject: s,
        isSpecial: cls.isSpecial,
      });
  }

  // requires_double タスクを連続配置として処理
  for (const { grade, class_name, isSpecial, subject_a, subject_b } of shuffle(
    doubleTasks,
  )) {
    required_count += 2;
    const candidateSlots = shuffle(
      DAYS.flatMap((day) =>
        PERIODS.slice(0, -1).map((period) => ({ day, period })),
      ),
    );
    for (const { day, period } of candidateSlots) {
      const periodB = (period + 1) as Period;
      if (!slotOk(grade, class_name, subject_a, day, period)) continue;
      if (!slotOk(grade, class_name, subject_b, day, periodB)) continue;
      const assignA = findTeacherOrGroup(
        grade,
        isSpecial,
        subject_a,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignA) continue;
      markTeacher(usage, assignA.usageKey, day, period);
      const assignB = findTeacherOrGroup(
        grade,
        isSpecial,
        subject_b,
        day,
        periodB,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignB) {
        unmarkTeacher(usage, assignA.usageKey, day, period);
        continue;
      }
      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name,
        subject: subject_a,
        teacher_id: assignA.teacher_id,
        teacher_group_id: assignA.teacher_group_id,
      });
      placed.set(`${grade}|${class_name}|${day}|${periodB}`, {
        day_of_week: day,
        period: periodB,
        grade,
        class_name,
        subject: subject_b,
        teacher_id: assignB.teacher_id,
        teacher_group_id: assignB.teacher_group_id,
      });
      markTeacher(usage, assignB.usageKey, day, periodB);
      markFacility(subject_a, day, period);
      markFacility(subject_b, day, periodB);
      placed_count += 2;
      break;
    }
  }

  for (const { grade, clsA, clsB, subjectA, subjectB } of shuffle(pairTasks)) {
    const candidateSlots = shuffle(
      DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
    );
    for (const { day, period } of candidateSlots) {
      if (!slotOk(grade, clsA.class_name, subjectA, day, period)) continue;
      if (!slotOk(grade, clsB.class_name, subjectB, day, period)) continue;
      const assignA = findTeacherOrGroup(
        grade,
        clsA.isSpecial,
        subjectA,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignA) continue;
      markTeacher(usage, assignA.usageKey, day, period);
      const assignB = findTeacherOrGroup(
        grade,
        clsB.isSpecial,
        subjectB,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignB) {
        unmarkTeacher(usage, assignA.usageKey, day, period);
        continue;
      }
      placed.set(`${grade}|${clsA.class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name: clsA.class_name,
        subject: subjectA,
        teacher_id: assignA.teacher_id,
        teacher_group_id: assignA.teacher_group_id,
      });
      placed.set(`${grade}|${clsB.class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name: clsB.class_name,
        subject: subjectB,
        teacher_id: assignB.teacher_id,
        teacher_group_id: assignB.teacher_group_id,
      });
      markTeacher(usage, assignB.usageKey, day, period);
      markFacility(subjectA, day, period);
      markFacility(subjectB, day, period);
      placed_count += 2;
      break;
    }
  }

  // 6. 単体タスク
  for (const { grade, className, subject, isSpecial } of shuffle(soloTasks)) {
    const candidateSlots = shuffle(
      DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
    );
    for (const { day, period } of candidateSlots) {
      if (!slotOk(grade, className, subject, day, period)) continue;
      const assignment = findTeacherOrGroup(
        grade,
        isSpecial,
        subject,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (!assignment) continue;
      placed.set(`${grade}|${className}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name: className,
        subject,
        teacher_id: assignment.teacher_id,
        teacher_group_id: assignment.teacher_group_id,
      });
      markTeacher(usage, assignment.usageKey, day, period);
      markFacility(subject, day, period);
      placed_count++;
      break;
    }
  }

  return { entries: [...placed.values()], placed_count, required_count };
}

// ── スコア計算（違反ペナルティ込み） ──────────────────────────────────

function calcDetailedScore(
  result: TryOnceResult,
  teacherConstraints: Record<string, TeacherConstraintSettings>,
  subjectFacility: Record<string, string | null>,
  subjectPlacement: Record<string, SubjectPlacement>,
): number {
  const { placed_count, required_count, entries } = result;
  const placeRate = required_count > 0 ? placed_count / required_count : 1;
  const withTeacher = entries.filter(
    (e) => e.teacher_id || e.teacher_group_id,
  ).length;
  const teachRate = entries.length > 0 ? withTeacher / entries.length : 1;
  let score = placeRate * 200 + teachRate * 100;

  // 教員時間重複 (-50/件)
  const teacherSlots = new Map<string, number>();
  for (const e of entries) {
    if (!e.teacher_id) continue;
    const k = `${e.teacher_id}|${e.day_of_week}|${e.period}`;
    teacherSlots.set(k, (teacherSlots.get(k) ?? 0) + 1);
  }
  for (const cnt of teacherSlots.values()) {
    if (cnt > 1) score -= (cnt - 1) * 50;
  }

  // 施設競合 (-30/件)
  const facSlots = new Map<string, number>();
  for (const e of entries) {
    const fid = subjectFacility[e.subject];
    if (!fid) continue;
    const k = `${fid}|${e.day_of_week}|${e.period}`;
    facSlots.set(k, (facSlots.get(k) ?? 0) + 1);
  }
  for (const cnt of facSlots.values()) {
    if (cnt > 1) score -= (cnt - 1) * 30;
  }

  // 教員日・週コマ数超過 (-10/件)
  const teacherDaily = new Map<string, number>();
  const teacherWeekly = new Map<string, number>();
  for (const e of entries) {
    if (!e.teacher_id) continue;
    const dk = `${e.teacher_id}|${e.day_of_week}`;
    teacherDaily.set(dk, (teacherDaily.get(dk) ?? 0) + 1);
    teacherWeekly.set(e.teacher_id, (teacherWeekly.get(e.teacher_id) ?? 0) + 1);
  }
  for (const [key, cnt] of teacherDaily) {
    const tid = key.split("|")[0];
    const limit = teacherConstraints[tid]?.max_daily;
    if (limit != null && cnt > limit) score -= (cnt - limit) * 10;
  }
  for (const [tid, cnt] of teacherWeekly) {
    const limit = teacherConstraints[tid]?.max_weekly;
    if (limit != null && cnt > limit) score -= (cnt - limit) * 10;
  }

  // requires_double 未達 (-20/件)
  const doubleCounts = new Map<string, number>();
  for (const e of entries) {
    if (!subjectPlacement[e.subject]?.requires_double) continue;
    const k = `${e.grade}|${e.class_name}|${e.day_of_week}|${e.subject}`;
    doubleCounts.set(k, (doubleCounts.get(k) ?? 0) + 1);
  }
  for (const cnt of doubleCounts.values()) {
    if (cnt % 2 !== 0) score -= 20;
  }

  return score;
}

// ── 焼きなまし局所探索 ──────────────────────────────────────────────────

function localSearch(
  initialResult: TryOnceResult,
  params: TryOnceParams,
  endTimeMs: number,
  onImprove: (saAttempts: number) => void,
): TryOnceResult {
  if (initialResult.entries.length === 0) return initialResult;

  const {
    fixedSlotKeys,
    teachers,
    teacherGroups,
    teacherConstraints,
    subjectFacility,
    subjectPlacement,
    lunchAfterPeriod,
  } = params;

  const placed = new Map<string, TimetableEntry>();
  for (const e of initialResult.entries) {
    placed.set(`${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}`, e);
  }

  const groupSubjects = new Set<string>(
    (teacherGroups || []).flatMap((g) => g.subjects || []),
  );

  const usage = makeUsage();
  const facilityUsage: FacilityUsage = new Set();
  for (const e of placed.values()) {
    if (e.teacher_id) markTeacher(usage, e.teacher_id, e.day_of_week, e.period);
    const fid = subjectFacility[e.subject];
    if (fid) facilityUsage.add(`${fid}|${e.day_of_week}|${e.period}`);
  }

  const toResult = (): TryOnceResult => ({
    entries: [...placed.values()],
    placed_count: initialResult.placed_count,
    required_count: initialResult.required_count,
  });

  let currentScore = calcDetailedScore(
    toResult(),
    teacherConstraints,
    subjectFacility,
    subjectPlacement,
  );
  let bestScore = currentScore;
  let bestEntries = [...placed.values()];

  const startMs = Date.now();
  const duration = endTimeMs - startMs;
  if (duration <= 0) return initialResult;

  const T0 = 20.0;
  const Tmin = 0.1;
  let saAttempts = 0;
  const allSlots = DAYS.flatMap((day) =>
    PERIODS.map((period) => ({ day, period })),
  );

  while (Date.now() < endTimeMs) {
    saAttempts++;
    const progress = Math.min(1, (Date.now() - startMs) / duration);
    const T = T0 * (Tmin / T0) ** progress;

    const allKeys = [...placed.keys()];
    const movableKeys = allKeys.filter((k) => !fixedSlotKeys.has(k));
    if (movableKeys.length < 2) break;

    if (Math.random() < 0.7) {
      // ── ムーブA: 同クラス内スワップ ──
      const keyA = movableKeys[Math.floor(Math.random() * movableKeys.length)];
      const eA = placed.get(keyA);
      if (!eA) continue;

      const sameClassKeys = movableKeys.filter((k) => {
        const e = placed.get(k);
        return (
          e &&
          e.grade === eA.grade &&
          e.class_name === eA.class_name &&
          k !== keyA
        );
      });
      if (sameClassKeys.length === 0) continue;
      const keyB =
        sameClassKeys[Math.floor(Math.random() * sameClassKeys.length)];
      const eB = placed.get(keyB);
      if (!eB || eA.subject === eB.subject) continue;

      // 教科の配置制約チェック（スワップ後の位置）
      const spA = subjectPlacement[eA.subject];
      const spB = subjectPlacement[eB.subject];
      if (
        spA?.allowed_periods?.length &&
        !spA.allowed_periods.includes(eB.period)
      )
        continue;
      if (
        spA?.allowed_days?.length &&
        !spA.allowed_days.includes(eB.day_of_week)
      )
        continue;
      if (
        spB?.allowed_periods?.length &&
        !spB.allowed_periods.includes(eA.period)
      )
        continue;
      if (
        spB?.allowed_days?.length &&
        !spB.allowed_days.includes(eA.day_of_week)
      )
        continue;

      // 午後制約チェック
      if (spA?.max_afternoon_daily != null && eB.period > lunchAfterPeriod) {
        let cnt = 0;
        for (const e of placed.values()) {
          if (
            e !== eA &&
            e.grade === eA.grade &&
            e.class_name === eA.class_name &&
            e.day_of_week === eB.day_of_week &&
            e.period > lunchAfterPeriod &&
            e.subject === eA.subject
          )
            cnt++;
        }
        if (cnt >= spA.max_afternoon_daily) continue;
      }
      if (spB?.max_afternoon_daily != null && eA.period > lunchAfterPeriod) {
        let cnt = 0;
        for (const e of placed.values()) {
          if (
            e !== eB &&
            e.grade === eB.grade &&
            e.class_name === eB.class_name &&
            e.day_of_week === eA.day_of_week &&
            e.period > lunchAfterPeriod &&
            e.subject === eB.subject
          )
            cnt++;
        }
        if (cnt >= spB.max_afternoon_daily) continue;
      }

      // 教員・施設を一時解除
      if (eA.teacher_id)
        unmarkTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
      if (eB.teacher_id)
        unmarkTeacher(usage, eB.teacher_id, eB.day_of_week, eB.period);
      const fidA = subjectFacility[eA.subject];
      const fidB = subjectFacility[eB.subject];
      if (fidA) facilityUsage.delete(`${fidA}|${eA.day_of_week}|${eA.period}`);
      if (fidB) facilityUsage.delete(`${fidB}|${eB.day_of_week}|${eB.period}`);

      // 施設競合チェック（スワップ後）
      if (fidA && facilityUsage.has(`${fidA}|${eB.day_of_week}|${eB.period}`)) {
        if (eA.teacher_id)
          markTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
        if (eB.teacher_id)
          markTeacher(usage, eB.teacher_id, eB.day_of_week, eB.period);
        if (fidA) facilityUsage.add(`${fidA}|${eA.day_of_week}|${eA.period}`);
        if (fidB) facilityUsage.add(`${fidB}|${eB.day_of_week}|${eB.period}`);
        continue;
      }
      if (fidB && facilityUsage.has(`${fidB}|${eA.day_of_week}|${eA.period}`)) {
        if (eA.teacher_id)
          markTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
        if (eB.teacher_id)
          markTeacher(usage, eB.teacher_id, eB.day_of_week, eB.period);
        if (fidA) facilityUsage.add(`${fidA}|${eA.day_of_week}|${eA.period}`);
        if (fidB) facilityUsage.add(`${fidB}|${eB.day_of_week}|${eB.period}`);
        continue;
      }

      // 教員再探索
      const newAssignA = findTeacherOrGroup(
        eA.grade,
        false,
        eA.subject,
        eB.day_of_week,
        eB.period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (newAssignA)
        markTeacher(usage, newAssignA.usageKey, eB.day_of_week, eB.period);
      const newAssignB = findTeacherOrGroup(
        eB.grade,
        false,
        eB.subject,
        eA.day_of_week,
        eA.period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      if (newAssignB)
        markTeacher(usage, newAssignB.usageKey, eA.day_of_week, eA.period);

      // 仮適用してスコア計算
      const newEA: TimetableEntry = {
        ...eA,
        day_of_week: eB.day_of_week,
        period: eB.period,
        teacher_id: newAssignA?.teacher_id ?? null,
        teacher_group_id: newAssignA?.teacher_group_id ?? null,
      };
      const newEB: TimetableEntry = {
        ...eB,
        day_of_week: eA.day_of_week,
        period: eA.period,
        teacher_id: newAssignB?.teacher_id ?? null,
        teacher_group_id: newAssignB?.teacher_group_id ?? null,
      };
      placed.set(keyB, newEA);
      placed.set(keyA, newEB);
      if (fidA) facilityUsage.add(`${fidA}|${eB.day_of_week}|${eB.period}`);
      if (fidB) facilityUsage.add(`${fidB}|${eA.day_of_week}|${eA.period}`);

      const newScore = calcDetailedScore(
        toResult(),
        teacherConstraints,
        subjectFacility,
        subjectPlacement,
      );
      const delta = newScore - currentScore;

      if (delta > 0 || Math.random() < Math.exp(delta / T)) {
        currentScore = newScore;
        if (newScore > bestScore) {
          bestScore = newScore;
          bestEntries = [...placed.values()];
          onImprove(saAttempts);
        }
      } else {
        // ロールバック
        placed.set(keyA, eA);
        placed.set(keyB, eB);
        if (newAssignA)
          unmarkTeacher(usage, newAssignA.usageKey, eB.day_of_week, eB.period);
        if (newAssignB)
          unmarkTeacher(usage, newAssignB.usageKey, eA.day_of_week, eA.period);
        if (fidA) {
          facilityUsage.delete(`${fidA}|${eB.day_of_week}|${eB.period}`);
          facilityUsage.add(`${fidA}|${eA.day_of_week}|${eA.period}`);
        }
        if (fidB) {
          facilityUsage.delete(`${fidB}|${eA.day_of_week}|${eA.period}`);
          facilityUsage.add(`${fidB}|${eB.day_of_week}|${eB.period}`);
        }
        if (eA.teacher_id)
          markTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
        if (eB.teacher_id)
          markTeacher(usage, eB.teacher_id, eB.day_of_week, eB.period);
      }
    } else {
      // ── ムーブB: 空きスロットへ再配置 ──
      const keyA = movableKeys[Math.floor(Math.random() * movableKeys.length)];
      const eA = placed.get(keyA);
      if (!eA) continue;

      const sp = subjectPlacement[eA.subject];
      const candidates = shuffle(allSlots).filter(({ day, period }) => {
        const k = `${eA.grade}|${eA.class_name}|${day}|${period}`;
        if (placed.has(k) || fixedSlotKeys.has(k)) return false;
        if (sp?.allowed_periods?.length && !sp.allowed_periods.includes(period))
          return false;
        if (sp?.allowed_days?.length && !sp.allowed_days.includes(day))
          return false;
        const fid = subjectFacility[eA.subject];
        if (fid && facilityUsage.has(`${fid}|${day}|${period}`)) return false;
        return true;
      });
      if (candidates.length === 0) continue;

      const { day: newDay, period: newPeriod } = candidates[0];
      const newKey = `${eA.grade}|${eA.class_name}|${newDay}|${newPeriod}`;

      if (eA.teacher_id)
        unmarkTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
      const fidOld = subjectFacility[eA.subject];
      if (fidOld)
        facilityUsage.delete(`${fidOld}|${eA.day_of_week}|${eA.period}`);

      const newAssign = findTeacherOrGroup(
        eA.grade,
        false,
        eA.subject,
        newDay,
        newPeriod,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
          groupSubjects,
        );
      const newE: TimetableEntry = {
        ...eA,
        day_of_week: newDay,
        period: newPeriod,
        teacher_id: newAssign?.teacher_id ?? null,
        teacher_group_id: newAssign?.teacher_group_id ?? null,
      };

      placed.delete(keyA);
      placed.set(newKey, newE);
      if (newAssign) markTeacher(usage, newAssign.usageKey, newDay, newPeriod);
      if (fidOld) facilityUsage.add(`${fidOld}|${newDay}|${newPeriod}`);

      const newScore = calcDetailedScore(
        toResult(),
        teacherConstraints,
        subjectFacility,
        subjectPlacement,
      );
      const delta = newScore - currentScore;

      if (delta > 0 || Math.random() < Math.exp(delta / T)) {
        currentScore = newScore;
        if (newScore > bestScore) {
          bestScore = newScore;
          bestEntries = [...placed.values()];
          onImprove(saAttempts);
        }
      } else {
        placed.delete(newKey);
        placed.set(keyA, eA);
        if (newAssign)
          unmarkTeacher(usage, newAssign.usageKey, newDay, newPeriod);
        if (fidOld) {
          facilityUsage.delete(`${fidOld}|${newDay}|${newPeriod}`);
          facilityUsage.add(`${fidOld}|${eA.day_of_week}|${eA.period}`);
        }
        if (eA.teacher_id)
          markTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
      }
    }
  }

  return {
    entries: bestEntries,
    placed_count: initialResult.placed_count,
    required_count: initialResult.required_count,
  };
}

// ── メインソルバー ──────────────────────────────────────────────────────

function solve(data: SolverInput): TryOnceResult {
  const {
    teachers = [],
    teacher_groups = [],
    structure = { grades: [], required_hours: {} },
    fixed_slots = [],
    subject_placement = {},
    cross_grade_groups = [],
    class_groups = [],
    subject_pairings = [],
    alt_week_pairs = [],
    subject_sequences = [],
    existing_timetable = [],
    settings = { lunch_after_period: 4 },
    time_limit = 10,
    teacher_constraints = {},
    subject_facility = {},
  } = data;

  const lunchAfterPeriod = settings.lunch_after_period ?? 4;
  const startMs = Date.now();
  const phase1EndMs = startMs + time_limit * 1000 * 0.25;
  const phase2EndMs = startMs + time_limit * 1000;

  const classes: ClassInfo[] = [];
  for (const g of structure.grades || []) {
    for (const cn of g.classes || [])
      classes.push({ grade: g.grade, class_name: cn, isSpecial: false });
    for (const cn of g.special_classes || [])
      classes.push({ grade: g.grade, class_name: cn, isSpecial: true });
  }

  if (classes.length === 0)
    return { entries: [], placed_count: 0, required_count: 0 };

  const fixedSlotKeys = new Set<string>();
  const fixedEntries: TimetableEntry[] = [];
  for (const slot of fixed_slots) {
    for (const cls of classes) {
      const match =
        slot.scope === "all" ||
        (slot.scope === "grade" && cls.grade === slot.grade) ||
        (slot.scope === "class" &&
          cls.grade === slot.grade &&
          cls.class_name === slot.class_name);
      if (!match) continue;
      const key = `${cls.grade}|${cls.class_name}|${slot.day_of_week}|${slot.period}`;
      fixedSlotKeys.add(key);
      if (slot.subject)
        fixedEntries.push({
          day_of_week: slot.day_of_week,
          period: slot.period,
          grade: cls.grade,
          class_name: cls.class_name,
          subject: slot.subject,
          teacher_id: null,
        });
    }
  }

  for (const entry of existing_timetable) {
    const key = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
    if (fixedSlotKeys.has(key)) continue;
    fixedSlotKeys.add(key);
    if (entry.subject) {
      fixedEntries.push({
        day_of_week: entry.day_of_week,
        period: entry.period,
        grade: entry.grade,
        class_name: entry.class_name,
        subject: entry.subject,
        teacher_id: entry.teacher_id || null,
      });
      if (entry.alt_subject)
        fixedEntries.push({
          day_of_week: entry.day_of_week,
          period: entry.period,
          grade: entry.grade,
          class_name: entry.class_name,
          subject: entry.alt_subject,
          teacher_id: entry.teacher_id || null,
        });
    }
  }

  const classRequiredSlots: Record<string, string[]> = {};
  for (const cls of classes) {
    const reqKey = cls.isSpecial ? `${cls.grade}_特支` : `${cls.grade}_通常`;
    const req = structure.required_hours?.[reqKey] || {};
    const fixedCounts: Record<string, number> = {};
    for (const fe of fixedEntries) {
      if (
        fe.grade === cls.grade &&
        fe.class_name === cls.class_name &&
        fe.subject
      )
        fixedCounts[fe.subject] = (fixedCounts[fe.subject] || 0) + 1;
    }
    const slots: string[] = [];
    for (const [subj, cnt] of Object.entries(req)) {
      const remaining = Math.max(0, cnt - (fixedCounts[subj] || 0));
      for (let i = 0; i < remaining; i++) slots.push(subj);
    }
    classRequiredSlots[`${cls.grade}|${cls.class_name}`] = slots;
  }

  for (const grp of cross_grade_groups) {
    if (!grp.subject || !grp.participants) continue;
    const subtractCount = grp.count || 1;
    for (const p of grp.participants) {
      const key = `${p.grade}|${p.class_name}`;
      if (!classRequiredSlots[key]) continue;
      let removed = 0;
      classRequiredSlots[key] = classRequiredSlots[key].filter((s) => {
        if (s === grp.subject && removed < subtractCount) {
          removed++;
          return false;
        }
        return true;
      });
    }
  }

  const classGroupTasks: ClassGroupTask[] = [];
  for (const grp of class_groups) {
    const { grade, classes: grpClasses, split_subjects = [] } = grp;
    if (!grpClasses || grpClasses.length < 2) continue;
    const keys = grpClasses.map((cn) => `${grade}|${cn}`);
    const subjectMinCounts: Record<string, number> = {};
    for (const key of keys) {
      const counts: Record<string, number> = {};
      for (const s of classRequiredSlots[key] || []) {
        if (!split_subjects.includes(s)) counts[s] = (counts[s] || 0) + 1;
      }
      for (const [subj, cnt] of Object.entries(counts)) {
        subjectMinCounts[subj] =
          subjectMinCounts[subj] === undefined
            ? cnt
            : Math.min(subjectMinCounts[subj], cnt);
      }
    }
    for (const [subj, cnt] of Object.entries(subjectMinCounts)) {
      for (const key of keys) {
        let removed = 0;
        classRequiredSlots[key] = (classRequiredSlots[key] || []).filter(
          (s) => {
            if (s === subj && removed < cnt) {
              removed++;
              return false;
            }
            return true;
          },
        );
      }
      for (let i = 0; i < cnt; i++)
        classGroupTasks.push({ grade, classNames: grpClasses, subject: subj });
    }
  }

  const altTasks: AltTask[] = [];
  for (const pair of alt_week_pairs) {
    const sepIdx = pair.class_key.indexOf("|");
    if (sepIdx < 0) continue;
    const grade = Number(pair.class_key.slice(0, sepIdx));
    const class_name = pair.class_key.slice(sepIdx + 1);
    const key = `${grade}|${class_name}`;
    if (!classRequiredSlots[key]) continue;
    const pairCount = pair.count || 1;
    let removedA = 0;
    classRequiredSlots[key] = classRequiredSlots[key].filter((s) => {
      if (s === pair.subject_a && removedA < pairCount) {
        removedA++;
        return false;
      }
      return true;
    });
    let removedB = 0;
    classRequiredSlots[key] = classRequiredSlots[key].filter((s) => {
      if (s === pair.subject_b && removedB < pairCount) {
        removedB++;
        return false;
      }
      return true;
    });
    const cls = classes.find(
      (c) => c.grade === grade && c.class_name === class_name,
    );
    if (!cls) continue;
    for (let i = 0; i < pairCount; i++)
      altTasks.push({
        grade,
        class_name,
        isSpecial: cls.isSpecial,
        subject_a: pair.subject_a,
        subject_b: pair.subject_b,
      });
  }

  const sequenceTasks: SequenceTask[] = [];
  for (const seq of subject_sequences) {
    const targets = classes.filter(
      (c) =>
        c.grade === seq.grade &&
        (seq.class_name == null || c.class_name === seq.class_name),
    );
    for (const cls of targets) {
      const key = `${cls.grade}|${cls.class_name}`;
      if (!classRequiredSlots[key]) continue;
      let removedA = 0;
      classRequiredSlots[key] = classRequiredSlots[key].filter((s) => {
        if (s === seq.subject_a && removedA < 1) {
          removedA++;
          return false;
        }
        return true;
      });
      let removedB = 0;
      classRequiredSlots[key] = classRequiredSlots[key].filter((s) => {
        if (s === seq.subject_b && removedB < 1) {
          removedB++;
          return false;
        }
        return true;
      });
      if (removedA === 0 && removedB === 0) continue;
      sequenceTasks.push({
        grade: cls.grade,
        class_name: cls.class_name,
        isSpecial: cls.isSpecial,
        subject_a: seq.subject_a,
        subject_b: seq.subject_b,
      });
    }
  }

  const params: TryOnceParams = {
    classes,
    classRequiredSlots,
    teachers,
    teacherGroups: teacher_groups,
    fixedSlotKeys,
    fixedEntries,
    subjectPlacement: subject_placement,
    lunchAfterPeriod,
    crossGradeGroups: cross_grade_groups,
    subjectPairings: subject_pairings,
    altTasks,
    classGroupTasks,
    sequenceTasks,
    teacherConstraints: teacher_constraints,
    subjectFacility: subject_facility,
  };

  // ── フェーズ1: 改善貪欲法（25%） ──
  let bestResult: TryOnceResult | null = null;
  let bestScore = -Infinity;
  let attempts = 0;

  while (Date.now() < phase1EndMs) {
    attempts++;
    const result = tryOnce(params);
    const score = calcDetailedScore(
      result,
      teacher_constraints,
      subject_facility,
      subject_placement,
    );
    if (score > bestScore) {
      bestScore = score;
      bestResult = result;
      const pct = Math.min(
        99,
        Math.round(
          (result.placed_count / Math.max(1, result.required_count)) * 100,
        ),
      );
      self.postMessage({
        type: "progress",
        score: pct,
        attempts,
        placed: result.placed_count,
        required: result.required_count,
      });
    }
    if (bestScore >= 300) break;
  }

  if (!bestResult) {
    bestResult = {
      entries: fixedEntries,
      placed_count: fixedEntries.length,
      required_count: 0,
    };
  }

  // ── フェーズ2: 焼きなまし局所探索（75%） ──
  const finalResult = localSearch(
    bestResult,
    params,
    phase2EndMs,
    (saAttempts) => {
      const pct = Math.min(
        99,
        Math.round(
          (bestResult?.placed_count / Math.max(1, bestResult?.required_count)) *
            100,
        ),
      );
      self.postMessage({
        type: "progress",
        score: pct,
        attempts: attempts + saAttempts,
        placed: bestResult?.placed_count,
        required: bestResult?.required_count,
      });
    },
  );

  return finalResult;
}

self.onmessage = (e: MessageEvent) => {
  if (e.data?.type === "solve") {
    try {
      const result = solve(e.data.data);
      self.postMessage({
        type: "done",
        timetable: result.entries,
        count: result.entries.length,
        placed: result.placed_count,
        required: result.required_count,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      self.postMessage({ type: "error", message });
    }
  }
};
