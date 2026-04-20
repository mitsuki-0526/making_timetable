/**
 * jsSolver.worker.ts
 * ブラウザ内で動作する時間割自動生成ソルバー（Web Worker）
 * 構築優先解法: 難タスク優先の充足探索 + 未配置回収 + 全充足後の局所探索
 */

import { DAYS, PERIODS } from "@/constants";
import type {
  CrossGradeGroup,
  DayOfWeek,
  Period,
  SolverInput,
  SubjectConstraint,
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
  subjectConstraints: Record<string, SubjectConstraint>;
  lunchAfterPeriod: number;
  crossGradeGroups: CrossGradeGroup[];
  subjectPairings: SubjectPairing[];
  altTasks: AltTask[];
  classGroupTasks: ClassGroupTask[];
  sequenceTasks: RepairTask[];
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

interface TryOnceResult {
  entries: TimetableEntry[];
  placed_count: number;
  required_count: number;
  diagnostics?: SolverDiagnostic[];
}

interface SolverDiagnostic {
  grade: number;
  class_name: string;
  subject: string;
  missing: number;
  reason: string;
}

interface RepairTaskParticipant {
  grade: number;
  class_name: string;
  isSpecial: boolean;
  subject: string;
  alt_subject?: string;
  offset: number;
}

interface RepairTask {
  sharedAssignment: boolean;
  participants: RepairTaskParticipant[];
}

interface PairingTarget {
  class_name: string;
  subject: string;
}

type PairingLookup = Map<string, PairingTarget[]>;

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

// ── 教員が指定スロットで使用中かを確認（直接配置 + グループ経由の両方） ──

function isTeacherBusyInSlot(
  teacherId: string,
  day: DayOfWeek,
  period: Period,
  usage: TeacherUsageState,
  teacherGroups: TeacherGroup[],
): boolean {
  if (usage.slots.has(`${teacherId}|${day}|${period}`)) return true;
  for (const group of teacherGroups) {
    if (
      group.teacher_ids?.includes(teacherId) &&
      usage.slots.has(`${group.id}|${day}|${period}`)
    ) {
      return true;
    }
  }
  return false;
}

// ヘルパ: 使用状況オブジェクトを作成
function makeUsage(): TeacherUsageState {
  return {
    slots: new Set<string>(),
    daily: new Map<string, number>(),
    weekly: new Map<string, number>(),
  };
}

function prioritizeWithRandomTiebreak<T>(
  items: T[],
  scoreFn: (item: T) => number,
): T[] {
  return [...items]
    .map((item, index) => ({
      item,
      index,
      score: scoreFn(item),
      tiebreaker: Math.random(),
    }))
    .sort(
      (a, b) =>
        a.score - b.score || a.tiebreaker - b.tiebreaker || a.index - b.index,
    )
    .map(({ item }) => item);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildPairingLookup(subjectPairings: SubjectPairing[]): PairingLookup {
  const lookup: PairingLookup = new Map();

  const addTarget = (
    grade: number,
    className: string,
    subject: string,
    targetClassName: string,
    targetSubject: string,
  ) => {
    const key = `${grade}|${className}|${subject}`;
    const current = lookup.get(key) ?? [];
    current.push({ class_name: targetClassName, subject: targetSubject });
    lookup.set(key, current);
  };

  for (const pairing of subjectPairings || []) {
    addTarget(
      pairing.grade,
      pairing.classA,
      pairing.subjectA,
      pairing.classB,
      pairing.subjectB,
    );
    addTarget(
      pairing.grade,
      pairing.classB,
      pairing.subjectB,
      pairing.classA,
      pairing.subjectA,
    );
  }

  return lookup;
}

function expandFixedEntriesWithPairings(
  entries: TimetableEntry[],
  fixedSlotKeys: Set<string>,
  pairingLookup: PairingLookup,
  classInfoByKey: Map<string, ClassInfo>,
): TimetableEntry[] {
  const expanded = new Map(
    entries.map((entry) => [
      `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`,
      entry,
    ]),
  );
  const queue = [...expanded.values()];

  while (queue.length > 0) {
    const entry = queue.shift();
    if (!entry?.subject) continue;

    const targets =
      pairingLookup.get(
        `${entry.grade}|${entry.class_name}|${entry.subject}`,
      ) ?? [];

    for (const target of targets) {
      const classKey = `${entry.grade}|${target.class_name}`;
      if (!classInfoByKey.has(classKey)) continue;

      const slotKey = `${entry.grade}|${target.class_name}|${entry.day_of_week}|${entry.period}`;
      if (expanded.has(slotKey)) continue;

      const pairedEntry: TimetableEntry = {
        day_of_week: entry.day_of_week,
        period: entry.period,
        grade: entry.grade,
        class_name: target.class_name,
        subject: target.subject,
        teacher_id: null,
        teacher_group_id: null,
      };

      expanded.set(slotKey, pairedEntry);
      fixedSlotKeys.add(slotKey);
      queue.push(pairedEntry);
    }
  }

  return [...expanded.values()];
}

function expandParticipantsWithPairings(
  participants: RepairTaskParticipant[],
  pairingLookup: PairingLookup,
  classInfoByKey: Map<string, ClassInfo>,
  classRequiredSlots: Record<string, string[]>,
): RepairTaskParticipant[] {
  const expanded = [...participants];
  const queue = [...participants];
  const slotSubjects = new Map<string, string>();

  for (const participant of participants) {
    slotSubjects.set(
      `${participant.grade}|${participant.class_name}|${participant.offset}`,
      participant.subject,
    );
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    const targets =
      pairingLookup.get(
        `${current.grade}|${current.class_name}|${current.subject}`,
      ) ?? [];

    for (const target of targets) {
      const classKey = `${current.grade}|${target.class_name}`;
      if (!classInfoByKey.has(classKey)) continue;

      const slotKey = `${current.grade}|${target.class_name}|${current.offset}`;
      const existingSubject = slotSubjects.get(slotKey);
      if (existingSubject) {
        if (existingSubject === target.subject) continue;
        continue;
      }

      const slots = classRequiredSlots[classKey];
      const targetIndex = slots?.indexOf(target.subject) ?? -1;
      if (targetIndex < 0) continue;

      slots.splice(targetIndex, 1);
      const participant: RepairTaskParticipant = {
        grade: current.grade,
        class_name: target.class_name,
        isSpecial: classInfoByKey.get(classKey)?.isSpecial ?? false,
        subject: target.subject,
        offset: current.offset,
      };

      slotSubjects.set(slotKey, target.subject);
      expanded.push(participant);
      queue.push(participant);
    }
  }

  return expanded;
}

function canTeacherTeachSubject(
  teacher: Teacher,
  grade: number,
  _isSpecial: boolean,
  subject: string,
): boolean {
  return (
    teacher.subjects.includes(subject) && teacher.target_grades.includes(grade)
  );
}

function canTeacherGroupTeachSubject(
  group: TeacherGroup,
  grade: number,
  subject: string,
): boolean {
  const supportsSubject = group.subjects?.includes(subject) ?? false;
  const supportsGrade =
    group.target_grades == null || group.target_grades.includes(grade);
  return supportsSubject && supportsGrade;
}

function getSubjectTightness(
  grade: number,
  isSpecial: boolean,
  subject: string,
  teachers: Teacher[],
  teacherGroups: TeacherGroup[],
  subjectPlacement: Record<string, SubjectPlacement>,
): number {
  const availableTeachers = teachers.filter((teacher) =>
    canTeacherTeachSubject(teacher, grade, isSpecial, subject),
  ).length;
  const availableGroups = teacherGroups.filter((group) =>
    canTeacherGroupTeachSubject(group, grade, subject),
  ).length;

  const placement = subjectPlacement[subject];
  const allowedDays = placement?.allowed_days?.length
    ? placement.allowed_days.length
    : DAYS.length;
  const allowedPeriods = placement?.allowed_periods?.length
    ? placement.allowed_periods.length
    : PERIODS.length;
  const slotFreedom = allowedDays * allowedPeriods;

  const assignmentOptions = availableTeachers + availableGroups;

  return assignmentOptions * 100 + slotFreedom;
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
  type AssignmentCandidate = {
    teacher_id: string | null;
    teacher_group_id: string | null;
    usageKey: string;
    dailyLoad: number;
    weeklyLoad: number;
    specialization: number;
  };

  const pickBestCandidate = (
    candidates: AssignmentCandidate[],
  ): {
    teacher_id: string | null;
    teacher_group_id: string | null;
    usageKey: string;
  } | null => {
    const best = candidates.sort(
      (a, b) =>
        a.dailyLoad - b.dailyLoad ||
        a.weeklyLoad - b.weeklyLoad ||
        a.specialization - b.specialization,
    )[0];
    if (!best) return null;
    return {
      teacher_id: best.teacher_id,
      teacher_group_id: best.teacher_group_id,
      usageKey: best.usageKey,
    };
  };

  const collectTeacherCandidates = (): AssignmentCandidate[] => {
    const candidates: AssignmentCandidate[] = [];
    for (const teacher of teachers) {
      if (!canTeacherTeachSubject(teacher, grade, isSpecial, subject)) continue;
      if (
        teacher.unavailable_times?.some(
          (u) => u.day_of_week === day && u.period === period,
        )
      ) {
        continue;
      }
      if (isTeacherBusyInSlot(teacher.id, day, period, usage, teacherGroups))
        continue;
      const constraint = teacherConstraints[teacher.id];
      if (constraint) {
        if (
          constraint.max_weekly != null &&
          (usage.weekly.get(teacher.id) ?? 0) >= constraint.max_weekly
        ) {
          continue;
        }
        if (
          constraint.max_daily != null &&
          (usage.daily.get(`${teacher.id}|${day}`) ?? 0) >= constraint.max_daily
        ) {
          continue;
        }
        if (
          constraint.max_consecutive != null &&
          calcConsecutiveAfterPlace(usage.slots, teacher.id, day, period) >
            constraint.max_consecutive
        ) {
          continue;
        }
      }
      candidates.push({
        teacher_id: teacher.id,
        teacher_group_id: null,
        usageKey: teacher.id,
        dailyLoad: usage.daily.get(`${teacher.id}|${day}`) ?? 0,
        weeklyLoad: usage.weekly.get(teacher.id) ?? 0,
        specialization: teacher.subjects.length,
      });
    }
    return candidates;
  };

  const collectGroupCandidates = (): AssignmentCandidate[] => {
    const candidates: AssignmentCandidate[] = [];
    for (const group of teacherGroups || []) {
      if (!canTeacherGroupTeachSubject(group, grade, subject)) continue;
      const groupMembersUnavailable = teachers
        .filter((teacher) => group.teacher_ids?.includes(teacher.id))
        .some(
          (teacher) =>
            teacher.unavailable_times?.some(
              (u) => u.day_of_week === day && u.period === period,
            ) ||
            isTeacherBusyInSlot(teacher.id, day, period, usage, teacherGroups),
        );
      if (groupMembersUnavailable) continue;
      if (usage.slots.has(`${group.id}|${day}|${period}`)) continue;
      candidates.push({
        teacher_id: null,
        teacher_group_id: group.id,
        usageKey: group.id,
        dailyLoad: usage.daily.get(`${group.id}|${day}`) ?? 0,
        weeklyLoad: usage.weekly.get(group.id) ?? 0,
        specialization: group.subjects?.length ?? 99,
      });
    }
    return candidates;
  };

  // 教員グループに登録されている教科はグループを優先
  const isGroupSubject = groupSubjects?.has(subject) ?? false;

  if (!isGroupSubject) {
    const bestTeacher = pickBestCandidate(collectTeacherCandidates());
    if (bestTeacher) return bestTeacher;
  }

  const bestGroup = pickBestCandidate(collectGroupCandidates());
  if (bestGroup) return bestGroup;

  // グループ教科でグループが見つからなかった場合は個別教員にフォールバック
  if (isGroupSubject) {
    const fallbackTeacher = pickBestCandidate(collectTeacherCandidates());
    if (fallbackTeacher) return fallbackTeacher;
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
  subjectConstraints,
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
  let placed_count = fixedEntries.length;
  let required_count = fixedEntries.length;

  // 教員グループに登録されている教科の集合（優先配置用）
  const groupSubjects = new Set<string>(
    (teacherGroups || []).flatMap((g) => g.subjects || []),
  );

  const markFacility = (subject: string, day: DayOfWeek, period: Period) => {
    const fid = subjectFacility[subject];
    if (fid) facilityUsage.add(`${fid}|${day}|${period}`);
  };

  const classInfoByKey = new Map(
    classes.map((cls) => [`${cls.grade}|${cls.class_name}`, cls] as const),
  );
  const pendingRepairTasks: RepairTask[] = [];

  const markEntryResources = (entry: TimetableEntry) => {
    if (entry.teacher_id) {
      markTeacher(usage, entry.teacher_id, entry.day_of_week, entry.period);
    }
    if (entry.teacher_group_id) {
      markTeacher(
        usage,
        entry.teacher_group_id,
        entry.day_of_week,
        entry.period,
      );
    }
    if (entry.alt_teacher_id) {
      markTeacher(usage, entry.alt_teacher_id, entry.day_of_week, entry.period);
    }
    if (entry.alt_teacher_group_id) {
      markTeacher(
        usage,
        entry.alt_teacher_group_id,
        entry.day_of_week,
        entry.period,
      );
    }
    markFacility(entry.subject, entry.day_of_week, entry.period);
    if (entry.alt_subject) {
      markFacility(entry.alt_subject, entry.day_of_week, entry.period);
    }
  };

  const addPlacedEntry = (entry: TimetableEntry) => {
    placed.set(
      `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`,
      entry,
    );
    markEntryResources(entry);
  };

  for (const entry of fixedEntries) {
    addPlacedEntry(entry);
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
    // 連続日数チェック（subject_constraints.max_consecutive_days）
    const subjConstraint = subjectConstraints?.[subject];
    if (subjConstraint?.max_consecutive_days != null) {
      const dayIndex = DAYS.indexOf(day);
      let consecutive = 1;
      for (let i = dayIndex - 1; i >= 0; i--) {
        const prevDay = DAYS[i] as DayOfWeek;
        const hasOnDay = [...placed.values()].some(
          (e) =>
            e.grade === grade &&
            e.class_name === className &&
            e.day_of_week === prevDay &&
            (e.subject === subject || e.alt_subject === subject),
        );
        if (hasOnDay) consecutive++;
        else break;
      }
      for (let i = dayIndex + 1; i < DAYS.length; i++) {
        const nextDay = DAYS[i] as DayOfWeek;
        const hasOnDay = [...placed.values()].some(
          (e) =>
            e.grade === grade &&
            e.class_name === className &&
            e.day_of_week === nextDay &&
            (e.subject === subject || e.alt_subject === subject),
        );
        if (hasOnDay) consecutive++;
        else break;
      }
      if (consecutive >= subjConstraint.max_consecutive_days) return false;
    }
    return true;
  };

  const findSharedAssignment = (
    participants: RepairTaskParticipant[],
    day: DayOfWeek,
    period: Period,
  ): {
    teacher_id: string | null;
    teacher_group_id: string | null;
    usageKey: string;
  } | null => {
    if (participants.length === 0) return null;
    const primarySubject = participants[0].subject;
    const participantGrades = [...new Set(participants.map((p) => p.grade))];

    const teacherCandidates = prioritizeWithRandomTiebreak(
      teachers.filter((teacher) => {
        if (
          teacher.unavailable_times?.some(
            (time) => time.day_of_week === day && time.period === period,
          )
        ) {
          return false;
        }
        if (isTeacherBusyInSlot(teacher.id, day, period, usage, teacherGroups))
          return false;
        if (!teacher.subjects.includes(primarySubject)) return false;
        if (
          !participantGrades.some((grade) =>
            teacher.target_grades.includes(grade),
          )
        ) {
          return false;
        }
        const constraint = teacherConstraints[teacher.id];
        if (
          constraint?.max_weekly != null &&
          (usage.weekly.get(teacher.id) ?? 0) >= constraint.max_weekly
        ) {
          return false;
        }
        if (
          constraint?.max_daily != null &&
          (usage.daily.get(`${teacher.id}|${day}`) ?? 0) >= constraint.max_daily
        ) {
          return false;
        }
        return true;
      }),
      (teacher) =>
        (usage.daily.get(`${teacher.id}|${day}`) ?? 0) * 10 +
        (usage.weekly.get(teacher.id) ?? 0),
    );
    if (teacherCandidates[0]) {
      return {
        teacher_id: teacherCandidates[0].id,
        teacher_group_id: null,
        usageKey: teacherCandidates[0].id,
      };
    }

    const groupCandidates = prioritizeWithRandomTiebreak(
      teacherGroups.filter((group) => {
        if (
          !canTeacherGroupTeachSubject(
            group,
            participants[0].grade,
            primarySubject,
          )
        ) {
          return false;
        }
        if (usage.slots.has(`${group.id}|${day}|${period}`)) return false;
        return !teachers
          .filter((teacher) => group.teacher_ids?.includes(teacher.id))
          .some(
            (teacher) =>
              teacher.unavailable_times?.some(
                (time) => time.day_of_week === day && time.period === period,
              ) ||
              isTeacherBusyInSlot(
                teacher.id,
                day,
                period,
                usage,
                teacherGroups,
              ),
          );
      }),
      (group) =>
        (usage.daily.get(`${group.id}|${day}`) ?? 0) * 10 +
        (usage.weekly.get(group.id) ?? 0),
    );
    if (groupCandidates[0]) {
      return {
        teacher_id: null,
        teacher_group_id: groupCandidates[0].id,
        usageKey: groupCandidates[0].id,
      };
    }

    return null;
  };

  const tryRepairTask = (task: RepairTask): boolean => {
    const maxOffset = Math.max(...task.participants.map((p) => p.offset));
    const anchorSlots = DAYS.flatMap((day) =>
      PERIODS.filter((period) => period + maxOffset <= 6).map((period) => ({
        day,
        period,
      })),
    );

    const prioritizedAnchors = prioritizeWithRandomTiebreak(
      anchorSlots,
      ({ day, period }) => {
        let occupiedCount = 0;
        for (const participant of task.participants) {
          const targetKey = `${participant.grade}|${participant.class_name}|${day}|${(period + participant.offset) as Period}`;
          if (placed.has(targetKey)) occupiedCount++;
        }
        return occupiedCount;
      },
    );

    for (const { day, period } of prioritizedAnchors) {
      const targetKeys = task.participants.map(
        (participant) =>
          `${participant.grade}|${participant.class_name}|${day}|${(period + participant.offset) as Period}`,
      );
      if (targetKeys.some((key) => fixedSlotKeys.has(key))) continue;

      if (targetKeys.some((key) => placed.has(key))) continue;

      const targetsValid = task.participants.every((participant) =>
        slotOk(
          participant.grade,
          participant.class_name,
          participant.subject,
          day,
          (period + participant.offset) as Period,
        ),
      );

      if (!targetsValid) continue;

      const repairedEntries: TimetableEntry[] = [];
      if (task.sharedAssignment) {
        const sharedAssignment = findSharedAssignment(
          task.participants,
          day,
          period,
        );
        // 教員が見つからなければこのスロットをスキップ
        if (!sharedAssignment) continue;
        for (const participant of task.participants) {
          repairedEntries.push({
            day_of_week: day,
            period: (period + participant.offset) as Period,
            grade: participant.grade,
            class_name: participant.class_name,
            subject: participant.subject,
            alt_subject: participant.alt_subject ?? null,
            teacher_id: sharedAssignment.teacher_id,
            teacher_group_id: sharedAssignment.teacher_group_id,
          });
        }
      } else {
        // 各参加者の教員を順番に探しながら仮マーク
        // → 次の参加者が同スロットを重複して確保しないよう防止
        const tempMarked: Array<{
          id: string;
          day: DayOfWeek;
          period: Period;
        }> = [];
        let allAssigned = true;
        for (const participant of task.participants) {
          const targetPeriod = (period + participant.offset) as Period;
          const assignment = findTeacherOrGroup(
            participant.grade,
            participant.isSpecial,
            participant.subject,
            day,
            targetPeriod,
            teachers,
            teacherGroups,
            usage,
            teacherConstraints,
            groupSubjects,
          );
          if (!assignment) {
            allAssigned = false;
            break;
          }
          markTeacher(usage, assignment.usageKey, day, targetPeriod);
          tempMarked.push({
            id: assignment.usageKey,
            day,
            period: targetPeriod,
          });
          repairedEntries.push({
            day_of_week: day,
            period: targetPeriod,
            grade: participant.grade,
            class_name: participant.class_name,
            subject: participant.subject,
            alt_subject: participant.alt_subject ?? null,
            teacher_id: assignment.teacher_id,
            teacher_group_id: assignment.teacher_group_id,
          });
        }
        // 仮マークを解除（addPlacedEntry が正式に再マーク）
        for (const m of tempMarked) {
          unmarkTeacher(usage, m.id, m.day, m.period);
        }
        if (!allAssigned) continue;
      }

      placed_count += task.participants.length;
      repairedEntries.forEach(addPlacedEntry);
      return true;
    }

    return false;
  };

  // 1. 学年横断合同授業
  for (const grp of prioritizeWithRandomTiebreak(crossGradeGroups, (group) =>
    getSubjectTightness(
      group.participants?.[0]?.grade ?? 0,
      false,
      group.subject,
      teachers,
      teacherGroups,
      subjectPlacement,
    ),
  )) {
    if (!grp.subject || !grp.participants || grp.participants.length < 2)
      continue;
    const count = grp.count || 1;
    for (let i = 0; i < count; i++) {
      required_count += grp.participants.length;
      let taskPlaced = false;
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
        const sharedAssignment = findSharedAssignment(
          grp.participants.map((participant) => ({
            grade: participant.grade,
            class_name: participant.class_name,
            isSpecial:
              classInfoByKey.get(
                `${participant.grade}|${participant.class_name}`,
              )?.isSpecial ?? false,
            subject: grp.subject,
            offset: 0,
          })),
          day,
          period,
        );
        if (!sharedAssignment) continue;
        for (const p of grp.participants) {
          placed.set(`${p.grade}|${p.class_name}|${day}|${period}`, {
            day_of_week: day,
            period,
            grade: p.grade,
            class_name: p.class_name,
            subject: grp.subject,
            teacher_id: sharedAssignment.teacher_id,
            teacher_group_id: sharedAssignment.teacher_group_id,
          });
          placed_count++;
        }
        markTeacher(usage, sharedAssignment.usageKey, day, period);
        markFacility(grp.subject, day, period);
        taskPlaced = true;
        break;
      }
      if (!taskPlaced) {
        pendingRepairTasks.push({
          sharedAssignment: true,
          participants: grp.participants.map((participant) => ({
            grade: participant.grade,
            class_name: participant.class_name,
            isSpecial:
              classInfoByKey.get(
                `${participant.grade}|${participant.class_name}`,
              )?.isSpecial ?? false,
            subject: grp.subject,
            offset: 0,
          })),
        });
      }
    }
  }

  // 2. 合同クラス
  for (const { grade, classNames, subject } of prioritizeWithRandomTiebreak(
    classGroupTasks,
    (task) =>
      getSubjectTightness(
        task.grade,
        false,
        task.subject,
        teachers,
        teacherGroups,
        subjectPlacement,
      ),
  )) {
    required_count += classNames.length;
    let taskPlaced = false;
    const candidateSlots = shuffle(
      DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
    );
    for (const { day, period } of candidateSlots) {
      if (!classNames.every((cn) => slotOk(grade, cn, subject, day, period)))
        continue;
      const sharedAssignment = findSharedAssignment(
        classNames.map((className) => ({
          grade,
          class_name: className,
          isSpecial:
            classInfoByKey.get(`${grade}|${className}`)?.isSpecial ?? false,
          subject,
          offset: 0,
        })),
        day,
        period,
      );
      if (!sharedAssignment) continue;
      for (const cn of classNames) {
        placed.set(`${grade}|${cn}|${day}|${period}`, {
          day_of_week: day,
          period,
          grade,
          class_name: cn,
          subject,
          teacher_id: sharedAssignment.teacher_id,
          teacher_group_id: sharedAssignment.teacher_group_id,
        });
        placed_count++;
      }
      markTeacher(usage, sharedAssignment.usageKey, day, period);
      markFacility(subject, day, period);
      taskPlaced = true;
      break;
    }
    if (!taskPlaced) {
      pendingRepairTasks.push({
        sharedAssignment: true,
        participants: classNames.map((className) => ({
          grade,
          class_name: className,
          isSpecial:
            classInfoByKey.get(`${grade}|${className}`)?.isSpecial ?? false,
          subject,
          offset: 0,
        })),
      });
    }
  }

  // 3. 連続配置
  for (const task of prioritizeWithRandomTiebreak(sequenceTasks, (repairTask) =>
    repairTask.participants.reduce(
      (sum, participant) =>
        sum +
        getSubjectTightness(
          participant.grade,
          participant.isSpecial,
          participant.subject,
          teachers,
          teacherGroups,
          subjectPlacement,
        ),
      0,
    ),
  )) {
    required_count += task.participants.length;
    if (!tryRepairTask(task)) {
      pendingRepairTasks.push(task);
    }
  }

  // 4. 隔週授業
  for (const {
    grade,
    class_name,
    isSpecial,
    subject_a,
    subject_b,
  } of prioritizeWithRandomTiebreak(altTasks, (task) =>
    Math.min(
      getSubjectTightness(
        task.grade,
        task.isSpecial,
        task.subject_a,
        teachers,
        teacherGroups,
        subjectPlacement,
      ),
      getSubjectTightness(
        task.grade,
        task.isSpecial,
        task.subject_b,
        teachers,
        teacherGroups,
        subjectPlacement,
      ),
    ),
  )) {
    required_count++;
    let taskPlaced = false;
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
      taskPlaced = true;
      break;
    }
    if (!taskPlaced) {
      pendingRepairTasks.push({
        sharedAssignment: false,
        participants: [
          {
            grade,
            class_name,
            isSpecial,
            subject: subject_a,
            alt_subject: subject_b,
            offset: 0,
          },
        ],
      });
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
  const doubleTasks: AltTask[] = [];
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
  for (const {
    grade,
    class_name,
    isSpecial,
    subject_a,
    subject_b,
  } of prioritizeWithRandomTiebreak(doubleTasks, (task) =>
    getSubjectTightness(
      task.grade,
      task.isSpecial,
      task.subject_a,
      teachers,
      teacherGroups,
      subjectPlacement,
    ),
  )) {
    let taskPlaced = false;
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
      markTeacher(usage, assignB.usageKey, day, periodB);
      placed.set(`${grade}|${class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name,
        subject: subject_a,
        teacher_id: assignA?.teacher_id ?? null,
        teacher_group_id: assignA?.teacher_group_id ?? null,
      });
      placed.set(`${grade}|${class_name}|${day}|${periodB}`, {
        day_of_week: day,
        period: periodB,
        grade,
        class_name,
        subject: subject_b,
        teacher_id: assignB?.teacher_id ?? null,
        teacher_group_id: assignB?.teacher_group_id ?? null,
      });
      markFacility(subject_a, day, period);
      markFacility(subject_b, day, periodB);
      placed_count += 2;
      taskPlaced = true;
      break;
    }
    if (!taskPlaced) {
      pendingRepairTasks.push({
        sharedAssignment: false,
        participants: [
          {
            grade,
            class_name,
            isSpecial,
            subject: subject_a,
            offset: 0,
          },
          {
            grade,
            class_name,
            isSpecial,
            subject: subject_b,
            offset: 1,
          },
        ],
      });
    }
  }

  for (const {
    grade,
    clsA,
    clsB,
    subjectA,
    subjectB,
  } of prioritizeWithRandomTiebreak(pairTasks, (task) =>
    Math.min(
      getSubjectTightness(
        task.grade,
        task.clsA.isSpecial,
        task.subjectA,
        teachers,
        teacherGroups,
        subjectPlacement,
      ),
      getSubjectTightness(
        task.grade,
        task.clsB.isSpecial,
        task.subjectB,
        teachers,
        teacherGroups,
        subjectPlacement,
      ),
    ),
  )) {
    let taskPlaced = false;
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
      markTeacher(usage, assignB.usageKey, day, period);
      placed.set(`${grade}|${clsA.class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name: clsA.class_name,
        subject: subjectA,
        teacher_id: assignA?.teacher_id ?? null,
        teacher_group_id: assignA?.teacher_group_id ?? null,
      });
      placed.set(`${grade}|${clsB.class_name}|${day}|${period}`, {
        day_of_week: day,
        period,
        grade,
        class_name: clsB.class_name,
        subject: subjectB,
        teacher_id: assignB?.teacher_id ?? null,
        teacher_group_id: assignB?.teacher_group_id ?? null,
      });
      markFacility(subjectA, day, period);
      markFacility(subjectB, day, period);
      placed_count += 2;
      taskPlaced = true;
      break;
    }
    if (!taskPlaced) {
      pendingRepairTasks.push({
        sharedAssignment: false,
        participants: [
          {
            grade,
            class_name: clsA.class_name,
            isSpecial: clsA.isSpecial,
            subject: subjectA,
            offset: 0,
          },
          {
            grade,
            class_name: clsB.class_name,
            isSpecial: clsB.isSpecial,
            subject: subjectB,
            offset: 0,
          },
        ],
      });
    }
  }

  // 6. 単体タスク
  for (const {
    grade,
    className,
    subject,
    isSpecial,
  } of prioritizeWithRandomTiebreak(soloTasks, (task) =>
    getSubjectTightness(
      task.grade,
      task.isSpecial,
      task.subject,
      teachers,
      teacherGroups,
      subjectPlacement,
    ),
  )) {
    let taskPlaced = false;
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
      taskPlaced = true;
      break;
    }
    if (!taskPlaced) {
      pendingRepairTasks.push({
        sharedAssignment: false,
        participants: [
          {
            grade,
            class_name: className,
            isSpecial,
            subject,
            offset: 0,
          },
        ],
      });
    }
  }

  for (const repairTask of prioritizeWithRandomTiebreak(
    pendingRepairTasks,
    (task) =>
      task.participants.reduce(
        (sum, participant) =>
          sum +
          getSubjectTightness(
            participant.grade,
            participant.isSpecial,
            participant.subject,
            teachers,
            teacherGroups,
            subjectPlacement,
          ),
        0,
      ),
  )) {
    tryRepairTask(repairTask);
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
  const { placed_count, entries } = result;
  const withTeacher = entries.filter(
    (e) => e.teacher_id || e.teacher_group_id,
  ).length;
  const unassignedCount = Math.max(0, entries.length - withTeacher);
  let score = placed_count * 1_000_000 + withTeacher * 10_000;

  // 教員未割当は空欄よりは優先するが、評価上はしっかり下げる
  score -= unassignedCount * 2_000;

  // 教員時間重複 (-5000/件)
  const teacherSlots = new Map<string, number>();
  for (const e of entries) {
    if (!e.teacher_id) continue;
    const k = `${e.teacher_id}|${e.day_of_week}|${e.period}`;
    teacherSlots.set(k, (teacherSlots.get(k) ?? 0) + 1);
  }
  for (const cnt of teacherSlots.values()) {
    if (cnt > 1) score -= (cnt - 1) * 5_000;
  }

  // 教員グループ重複 (-4500/件)
  const groupSlots = new Map<string, number>();
  for (const e of entries) {
    if (!e.teacher_group_id) continue;
    const k = `${e.teacher_group_id}|${e.day_of_week}|${e.period}`;
    groupSlots.set(k, (groupSlots.get(k) ?? 0) + 1);
  }
  for (const cnt of groupSlots.values()) {
    if (cnt > 1) score -= (cnt - 1) * 4_500;
  }

  // 施設競合 (-1500/件)
  const facSlots = new Map<string, number>();
  for (const e of entries) {
    const fid = subjectFacility[e.subject];
    if (!fid) continue;
    const k = `${fid}|${e.day_of_week}|${e.period}`;
    facSlots.set(k, (facSlots.get(k) ?? 0) + 1);
  }
  for (const cnt of facSlots.values()) {
    if (cnt > 1) score -= (cnt - 1) * 1_500;
  }

  // 教員日・週コマ数超過 (-1000/件)
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
    if (limit != null && cnt > limit) score -= (cnt - limit) * 1_000;
  }
  for (const [tid, cnt] of teacherWeekly) {
    const limit = teacherConstraints[tid]?.max_weekly;
    if (limit != null && cnt > limit) score -= (cnt - limit) * 1_000;
  }

  // requires_double 未達 (-1200/件)
  const doubleCounts = new Map<string, number>();
  for (const e of entries) {
    if (!subjectPlacement[e.subject]?.requires_double) continue;
    const k = `${e.grade}|${e.class_name}|${e.day_of_week}|${e.subject}`;
    doubleCounts.set(k, (doubleCounts.get(k) ?? 0) + 1);
  }
  for (const cnt of doubleCounts.values()) {
    if (cnt % 2 !== 0) score -= 1_200;
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
  const specialClassKeys = new Set(
    params.classes
      .filter((cls) => cls.isSpecial)
      .map((cls) => `${cls.grade}|${cls.class_name}`),
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
    placed_count: placed.size,
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
        specialClassKeys.has(`${eA.grade}|${eA.class_name}`),
        eA.subject,
        eB.day_of_week,
        eB.period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
        groupSubjects,
      );
      if (!newAssignA) {
        if (eA.teacher_id)
          markTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
        if (eB.teacher_id)
          markTeacher(usage, eB.teacher_id, eB.day_of_week, eB.period);
        if (fidA) facilityUsage.add(`${fidA}|${eA.day_of_week}|${eA.period}`);
        if (fidB) facilityUsage.add(`${fidB}|${eB.day_of_week}|${eB.period}`);
        continue;
      }
      markTeacher(usage, newAssignA.usageKey, eB.day_of_week, eB.period);
      const newAssignB = findTeacherOrGroup(
        eB.grade,
        specialClassKeys.has(`${eB.grade}|${eB.class_name}`),
        eB.subject,
        eA.day_of_week,
        eA.period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
        groupSubjects,
      );
      if (!newAssignB) {
        unmarkTeacher(usage, newAssignA.usageKey, eB.day_of_week, eB.period);
        if (eA.teacher_id)
          markTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
        if (eB.teacher_id)
          markTeacher(usage, eB.teacher_id, eB.day_of_week, eB.period);
        if (fidA) facilityUsage.add(`${fidA}|${eA.day_of_week}|${eA.period}`);
        if (fidB) facilityUsage.add(`${fidB}|${eB.day_of_week}|${eB.period}`);
        continue;
      }
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
        specialClassKeys.has(`${eA.grade}|${eA.class_name}`),
        eA.subject,
        newDay,
        newPeriod,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
        groupSubjects,
      );
      if (!newAssign) {
        if (eA.teacher_id)
          markTeacher(usage, eA.teacher_id, eA.day_of_week, eA.period);
        if (fidOld)
          facilityUsage.add(`${fidOld}|${eA.day_of_week}|${eA.period}`);
        continue;
      }
      const newE: TimetableEntry = {
        ...eA,
        day_of_week: newDay,
        period: newPeriod,
        teacher_id: newAssign.teacher_id,
        teacher_group_id: newAssign.teacher_group_id,
      };

      placed.delete(keyA);
      placed.set(newKey, newE);
      markTeacher(usage, newAssign.usageKey, newDay, newPeriod);
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
    placed_count: bestEntries.length,
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
  const endMs = startMs + time_limit * 1000;

  const classes: ClassInfo[] = [];
  for (const g of structure.grades || []) {
    for (const cn of g.classes || [])
      classes.push({ grade: g.grade, class_name: cn, isSpecial: false });
    for (const cn of g.special_classes || [])
      classes.push({ grade: g.grade, class_name: cn, isSpecial: true });
  }

  if (classes.length === 0)
    return { entries: [], placed_count: 0, required_count: 0 };

  const classInfoByKey = new Map(
    classes.map((cls) => [`${cls.grade}|${cls.class_name}`, cls] as const),
  );
  const pairingLookup = buildPairingLookup(subject_pairings);

  const fixedSlotKeys = new Set<string>();
  let fixedEntries: TimetableEntry[] = [];
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
        teacher_group_id: entry.teacher_group_id ?? null,
        alt_subject: entry.alt_subject ?? null,
        alt_teacher_id: entry.alt_teacher_id ?? null,
        alt_teacher_group_id: entry.alt_teacher_group_id ?? null,
      });
    }
  }

  fixedEntries = expandFixedEntriesWithPairings(
    fixedEntries,
    fixedSlotKeys,
    pairingLookup,
    classInfoByKey,
  );

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
        if (fe.alt_subject) {
          fixedCounts[fe.alt_subject] = (fixedCounts[fe.alt_subject] || 0) + 1;
        }
      }
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

  const sequenceTasks: RepairTask[] = [];
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

      const baseParticipants: RepairTaskParticipant[] = [
        {
          grade: cls.grade,
          class_name: cls.class_name,
          isSpecial: cls.isSpecial,
          subject: seq.subject_a,
          offset: 0,
        },
        {
          grade: cls.grade,
          class_name: cls.class_name,
          isSpecial: cls.isSpecial,
          subject: seq.subject_b,
          offset: 1,
        },
      ];

      sequenceTasks.push({
        sharedAssignment: false,
        participants: expandParticipantsWithPairings(
          baseParticipants,
          pairingLookup,
          classInfoByKey,
          classRequiredSlots,
        ),
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
    subjectConstraints: data.subject_constraints || {},
    lunchAfterPeriod,
    crossGradeGroups: cross_grade_groups,
    subjectPairings: subject_pairings,
    altTasks,
    classGroupTasks,
    sequenceTasks,
    teacherConstraints: teacher_constraints,
    subjectFacility: subject_facility,
  };

  // ── フェーズ1: 構築探索（全コマ充足優先） ──
  let bestResult: TryOnceResult | null = null;
  let bestScore = -Infinity;
  let attempts = 0;

  while (Date.now() < endMs) {
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
    if (bestResult && bestResult.placed_count >= bestResult.required_count) {
      break;
    }
  }

  if (!bestResult) {
    bestResult = {
      entries: fixedEntries,
      placed_count: fixedEntries.length,
      required_count: fixedEntries.length,
    };
  }

  const remainingMs = endMs - Date.now();
  const hasStructuredConstraints =
    class_groups.length > 0 ||
    cross_grade_groups.length > 0 ||
    subject_pairings.length > 0 ||
    alt_week_pairs.length > 0 ||
    subject_sequences.length > 0;
  const hasUnassignedEntries = bestResult.entries.some(
    (entry) => entry.subject && !entry.teacher_id && !entry.teacher_group_id,
  );
  if (
    !bestResult ||
    bestResult.placed_count < bestResult.required_count ||
    remainingMs <= 200 ||
    hasStructuredConstraints ||
    hasUnassignedEntries
  ) {
    return bestResult;
  }

  // ── フェーズ2: 全コマ充足後の焼きなまし局所探索 ──
  const finalResult = localSearch(bestResult, params, endMs, (saAttempts) => {
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
      attempts: attempts + saAttempts,
      placed: bestResult.placed_count,
      required: bestResult.required_count,
    });
  });

  // ── 未配置コマの診断生成 ─────────────────────────────────────────
  try {
    const diagnostics: SolverDiagnostic[] = [];

    const placedEntries = finalResult.entries || [];
    const placedMap = new Set<string>(
      placedEntries.map(
        (e) => `${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}`,
      ),
    );

    // required counts per class/subject (from classRequiredSlots)
    const requiredCounts: Record<string, Record<string, number>> = {};
    for (const [key, arr] of Object.entries(classRequiredSlots)) {
      requiredCounts[key] = {};
      for (const s of arr)
        requiredCounts[key][s] = (requiredCounts[key][s] || 0) + 1;
    }

    // placed counts per class/subject
    const placedCounts: Record<string, Record<string, number>> = {};
    for (const e of placedEntries) {
      const k = `${e.grade}|${e.class_name}`;
      placedCounts[k] = placedCounts[k] || {};
      if (e.subject)
        placedCounts[k][e.subject] = (placedCounts[k][e.subject] || 0) + 1;
      if (e.alt_subject)
        placedCounts[k][e.alt_subject] =
          (placedCounts[k][e.alt_subject] || 0) + 1;
    }

    // helper: check slot-level permissibility (ignoring teacher availability)
    const facilityUsage: FacilityUsage = new Set();
    for (const e of placedEntries) {
      const fid = params.subjectFacility[e.subject];
      if (fid) facilityUsage.add(`${fid}|${e.day_of_week}|${e.period}`);
    }

    const groupSubjects = new Set<string>(
      (params.teacherGroups || []).flatMap((g) => g.subjects || []),
    );

    const usageForCheck = makeUsage();
    for (const e of placedEntries) {
      if (e.teacher_id)
        markTeacher(usageForCheck, e.teacher_id, e.day_of_week, e.period);
      else if (e.teacher_group_id)
        markTeacher(usageForCheck, e.teacher_group_id, e.day_of_week, e.period);
      if (e.alt_teacher_id)
        markTeacher(usageForCheck, e.alt_teacher_id, e.day_of_week, e.period);
      else if (e.alt_teacher_group_id)
        markTeacher(
          usageForCheck,
          e.alt_teacher_group_id,
          e.day_of_week,
          e.period,
        );
    }

    const checkSlotOk = (
      grade: number,
      class_name: string,
      subject: string,
      day: DayOfWeek,
      period: Period,
    ): boolean => {
      const key = `${grade}|${class_name}|${day}|${period}`;
      if (params.fixedSlotKeys.has(key)) return false;
      if (placedMap.has(key)) return false;
      const sp = params.subjectPlacement[subject] || ({} as SubjectPlacement);
      if (sp.allowed_days && !sp.allowed_days.includes(day)) return false;
      if (sp.allowed_periods && !sp.allowed_periods.includes(period))
        return false;
      // max_daily
      if (sp.max_daily != null) {
        const cur = placedEntries.filter(
          (e) =>
            e.grade === grade &&
            e.class_name === class_name &&
            e.subject === subject &&
            e.day_of_week === day,
        ).length;
        if (cur >= sp.max_daily) return false;
      }
      // max_afternoon_daily
      if (
        sp.max_afternoon_daily != null &&
        (period as number) > params.lunchAfterPeriod
      ) {
        const curAf = placedEntries.filter(
          (e) =>
            e.grade === grade &&
            e.class_name === class_name &&
            e.subject === subject &&
            e.day_of_week === day &&
            (e.period as number) > params.lunchAfterPeriod,
        ).length;
        if (curAf >= (sp.max_afternoon_daily ?? 0)) return false;
      }
      // facility conflict
      const fid = params.subjectFacility[subject];
      if (fid && facilityUsage.has(`${fid}|${day}|${period}`)) return false;
      return true;
    };

    for (const [classKey, subjCounts] of Object.entries(requiredCounts)) {
      const [gradeStr, className] = classKey.split("|");
      const grade = Number(gradeStr);
      const clsInfo = params.classes.find(
        (c) => c.grade === grade && c.class_name === className,
      );
      const isSpecial = clsInfo?.isSpecial ?? false;
      for (const [subject, reqCnt] of Object.entries(subjCounts)) {
        const placedCnt = placedCounts[classKey]?.[subject] || 0;
        const missing = Math.max(0, reqCnt - placedCnt);
        if (missing <= 0) continue;

        // try to find any feasible slot and any feasible teacher for that slot
        let anySlotOk = false;
        let anySlotWithTeacher = false;
        for (const day of DAYS) {
          for (const period of PERIODS) {
            if (!checkSlotOk(grade, className, subject, day, period)) continue;
            anySlotOk = true;
            const assign = findTeacherOrGroup(
              grade,
              isSpecial,
              subject,
              day,
              period,
              params.teachers,
              params.teacherGroups,
              usageForCheck,
              params.teacherConstraints,
              groupSubjects,
            );
            if (assign) {
              anySlotWithTeacher = true;
              break;
            }
          }
          if (anySlotWithTeacher) break;
        }

        let reason = "不明な理由";
        if (anySlotWithTeacher)
          reason =
            "理論上配置可能な時限と担当候補が存在しますが、ソルバーで配置されませんでした";
        else if (anySlotOk)
          reason =
            "配置可能な時限はありますが、担当候補が見つかりませんでした（教員不足／既定上限等）";
        else
          reason =
            "時限制約・施設・固定コマなどにより配置可能な時限が存在しません";

        diagnostics.push({
          grade,
          class_name: className,
          subject,
          missing,
          reason,
        });
      }
    }

    finalResult.diagnostics = diagnostics;
  } catch {
    // 診断の生成は補助情報なので失敗してもソルバー本体には影響させない
    finalResult.diagnostics = [];
  }

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
        diagnostics: result.diagnostics ?? [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      self.postMessage({ type: "error", message });
    }
  }
};
