/**
 * jsSolver.worker.ts
 * ブラウザ内で動作する時間割自動生成ソルバー（Web Worker）
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
  TeacherGroup,
  TimetableEntry,
} from "@/types";

// ── 型定義 ────────────────────────────────────────────────────────────

interface ClassInfo {
  grade: number;
  class_name: string;
  isSpecial: boolean;
}

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

// ── 教員または教員グループを探す ──────────────────────────────────────

function findTeacherOrGroup(
  grade: number,
  isSpecial: boolean,
  subject: string,
  day: DayOfWeek,
  period: Period,
  teachers: Teacher[],
  teacherGroups: TeacherGroup[],
  teacherUsage: Map<string, boolean>,
): {
  teacher_id: string | null;
  teacher_group_id: string | null;
  usageKey: string;
} | null {
  // 1. 個別教員を優先して探す
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
    if (teacherUsage.has(`${t.id}|${day}|${period}`)) continue;
    return { teacher_id: t.id, teacher_group_id: null, usageKey: t.id };
  }
  // 2. 教員グループを探す
  for (const g of teacherGroups || []) {
    const gSubjects = g.subjects || [];
    const gGrades = g.target_grades || [];
    if (gSubjects.length === 0 || !gSubjects.includes(subject)) continue;
    if (gGrades.length > 0 && !gGrades.includes(grade)) continue;
    if (teacherUsage.has(`${g.id}|${day}|${period}`)) continue;
    return { teacher_id: null, teacher_group_id: g.id, usageKey: g.id };
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
}: TryOnceParams): TryOnceResult {
  const placed = new Map<string, TimetableEntry>();
  const teacherUsage = new Map<string, boolean>();
  let placed_count = 0;
  let required_count = 0;

  for (const entry of fixedEntries) {
    const key = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
    placed.set(key, entry);
    if (entry.teacher_id) {
      teacherUsage.set(
        `${entry.teacher_id}|${entry.day_of_week}|${entry.period}`,
        true,
      );
    }
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
          if (teacherUsage.has(`${t.id}|${day}|${period}`)) continue;
          if (![...gradeSet].some((g) => t.target_grades.includes(g))) continue;
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
            if (teacherUsage.has(`${g.id}|${day}|${period}`)) continue;
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
          const k = `${p.grade}|${p.class_name}|${day}|${period}`;
          placed.set(k, {
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
        teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
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
        teacherUsage,
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
      teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
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
        teacherUsage,
      );
      if (!assignA) continue;
      const tempUsage = new Map(teacherUsage);
      tempUsage.set(`${assignA.usageKey}|${day}|${period}`, true);
      const assignB = findTeacherOrGroup(
        grade,
        isSpecial,
        subject_b,
        day,
        periodB,
        teachers,
        teacherGroups,
        tempUsage,
      );
      if (!assignB) continue;

      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name: class_name,
        subject: subject_a,
        teacher_id: assignA.teacher_id,
        teacher_group_id: assignA.teacher_group_id,
      });
      placed.set(`${grade}|${class_name}|${day}|${periodB}`, {
        day_of_week: day,
        period: periodB,
        grade,
        class_name: class_name,
        subject: subject_b,
        teacher_id: assignB.teacher_id,
        teacher_group_id: assignB.teacher_group_id,
      });
      teacherUsage.set(`${assignA.usageKey}|${day}|${period}`, true);
      teacherUsage.set(`${assignB.usageKey}|${day}|${periodB}`, true);
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
        teacherUsage,
      );
      if (!assignment) continue;

      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name: class_name,
        subject: subject_a,
        alt_subject: subject_b,
        teacher_id: assignment.teacher_id,
        teacher_group_id: assignment.teacher_group_id,
      });
      teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
      placed_count++;
      break;
    }
  }

  // 5. 抱き合わせ
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

  const soloTasks: {
    grade: number;
    className: string;
    subject: string;
    isSpecial: boolean;
  }[] = [];
  for (const cls of classes) {
    const key = `${cls.grade}|${cls.class_name}`;
    for (const subject of remainingSlots[key] || []) {
      soloTasks.push({
        grade: cls.grade,
        className: cls.class_name,
        subject,
        isSpecial: cls.isSpecial,
      });
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
        teacherUsage,
      );
      if (!assignA) continue;
      const tempUsage = new Map(teacherUsage);
      tempUsage.set(`${assignA.usageKey}|${day}|${period}`, true);
      const assignB = findTeacherOrGroup(
        grade,
        clsB.isSpecial,
        subjectB,
        day,
        period,
        teachers,
        teacherGroups,
        tempUsage,
      );
      if (!assignB) continue;

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
      teacherUsage.set(`${assignA.usageKey}|${day}|${period}`, true);
      teacherUsage.set(`${assignB.usageKey}|${day}|${period}`, true);
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
        teacherUsage,
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
      teacherUsage.set(`${assignment.usageKey}|${day}|${period}`, true);
      placed_count++;
      break;
    }
  }

  return { entries: [...placed.values()], placed_count, required_count };
}

// ── スコア計算 ──────────────────────────────────────────────────────────

function calcScore({
  placed_count,
  required_count,
  entries,
}: TryOnceResult): number {
  const placeRate = required_count > 0 ? placed_count / required_count : 1;
  const withTeacher = entries.filter(
    (e) => e.teacher_id || e.teacher_group_id,
  ).length;
  const teachRate = entries.length > 0 ? withTeacher / entries.length : 1;
  return placeRate * 200 + teachRate * 100; // max 300
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
  } = data;

  const lunchAfterPeriod = settings.lunch_after_period ?? 4;
  const startMs = Date.now();

  const classes: ClassInfo[] = [];
  for (const g of structure.grades || []) {
    for (const cn of g.classes || [])
      classes.push({ grade: g.grade, class_name: cn, isSpecial: false });
    for (const cn of g.special_classes || [])
      classes.push({ grade: g.grade, class_name: cn, isSpecial: true });
  }

  if (classes.length === 0) {
    return { entries: [], placed_count: 0, required_count: 0 };
  }

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
      if (slot.subject) {
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
      if (entry.alt_subject) {
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
      ) {
        fixedCounts[fe.subject] = (fixedCounts[fe.subject] || 0) + 1;
      }
    }

    const slots: string[] = [];
    for (const [subj, cnt] of Object.entries(req)) {
      const alreadyFixed = fixedCounts[subj] || 0;
      const remaining = Math.max(0, cnt - alreadyFixed);
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
      for (let i = 0; i < cnt; i++) {
        classGroupTasks.push({ grade, classNames: grpClasses, subject: subj });
      }
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
    for (let i = 0; i < pairCount; i++) {
      altTasks.push({
        grade,
        class_name,
        isSpecial: cls.isSpecial,
        subject_a: pair.subject_a,
        subject_b: pair.subject_b,
      });
    }
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
  };

  let bestResult: TryOnceResult | null = null;
  let bestScore = -1;
  let attempts = 0;

  while (Date.now() - startMs < time_limit * 1000) {
    attempts++;
    const result = tryOnce(params);
    const score = calcScore(result);

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
    if (score >= 300) break;
    if (attempts % 10 === 0 && bestResult) {
      const pct = Math.min(
        99,
        Math.round(
          (bestResult.placed_count / Math.max(1, bestResult.required_count)) *
            100,
        ),
      );
      self.postMessage({
        type: "progress",
        score: pct,
        attempts,
        placed: bestResult.placed_count,
        required: bestResult.required_count,
      });
    }
  }

  return (
    bestResult || {
      entries: fixedEntries,
      placed_count: fixedEntries.length,
      required_count: 0,
    }
  );
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
