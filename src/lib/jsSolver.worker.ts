/**
 * jsSolver.worker.ts
 * ブラウザ内で動作する時間割自動生成ソルバー（Web Worker）
 * グリーディ解法: 難タスク優先の多回構築 + 未配置回収
 */

import { DAYS, PERIODS } from "@/constants";
import type {
  ClassGroup,
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
  slots: Map<string, number>; // `${id}|${day}|${period}` → 参照カウント
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
  classGroups: ClassGroup[];
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

function getSubjectPairingKey(pairing: SubjectPairing): string {
  const endpointA = `${pairing.classA}|${pairing.subjectA}`;
  const endpointB = `${pairing.classB}|${pairing.subjectB}`;
  return `${[endpointA, endpointB].sort().join("<->")}|${pairing.grade}`;
}

function dedupeSubjectPairings(
  subjectPairings: SubjectPairing[],
): SubjectPairing[] {
  const seen = new Set<string>();
  const deduped: SubjectPairing[] = [];
  for (const pairing of subjectPairings || []) {
    const key = getSubjectPairingKey(pairing);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(pairing);
  }
  return deduped;
}

function markTeacher(
  u: TeacherUsageState,
  id: string,
  day: DayOfWeek,
  period: Period,
): void {
  const sk = `${id}|${day}|${period}`;
  u.slots.set(sk, (u.slots.get(sk) ?? 0) + 1);
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
  const sk = `${id}|${day}|${period}`;
  const cnt = u.slots.get(sk) ?? 0;
  if (cnt <= 1) u.slots.delete(sk);
  else u.slots.set(sk, cnt - 1);
  const dk = `${id}|${day}`;
  u.daily.set(dk, Math.max(0, (u.daily.get(dk) ?? 1) - 1));
  u.weekly.set(id, Math.max(0, (u.weekly.get(id) ?? 1) - 1));
}

function calcConsecutiveAfterPlace(
  slots: Map<string, number>,
  id: string,
  day: DayOfWeek,
  period: Period,
): number {
  let run = 1;
  for (let p = (period as number) - 1; p >= 1; p--) {
    if ((slots.get(`${id}|${day}|${p}`) ?? 0) > 0) run++;
    else break;
  }
  for (let p = (period as number) + 1; p <= 6; p++) {
    if ((slots.get(`${id}|${day}|${p}`) ?? 0) > 0) run++;
    else break;
  }
  return run;
}

function getTeacherLoadPenalty(
  teacherId: string,
  day: DayOfWeek,
  period: Period,
  usage: TeacherUsageState,
  teacherConstraints: Record<string, TeacherConstraintSettings>,
  allowOverflow: boolean,
): number | null {
  const constraint = teacherConstraints[teacherId];
  if (!constraint) return 0;

  const nextWeekly = (usage.weekly.get(teacherId) ?? 0) + 1;
  const nextDaily = (usage.daily.get(`${teacherId}|${day}`) ?? 0) + 1;
  const nextConsecutive = calcConsecutiveAfterPlace(
    usage.slots,
    teacherId,
    day,
    period,
  );

  if (!allowOverflow) {
    if (constraint.max_weekly != null && nextWeekly > constraint.max_weekly) {
      return null;
    }
    if (constraint.max_daily != null && nextDaily > constraint.max_daily) {
      return null;
    }
    if (
      constraint.max_consecutive != null &&
      nextConsecutive > constraint.max_consecutive
    ) {
      return null;
    }
    return 0;
  }

  let penalty = 0;
  if (constraint.max_weekly != null) {
    penalty += Math.max(0, nextWeekly - constraint.max_weekly) * 100;
  }
  if (constraint.max_daily != null) {
    penalty += Math.max(0, nextDaily - constraint.max_daily) * 1_000;
  }
  if (constraint.max_consecutive != null) {
    penalty +=
      Math.max(0, nextConsecutive - constraint.max_consecutive) * 10_000;
  }
  return penalty;
}

// ── 教員が指定スロットで使用中かを確認（直接配置 + グループ経由の両方） ──

function isTeacherBusyInSlot(
  teacherId: string,
  day: DayOfWeek,
  period: Period,
  usage: TeacherUsageState,
  teacherGroups: TeacherGroup[],
): boolean {
  if ((usage.slots.get(`${teacherId}|${day}|${period}`) ?? 0) > 0) return true;
  for (const group of teacherGroups) {
    if (
      group.teacher_ids?.includes(teacherId) &&
      (usage.slots.get(`${group.id}|${day}|${period}`) ?? 0) > 0
    ) {
      return true;
    }
  }
  return false;
}

// ヘルパ: 使用状況オブジェクトを作成
function makeUsage(): TeacherUsageState {
  return {
    slots: new Map<string, number>(),
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

  for (const pairing of dedupeSubjectPairings(subjectPairings || [])) {
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
  classGroups: ClassGroup[],
  crossGradeGroups: CrossGradeGroup[],
  normalizeEntry: (entry: TimetableEntry) => TimetableEntry,
): TimetableEntry[] {
  const normalizedEntries = entries.map((entry) => normalizeEntry(entry));
  const expanded = new Map(
    normalizedEntries.map((entry) => [
      `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`,
      entry,
    ]),
  );
  const queue = [...normalizedEntries];

  const enqueueEntry = (candidate: TimetableEntry) => {
    const classKey = `${candidate.grade}|${candidate.class_name}`;
    if (!classInfoByKey.has(classKey)) return;

    const normalized = normalizeEntry(candidate);
    const slotKey = `${normalized.grade}|${normalized.class_name}|${normalized.day_of_week}|${normalized.period}`;
    if (expanded.has(slotKey)) return;

    expanded.set(slotKey, normalized);
    fixedSlotKeys.add(slotKey);
    queue.push(normalized);
  };

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

      enqueueEntry({
        day_of_week: entry.day_of_week,
        period: entry.period,
        grade: entry.grade,
        class_name: target.class_name,
        subject: target.subject,
        teacher_id: null,
        teacher_group_id: null,
      });
    }

    for (const group of classGroups) {
      if (group.grade !== entry.grade) continue;
      if (!group.classes.includes(entry.class_name)) continue;
      if (group.split_subjects?.includes(entry.subject)) continue;

      for (const className of group.classes) {
        if (className === entry.class_name) continue;
        enqueueEntry({
          ...entry,
          class_name: className,
        });
      }
    }

    for (const group of crossGradeGroups) {
      if (group.subject !== entry.subject) continue;
      if (
        !group.participants.some(
          (participant) =>
            participant.grade === entry.grade &&
            participant.class_name === entry.class_name,
        )
      ) {
        continue;
      }

      for (const participant of group.participants) {
        if (
          participant.grade === entry.grade &&
          participant.class_name === entry.class_name
        ) {
          continue;
        }
        enqueueEntry({
          ...entry,
          grade: participant.grade,
          class_name: participant.class_name,
        });
      }
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

  return (assignmentOptions + 1) * slotFreedom;
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
    overloadPenalty: number;
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
        a.overloadPenalty - b.overloadPenalty ||
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
    return collectTeacherCandidatesWithOverflow(false);
  };

  const collectTeacherCandidatesWithOverflow = (
    allowOverflow: boolean,
  ): AssignmentCandidate[] => {
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
      const overloadPenalty = getTeacherLoadPenalty(
        teacher.id,
        day,
        period,
        usage,
        teacherConstraints,
        allowOverflow,
      );
      if (overloadPenalty == null) continue;
      candidates.push({
        teacher_id: teacher.id,
        teacher_group_id: null,
        usageKey: teacher.id,
        dailyLoad: usage.daily.get(`${teacher.id}|${day}`) ?? 0,
        weeklyLoad: usage.weekly.get(teacher.id) ?? 0,
        specialization: teacher.subjects.length,
        overloadPenalty,
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
        overloadPenalty: 0,
      });
    }
    return candidates;
  };

  // 教員グループに登録されている教科はグループを優先
  const isGroupSubject = groupSubjects?.has(subject) ?? false;
  const strictTeacher = pickBestCandidate(collectTeacherCandidates());
  const strictGroup = pickBestCandidate(collectGroupCandidates());
  const relaxedTeacher = pickBestCandidate(
    collectTeacherCandidatesWithOverflow(true),
  );

  if (!isGroupSubject) {
    if (strictTeacher) return strictTeacher;
    if (strictGroup) return strictGroup;
    if (relaxedTeacher) return relaxedTeacher;
  }

  if (strictGroup) return strictGroup;

  // グループ教科でグループが見つからなかった場合は個別教員にフォールバック
  if (isGroupSubject) {
    if (strictTeacher) return strictTeacher;
    if (relaxedTeacher) return relaxedTeacher;
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
  classGroups,
  sequenceTasks,
  teacherConstraints,
  subjectFacility,
}: TryOnceParams): TryOnceResult {
  const placed = new Map<string, TimetableEntry>();
  const usage = makeUsage();
  const facilityUsage: FacilityUsage = new Set();
  // O(1) slotOk用キャッシュ
  // key: `${grade}|${className}|${day}|${subject}`
  const dailySubjectCount = new Map<string, number>();
  const afternoonSubjectCount = new Map<string, number>();
  const subjectOnDayCount = new Map<string, number>(); // alt_subjectも含む
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

  const unmarkFacility = (subject: string, day: DayOfWeek, period: Period) => {
    const fid = subjectFacility[subject];
    if (fid) facilityUsage.delete(`${fid}|${day}|${period}`);
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

  const unmarkEntryResources = (entry: TimetableEntry) => {
    if (entry.teacher_id) {
      unmarkTeacher(usage, entry.teacher_id, entry.day_of_week, entry.period);
    }
    if (entry.teacher_group_id) {
      unmarkTeacher(
        usage,
        entry.teacher_group_id,
        entry.day_of_week,
        entry.period,
      );
    }
    if (entry.alt_teacher_id) {
      unmarkTeacher(
        usage,
        entry.alt_teacher_id,
        entry.day_of_week,
        entry.period,
      );
    }
    if (entry.alt_teacher_group_id) {
      unmarkTeacher(
        usage,
        entry.alt_teacher_group_id,
        entry.day_of_week,
        entry.period,
      );
    }
    unmarkFacility(entry.subject, entry.day_of_week, entry.period);
    if (entry.alt_subject) {
      unmarkFacility(entry.alt_subject, entry.day_of_week, entry.period);
    }
  };

  const markSlotCounts = (entry: TimetableEntry) => {
    if (!entry.subject) return;
    const dk = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.subject}`;
    dailySubjectCount.set(dk, (dailySubjectCount.get(dk) ?? 0) + 1);
    if (entry.period > lunchAfterPeriod)
      afternoonSubjectCount.set(
        dk,
        (afternoonSubjectCount.get(dk) ?? 0) + 1,
      );
    subjectOnDayCount.set(dk, (subjectOnDayCount.get(dk) ?? 0) + 1);
    if (entry.alt_subject) {
      const ak = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.alt_subject}`;
      subjectOnDayCount.set(ak, (subjectOnDayCount.get(ak) ?? 0) + 1);
    }
  };

  const unmarkSlotCounts = (entry: TimetableEntry) => {
    if (!entry.subject) return;
    const dk = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.subject}`;
    const dc = (dailySubjectCount.get(dk) ?? 1) - 1;
    if (dc <= 0) dailySubjectCount.delete(dk);
    else dailySubjectCount.set(dk, dc);
    if (entry.period > lunchAfterPeriod) {
      const ac = (afternoonSubjectCount.get(dk) ?? 1) - 1;
      if (ac <= 0) afternoonSubjectCount.delete(dk);
      else afternoonSubjectCount.set(dk, ac);
    }
    const sc = (subjectOnDayCount.get(dk) ?? 1) - 1;
    if (sc <= 0) subjectOnDayCount.delete(dk);
    else subjectOnDayCount.set(dk, sc);
    if (entry.alt_subject) {
      const ak = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.alt_subject}`;
      const asc = (subjectOnDayCount.get(ak) ?? 1) - 1;
      if (asc <= 0) subjectOnDayCount.delete(ak);
      else subjectOnDayCount.set(ak, asc);
    }
  };

  const addPlacedEntry = (entry: TimetableEntry) => {
    placed.set(
      `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`,
      entry,
    );
    markEntryResources(entry);
    markSlotCounts(entry);
  };

  const removePlacedEntry = (key: string): TimetableEntry | null => {
    const entry = placed.get(key);
    if (!entry) return null;
    placed.delete(key);
    unmarkEntryResources(entry);
    unmarkSlotCounts(entry);
    return entry;
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
    const dk = `${grade}|${className}|${day}|${subject}`;
    if ((dailySubjectCount.get(dk) ?? 0) >= maxDaily) return false;
    if (sp?.max_afternoon_daily != null && period > lunchAfterPeriod) {
      if ((afternoonSubjectCount.get(dk) ?? 0) >= sp.max_afternoon_daily)
        return false;
    }
    const facilityId = subjectFacility[subject];
    if (facilityId && facilityUsage.has(`${facilityId}|${day}|${period}`))
      return false;
    // 合同クラス同期チェック: パートナークラスが別教科を置いていれば不可
    for (const group of classGroups) {
      if (group.grade !== grade) continue;
      if (!group.classes.includes(className)) continue;
      if (group.split_subjects?.includes(subject)) continue;
      for (const partnerClass of group.classes) {
        if (partnerClass === className) continue;
        const partnerEntry = placed.get(
          `${grade}|${partnerClass}|${day}|${period}`,
        );
        if (
          partnerEntry?.subject &&
          !group.split_subjects.includes(partnerEntry.subject) &&
          partnerEntry.subject !== subject
        ) {
          return false;
        }
      }
    }
    // 学年横断合同授業の同期チェック: パートナーが別教科を置いていれば不可
    for (const group of crossGradeGroups) {
      if (group.subject !== subject) continue;
      if (
        !group.participants.some(
          (p) => p.grade === grade && p.class_name === className,
        )
      )
        continue;
      for (const participant of group.participants) {
        if (participant.grade === grade && participant.class_name === className)
          continue;
        const partnerEntry = placed.get(
          `${participant.grade}|${participant.class_name}|${day}|${period}`,
        );
        if (partnerEntry?.subject && partnerEntry.subject !== subject) {
          return false;
        }
      }
    }
    // 連続日数チェック（subject_constraints.max_consecutive_days）
    const subjConstraint = subjectConstraints?.[subject];
    if (subjConstraint?.max_consecutive_days != null) {
      const dayIndex = DAYS.indexOf(day);
      let consecutive = 1;
      for (let i = dayIndex - 1; i >= 0; i--) {
        const prevDay = DAYS[i] as DayOfWeek;
        if (
          (subjectOnDayCount.get(
            `${grade}|${className}|${prevDay}|${subject}`,
          ) ?? 0) > 0
        )
          consecutive++;
        else break;
      }
      for (let i = dayIndex + 1; i < DAYS.length; i++) {
        const nextDay = DAYS[i] as DayOfWeek;
        if (
          (subjectOnDayCount.get(
            `${grade}|${className}|${nextDay}|${subject}`,
          ) ?? 0) > 0
        )
          consecutive++;
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

    const collectSharedTeacherCandidates = (allowOverflow: boolean) =>
      prioritizeWithRandomTiebreak(
        teachers.filter((teacher) => {
          if (
            teacher.unavailable_times?.some(
              (time) => time.day_of_week === day && time.period === period,
            )
          ) {
            return false;
          }
          if (
            isTeacherBusyInSlot(teacher.id, day, period, usage, teacherGroups)
          ) {
            return false;
          }
          if (!teacher.subjects.includes(primarySubject)) return false;
          if (
            !participantGrades.every((grade) =>
              teacher.target_grades.includes(grade),
            )
          ) {
            return false;
          }
          return (
            getTeacherLoadPenalty(
              teacher.id,
              day,
              period,
              usage,
              teacherConstraints,
              allowOverflow,
            ) != null
          );
        }),
        (teacher) =>
          (getTeacherLoadPenalty(
            teacher.id,
            day,
            period,
            usage,
            teacherConstraints,
            allowOverflow,
          ) ?? 0) +
          (usage.daily.get(`${teacher.id}|${day}`) ?? 0) * 10 +
          (usage.weekly.get(teacher.id) ?? 0),
      );

    const teacherCandidates = collectSharedTeacherCandidates(false);
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
          !participantGrades.every((grade) =>
            canTeacherGroupTeachSubject(group, grade, primarySubject),
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

    const relaxedTeacherCandidates = collectSharedTeacherCandidates(true);
    if (relaxedTeacherCandidates[0]) {
      return {
        teacher_id: relaxedTeacherCandidates[0].id,
        teacher_group_id: null,
        usageKey: relaxedTeacherCandidates[0].id,
      };
    }

    return null;
  };

  const placeTaskAtAnchor = (
    task: RepairTask,
    day: DayOfWeek,
    period: Period,
    countPlacement = true,
  ): boolean => {
    const targetKeys = task.participants.map(
      (participant) =>
        `${participant.grade}|${participant.class_name}|${day}|${(period + participant.offset) as Period}`,
    );

    if (targetKeys.some((key) => fixedSlotKeys.has(key) || placed.has(key))) {
      return false;
    }

    const targetsValid = task.participants.every((participant) =>
      slotOk(
        participant.grade,
        participant.class_name,
        participant.subject,
        day,
        (period + participant.offset) as Period,
      ),
    );

    if (!targetsValid) return false;

    const repairedEntries: TimetableEntry[] = [];
    if (task.sharedAssignment) {
      const sharedAssignment = findSharedAssignment(
        task.participants,
        day,
        period,
      );
      if (!sharedAssignment) return false;

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
      const tempMarked: Array<{
        id: string;
        day: DayOfWeek;
        period: Period;
      }> = [];
      let allPlaced = true;

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
          allPlaced = false;
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

      for (const marked of tempMarked) {
        unmarkTeacher(usage, marked.id, marked.day, marked.period);
      }

      if (!allPlaced) return false;
    }

    if (countPlacement) {
      placed_count += task.participants.length;
    }
    repairedEntries.forEach(addPlacedEntry);
    return true;
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

    // まず教員付きで全スロットを試す
    for (const { day, period } of prioritizedAnchors) {
      if (placeTaskAtAnchor(task, day, period)) return true;
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
          const newEntry: TimetableEntry = {
            day_of_week: day,
            period,
            grade: p.grade,
            class_name: p.class_name,
            subject: grp.subject,
            teacher_id: sharedAssignment.teacher_id,
            teacher_group_id: sharedAssignment.teacher_group_id,
          };
          placed.set(`${p.grade}|${p.class_name}|${day}|${period}`, newEntry);
          markSlotCounts(newEntry);
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
        const newEntry: TimetableEntry = {
          day_of_week: day,
          period,
          grade,
          class_name: cn,
          subject,
          teacher_id: sharedAssignment.teacher_id,
          teacher_group_id: sharedAssignment.teacher_group_id,
        };
        placed.set(`${grade}|${cn}|${day}|${period}`, newEntry);
        markSlotCounts(newEntry);
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
    const task: RepairTask = {
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
    };

    if (!tryRepairTask(task)) {
      pendingRepairTasks.push({
        ...task,
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
    const task: RepairTask = {
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
    };

    if (!tryRepairTask(task)) {
      pendingRepairTasks.push({
        ...task,
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
    const task: RepairTask = {
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
    };

    if (!tryRepairTask(task)) {
      pendingRepairTasks.push({
        ...task,
      });
    }
  }

  // 6. 単体タスク
  for (const {
    grade,
    className,
    subject,
    isSpecial,
  } of prioritizeWithRandomTiebreak(soloTasks, (task) => {
    let available = 0;
    for (const day of DAYS) {
      for (const period of PERIODS) {
        if (slotOk(task.grade, task.className, task.subject, day as DayOfWeek, period as Period))
          available++;
      }
    }
    return available;
  })) {
    const task: RepairTask = {
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
    };

    if (!tryRepairTask(task)) {
      pendingRepairTasks.push({
        ...task,
      });
    }
  }

  // ── displacement repair: 既存エントリを別スロットへ退避して未配置タスクを差し込む ──
  const tryDisplacementRepair = (task: RepairTask): boolean => {
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

      const blockingEntries = targetKeys
        .map((key) => ({ key, entry: placed.get(key) }))
        .filter(
          (
            item,
          ): item is {
            key: string;
            entry: TimetableEntry;
          } => item.entry != null,
        );
      if (blockingEntries.length === 0) continue;
      if (blockingEntries.some(({ entry }) => entry.cell_group_id)) continue;

      const removedEntries: TimetableEntry[] = [];
      for (const { key } of blockingEntries) {
        const removed = removePlacedEntry(key);
        if (removed) removedEntries.push(removed);
      }

      const relocatedKeys: string[] = [];
      let relocatedAll = true;
      const reservedTargetKeys = new Set(targetKeys);

      // 合同クラスで同一教科・同一スロットのエントリをグループ化し、
      // 同一スロットへ一括退避する
      type BlockerGroup = {
        entries: TimetableEntry[];
        isGrouped: boolean;
      };
      const blockerGroups: BlockerGroup[] = [];
      const assignedToGroup = new Set<string>();

      for (const removed of removedEntries) {
        const removedKey = `${removed.grade}|${removed.class_name}|${removed.day_of_week}|${removed.period}`;
        if (assignedToGroup.has(removedKey)) continue;
        assignedToGroup.add(removedKey);

        const linked: TimetableEntry[] = [removed];
        let isGrouped = false;

        for (const other of removedEntries) {
          const otherKey = `${other.grade}|${other.class_name}|${other.day_of_week}|${other.period}`;
          if (assignedToGroup.has(otherKey)) continue;
          if (other.subject !== removed.subject) continue;
          if (other.grade !== removed.grade) continue;

          const inSameGroup =
            classGroups.some(
              (g) =>
                g.grade === removed.grade &&
                !g.split_subjects?.includes(removed.subject) &&
                g.classes.includes(removed.class_name) &&
                g.classes.includes(other.class_name),
            ) ||
            crossGradeGroups.some(
              (g) =>
                g.subject === removed.subject &&
                g.participants.some(
                  (p) =>
                    p.grade === removed.grade &&
                    p.class_name === removed.class_name,
                ) &&
                g.participants.some(
                  (p) =>
                    p.grade === other.grade &&
                    p.class_name === other.class_name,
                ),
            );

          if (inSameGroup) {
            linked.push(other);
            assignedToGroup.add(otherKey);
            isGrouped = true;
          }
        }

        blockerGroups.push({ entries: linked, isGrouped });
      }

      // 曜日制限のない教科は金曜日を優先して退避 → Mon-Thu を制限付き教科のために温存
      const nonFriDays = DAYS.filter((d) => d !== "金");

      for (const { entries: groupEntries, isGrouped } of blockerGroups) {
        if (!relocatedAll) break;

        if (isGrouped) {
          // グループエントリ: 全員を同一スロットへ退避
          const groupSubjectSp = subjectPlacement?.[groupEntries[0]?.subject];
          const groupCanGoFriday =
            !groupSubjectSp?.allowed_days?.length ||
            groupSubjectSp.allowed_days.includes("金");
          const groupRelSlots = groupCanGoFriday
            ? [
                ...PERIODS.map((p) => ({
                  day: "金" as DayOfWeek,
                  period: p as Period,
                })),
                ...shuffle(
                  nonFriDays.flatMap((d) =>
                    PERIODS.map((p) => ({ day: d, period: p as Period })),
                  ),
                ),
              ]
            : shuffle(
                DAYS.flatMap((d) =>
                  PERIODS.map((p) => ({ day: d, period: p as Period })),
                ),
              );
          let groupRelocated = false;
          for (const relSlot of groupRelSlots) {
            const allRelKeys = groupEntries.map(
              (e) =>
                `${e.grade}|${e.class_name}|${relSlot.day}|${relSlot.period}`,
            );
            if (
              allRelKeys.some(
                (k) =>
                  reservedTargetKeys.has(k) || fixedSlotKeys.has(k),
              )
            )
              continue;
            if (
              !groupEntries.every((e) =>
                slotOk(
                  e.grade,
                  e.class_name,
                  e.subject,
                  relSlot.day,
                  relSlot.period,
                ),
              )
            )
              continue;
            const sharedAssignment = findSharedAssignment(
              groupEntries.map((e) => ({
                grade: e.grade,
                class_name: e.class_name,
                isSpecial:
                  classInfoByKey.get(`${e.grade}|${e.class_name}`)
                    ?.isSpecial ?? false,
                subject: e.subject,
                offset: 0,
              })),
              relSlot.day,
              relSlot.period,
            );
            if (!sharedAssignment) continue;
            for (const e of groupEntries) {
              const relKey = `${e.grade}|${e.class_name}|${relSlot.day}|${relSlot.period}`;
              const newEntry: TimetableEntry = {
                ...e,
                day_of_week: relSlot.day,
                period: relSlot.period,
                teacher_id: sharedAssignment.teacher_id,
                teacher_group_id: sharedAssignment.teacher_group_id,
              };
              placed.set(relKey, newEntry);
              markSlotCounts(newEntry);
              relocatedKeys.push(relKey);
            }
            markTeacher(
              usage,
              sharedAssignment.usageKey,
              relSlot.day,
              relSlot.period,
            );
            markFacility(groupEntries[0].subject, relSlot.day, relSlot.period);
            groupRelocated = true;
            break;
          }
          if (!groupRelocated) {
            relocatedAll = false;
          }
        } else {
          // 非グループ: 個別に退避（元のロジック）
          for (const entry of groupEntries) {
            const isSpecial =
              classInfoByKey.get(`${entry.grade}|${entry.class_name}`)
                ?.isSpecial ?? false;
            const entrySp = subjectPlacement?.[entry.subject];
            const entryCanGoFriday =
              !entrySp?.allowed_days?.length ||
              entrySp.allowed_days.includes("金");
            const relocationSlots = entryCanGoFriday
              ? [
                  ...PERIODS.map((p) => ({
                    day: "金" as DayOfWeek,
                    period: p as Period,
                  })),
                  ...shuffle(
                    nonFriDays.flatMap((d) =>
                      PERIODS.map((p) => ({ day: d, period: p as Period })),
                    ),
                  ),
                ]
              : shuffle(
                  DAYS.flatMap((d) =>
                    PERIODS.map((p) => ({ day: d, period: p as Period })),
                  ),
                );

            let relocated = false;
            for (const relocationSlot of relocationSlots) {
              const relocationKey = `${entry.grade}|${entry.class_name}|${relocationSlot.day}|${relocationSlot.period}`;
              if (reservedTargetKeys.has(relocationKey)) continue;
              if (
                !slotOk(
                  entry.grade,
                  entry.class_name,
                  entry.subject,
                  relocationSlot.day,
                  relocationSlot.period,
                )
              ) {
                continue;
              }

              const assignment = findTeacherOrGroup(
                entry.grade,
                isSpecial,
                entry.subject,
                relocationSlot.day,
                relocationSlot.period,
                teachers,
                teacherGroups,
                usage,
                teacherConstraints,
                groupSubjects,
              );

              if (!assignment) continue;

              const relocatedEntry: TimetableEntry = {
                ...entry,
                day_of_week: relocationSlot.day,
                period: relocationSlot.period,
                teacher_id: assignment.teacher_id,
                teacher_group_id: assignment.teacher_group_id,
              };

              addPlacedEntry(relocatedEntry);
              relocatedKeys.push(relocationKey);
              relocated = true;
              break;
            }

            if (!relocated) {
              relocatedAll = false;
              break;
            }
          }
        }
      }

      if (relocatedAll) {
        if (placeTaskAtAnchor(task, day, period)) {
          return true;
        }
      }

      for (const key of relocatedKeys) {
        removePlacedEntry(key);
      }
      for (const entry of removedEntries) {
        addPlacedEntry(entry);
      }
    }

    return false;
  };

  for (const repairTask of prioritizeWithRandomTiebreak(
    pendingRepairTasks,
    (task) => {
      let total = 0;
      for (const p of task.participants) {
        for (const day of DAYS)
          for (const period of PERIODS)
            if (slotOk(p.grade, p.class_name, p.subject, day as DayOfWeek, period as Period))
              total++;
      }
      return total;
    },
  )) {
    if (!tryRepairTask(repairTask)) {
      tryDisplacementRepair(repairTask);
    }
  }

  const isLegitimateSharedAssignment = (entries: TimetableEntry[]): boolean => {
    if (entries.length <= 1) return false;
    const subject = entries[0]?.subject;
    if (!subject || !entries.every((entry) => entry.subject === subject)) {
      return false;
    }

    const cellGroupId = entries[0]?.cell_group_id;
    if (
      cellGroupId &&
      entries.every((entry) => entry.cell_group_id === cellGroupId)
    ) {
      return true;
    }

    const classGroupTask = classGroupTasks.find(
      (task) =>
        task.subject === subject &&
        task.classNames.length === entries.length &&
        entries.every(
          (entry) =>
            entry.grade === task.grade &&
            task.classNames.includes(entry.class_name),
        ),
    );
    if (classGroupTask) return true;

    const crossGradeGroup = crossGradeGroups.find(
      (group) =>
        group.subject === subject &&
        group.participants.length === entries.length &&
        entries.every((entry) =>
          group.participants.some(
            (participant) =>
              participant.grade === entry.grade &&
              participant.class_name === entry.class_name,
          ),
        ),
    );

    return Boolean(crossGradeGroup);
  };

  const reassignEntryTeacher = (
    key: string,
    entry: TimetableEntry,
  ): boolean => {
    const isSpecial =
      classInfoByKey.get(`${entry.grade}|${entry.class_name}`)?.isSpecial ??
      false;
    const removed = removePlacedEntry(key);
    if (!removed) return false;

    const assignment = findTeacherOrGroup(
      entry.grade,
      isSpecial,
      entry.subject,
      entry.day_of_week,
      entry.period,
      teachers,
      teacherGroups,
      usage,
      teacherConstraints,
      groupSubjects,
    );

    if (assignment) {
      addPlacedEntry({
        ...removed,
        teacher_id: assignment.teacher_id,
        teacher_group_id: assignment.teacher_group_id,
      });
      return (
        (removed.teacher_id ?? null) !== (assignment.teacher_id ?? null) ||
        (removed.teacher_group_id ?? null) !==
          (assignment.teacher_group_id ?? null)
      );
    }

    // 同スロットで教員が見つからない場合、別スロットへ移動を試みる
    const relocated = relocateEntryWithTeacher(removed, isSpecial);
    if (relocated) return true;

    // 移動も不可能な場合は元に戻す（教員はそのまま維持）
    addPlacedEntry(removed);
    return false;
  };

  /** エントリを教員付きで別スロットへ移動する */
  const relocateEntryWithTeacher = (
    entry: TimetableEntry,
    isSpecial: boolean,
  ): boolean => {
    // 合同クラス・学年横断合同授業のパートナーエントリを取得（まだplaced内に存在する）
    const groupPartners: TimetableEntry[] = [];
    for (const group of classGroups) {
      if (group.grade !== entry.grade) continue;
      if (!group.classes.includes(entry.class_name)) continue;
      if (group.split_subjects?.includes(entry.subject)) continue;
      for (const cn of group.classes) {
        if (cn === entry.class_name) continue;
        const partnerKey = `${group.grade}|${cn}|${entry.day_of_week}|${entry.period}`;
        const partner = placed.get(partnerKey);
        if (partner?.subject === entry.subject) {
          groupPartners.push(partner);
        }
      }
    }
    for (const group of crossGradeGroups) {
      if (group.subject !== entry.subject) continue;
      if (
        !group.participants.some(
          (p) => p.grade === entry.grade && p.class_name === entry.class_name,
        )
      )
        continue;
      for (const participant of group.participants) {
        if (
          participant.grade === entry.grade &&
          participant.class_name === entry.class_name
        )
          continue;
        const partnerKey = `${participant.grade}|${participant.class_name}|${entry.day_of_week}|${entry.period}`;
        const partner = placed.get(partnerKey);
        if (partner?.subject === entry.subject) {
          groupPartners.push(partner);
        }
      }
    }

    const relocSlots = shuffle(
      DAYS.flatMap((d) => PERIODS.map((p) => ({ day: d, period: p }))),
    );

    if (groupPartners.length > 0) {
      // グループエントリ: 全パートナーを同一スロットへ一括移動
      const allEntries = [entry, ...groupPartners];
      for (const { day, period } of relocSlots) {
        if (day === entry.day_of_week && period === entry.period) continue;
        if (
          !allEntries.every((e) =>
            slotOk(e.grade, e.class_name, e.subject, day, period),
          )
        )
          continue;
        const sharedAssignment = findSharedAssignment(
          allEntries.map((e) => ({
            grade: e.grade,
            class_name: e.class_name,
            isSpecial:
              classInfoByKey.get(`${e.grade}|${e.class_name}`)?.isSpecial ??
              false,
            subject: e.subject,
            offset: 0,
          })),
          day,
          period,
        );
        if (!sharedAssignment) continue;
        // パートナーを元スロットから削除し、新スロットへ全員配置
        for (const p of groupPartners) {
          removePlacedEntry(
            `${p.grade}|${p.class_name}|${p.day_of_week}|${p.period}`,
          );
        }
        for (const e of allEntries) {
          const newEntry: TimetableEntry = {
            ...e,
            day_of_week: day,
            period,
            teacher_id: sharedAssignment.teacher_id,
            teacher_group_id: sharedAssignment.teacher_group_id,
          };
          placed.set(`${e.grade}|${e.class_name}|${day}|${period}`, newEntry);
          markSlotCounts(newEntry);
        }
        markTeacher(usage, sharedAssignment.usageKey, day, period);
        markFacility(entry.subject, day, period);
        return true;
      }
      return false;
    }

    for (const { day, period } of relocSlots) {
      if (day === entry.day_of_week && period === entry.period) continue;
      if (!slotOk(entry.grade, entry.class_name, entry.subject, day, period)) {
        continue;
      }

      const assignment = findTeacherOrGroup(
        entry.grade,
        isSpecial,
        entry.subject,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
        groupSubjects,
      );
      if (!assignment) continue;

      addPlacedEntry({
        ...entry,
        day_of_week: day,
        period,
        teacher_id: assignment.teacher_id,
        teacher_group_id: assignment.teacher_group_id,
      });
      return true;
    }
    return false;
  };

  const getEntryTightness = (entry: TimetableEntry): number =>
    getSubjectTightness(
      entry.grade,
      classInfoByKey.get(`${entry.grade}|${entry.class_name}`)?.isSpecial ??
        false,
      entry.subject,
      teachers,
      teacherGroups,
      subjectPlacement,
    );

  const resolveTeacherConflicts = (): boolean => {
    let changed = false;

    const teacherSlotEntries = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.teacher_id || !entry.subject) continue;
      const slotKey = `${entry.teacher_id}|${entry.day_of_week}|${entry.period}`;
      const current = teacherSlotEntries.get(slotKey) ?? [];
      current.push({ key, entry });
      teacherSlotEntries.set(slotKey, current);
    }

    for (const conflictEntries of teacherSlotEntries.values()) {
      if (
        conflictEntries.length <= 1 ||
        isLegitimateSharedAssignment(conflictEntries.map(({ entry }) => entry))
      ) {
        continue;
      }

      const prioritized = prioritizeWithRandomTiebreak(
        conflictEntries,
        ({ key, entry }) =>
          (fixedSlotKeys.has(key) ? -1_000_000 : 0) + getEntryTightness(entry),
      );

      for (const item of prioritized.slice(1)) {
        if (fixedSlotKeys.has(item.key)) continue;
        changed = reassignEntryTeacher(item.key, item.entry) || changed;
      }
    }

    const groupSlotEntries = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.teacher_group_id || !entry.subject) continue;
      const slotKey = `${entry.teacher_group_id}|${entry.day_of_week}|${entry.period}`;
      const current = groupSlotEntries.get(slotKey) ?? [];
      current.push({ key, entry });
      groupSlotEntries.set(slotKey, current);
    }

    for (const conflictEntries of groupSlotEntries.values()) {
      if (
        conflictEntries.length <= 1 ||
        isLegitimateSharedAssignment(conflictEntries.map(({ entry }) => entry))
      ) {
        continue;
      }

      const prioritized = prioritizeWithRandomTiebreak(
        conflictEntries,
        ({ key, entry }) =>
          (fixedSlotKeys.has(key) ? -1_000_000 : 0) + getEntryTightness(entry),
      );

      for (const item of prioritized.slice(1)) {
        if (fixedSlotKeys.has(item.key)) continue;
        changed = reassignEntryTeacher(item.key, item.entry) || changed;
      }
    }

    return changed;
  };

  const assignTeachersToUnassignedEntries = (): boolean => {
    let changed = false;
    for (const [key, entry] of prioritizeWithRandomTiebreak(
      [...placed.entries()].filter(
        ([, currentEntry]) =>
          currentEntry.subject &&
          !currentEntry.teacher_id &&
          !currentEntry.teacher_group_id,
      ),
      ([, currentEntry]) => getEntryTightness(currentEntry),
    )) {
      changed = reassignEntryTeacher(key, entry) || changed;
    }
    return changed;
  };

  /**
   * 退避付き移動: 未割当・競合エントリを既存エントリと入れ替える
   * 移動先の既存エントリを退避し、そちらも教員付きで再配置できる場合のみ成立
   */
  const resolveByDisplacement = (): boolean => {
    let changed = false;
    const unassigned = [...placed.entries()].filter(
      ([, e]) => e.subject && !e.teacher_id && !e.teacher_group_id,
    );

    for (const [srcKey, srcEntry] of prioritizeWithRandomTiebreak(
      unassigned,
      ([, e]) => getEntryTightness(e),
    )) {
      if (fixedSlotKeys.has(srcKey)) continue;
      const isSpecial =
        classInfoByKey.get(`${srcEntry.grade}|${srcEntry.class_name}`)
          ?.isSpecial ?? false;

      const candidateSlots = shuffle(
        DAYS.flatMap((d) => PERIODS.map((p) => ({ day: d, period: p }))),
      );

      let resolved = false;
      for (const { day, period } of candidateSlots) {
        if (day === srcEntry.day_of_week && period === srcEntry.period)
          continue;
        const destKey = `${srcEntry.grade}|${srcEntry.class_name}|${day}|${period}`;
        if (fixedSlotKeys.has(destKey)) continue;
        const destEntry = placed.get(destKey);
        if (!destEntry) continue; // 空きスロットは relocateEntryWithTeacher で処理済み
        if (destEntry.cell_group_id) continue;

        // 移動先の教科がスロット制約を満たすか
        if (
          !slotOk(
            srcEntry.grade,
            srcEntry.class_name,
            srcEntry.subject,
            day,
            period,
          )
        ) {
          continue;
        }

        // 移動先で教員が割り当て可能か（仮に destEntry を外した状態で）
        const removedDest = removePlacedEntry(destKey);
        if (!removedDest) continue;
        const removedSrc = removePlacedEntry(srcKey);
        if (!removedSrc) {
          addPlacedEntry(removedDest);
          continue;
        }

        const assignmentForSrc = findTeacherOrGroup(
          srcEntry.grade,
          isSpecial,
          srcEntry.subject,
          day,
          period,
          teachers,
          teacherGroups,
          usage,
          teacherConstraints,
          groupSubjects,
        );

        if (!assignmentForSrc) {
          addPlacedEntry(removedSrc);
          addPlacedEntry(removedDest);
          continue;
        }

        // srcEntry を移動先に配置
        addPlacedEntry({
          ...removedSrc,
          day_of_week: day,
          period,
          teacher_id: assignmentForSrc.teacher_id,
          teacher_group_id: assignmentForSrc.teacher_group_id,
        });

        // destEntry を元のスロットに配置（教員を再割当）
        const destIsSpecial =
          classInfoByKey.get(`${removedDest.grade}|${removedDest.class_name}`)
            ?.isSpecial ?? false;

        if (
          slotOk(
            removedDest.grade,
            removedDest.class_name,
            removedDest.subject,
            srcEntry.day_of_week,
            srcEntry.period,
          )
        ) {
          const assignmentForDest = findTeacherOrGroup(
            removedDest.grade,
            destIsSpecial,
            removedDest.subject,
            srcEntry.day_of_week,
            srcEntry.period,
            teachers,
            teacherGroups,
            usage,
            teacherConstraints,
            groupSubjects,
          );

          if (assignmentForDest) {
            addPlacedEntry({
              ...removedDest,
              day_of_week: srcEntry.day_of_week,
              period: srcEntry.period,
              teacher_id: assignmentForDest.teacher_id,
              teacher_group_id: assignmentForDest.teacher_group_id,
            });
            changed = true;
            resolved = true;
            break;
          }
        }

        // destEntry を元の位置に戻せない → ロールバック
        removePlacedEntry(destKey);
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
      }

      if (resolved) continue;
    }

    return changed;
  };

  for (let pass = 0; pass < 8; pass++) {
    const resolvedConflicts = resolveTeacherConflicts();
    const assignedUnassigned = assignTeachersToUnassignedEntries();
    // 通常の再割当で改善がなければ退避付き移動を試みる
    if (!resolvedConflicts && !assignedUnassigned) {
      if (pass < 4 && resolveByDisplacement()) continue;
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
  const { placed_count, entries } = result;
  const withTeacher = entries.filter(
    (e) => e.teacher_id || e.teacher_group_id,
  ).length;
  const unassignedCount = Math.max(0, entries.length - withTeacher);
  let score = placed_count * 1_000_000_000 + withTeacher * 10_000_000;

  // まず全コマ充足、次に教員割当を最優先に比較する
  score -= unassignedCount * 2_000_000;

  // 教員時間重複 (-500000/件)
  const teacherSlots = new Map<string, number>();
  for (const e of entries) {
    if (!e.teacher_id) continue;
    const k = `${e.teacher_id}|${e.day_of_week}|${e.period}`;
    teacherSlots.set(k, (teacherSlots.get(k) ?? 0) + 1);
  }
  for (const cnt of teacherSlots.values()) {
    if (cnt > 1) score -= (cnt - 1) * 500_000;
  }

  // 教員グループ重複 (-450000/件)
  const groupSlots = new Map<string, number>();
  for (const e of entries) {
    if (!e.teacher_group_id) continue;
    const k = `${e.teacher_group_id}|${e.day_of_week}|${e.period}`;
    groupSlots.set(k, (groupSlots.get(k) ?? 0) + 1);
  }
  for (const cnt of groupSlots.values()) {
    if (cnt > 1) score -= (cnt - 1) * 450_000;
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

  const uniqueSubjectPairings = dedupeSubjectPairings(subject_pairings);

  const classInfoByKey = new Map(
    classes.map((cls) => [`${cls.grade}|${cls.class_name}`, cls] as const),
  );
  const pairingLookup = buildPairingLookup(uniqueSubjectPairings);
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const teacherGroupById = new Map(
    teacher_groups.map((group) => [group.id, group]),
  );

  const sanitizeExistingEntryAssignments = (
    entry: TimetableEntry,
  ): TimetableEntry => {
    const isSpecial =
      classInfoByKey.get(`${entry.grade}|${entry.class_name}`)?.isSpecial ??
      false;

    const normalizeTeacherId = (
      teacherId: string | null | undefined,
      subject: string | null | undefined,
    ): string | null => {
      if (!teacherId || !subject) return null;
      const teacher = teacherById.get(teacherId);
      if (!teacher) return null;
      if (!canTeacherTeachSubject(teacher, entry.grade, isSpecial, subject)) {
        return null;
      }
      if (
        teacher.unavailable_times?.some(
          (u) =>
            u.day_of_week === entry.day_of_week && u.period === entry.period,
        )
      ) {
        return null;
      }
      return teacherId;
    };

    const normalizeTeacherGroupId = (
      groupId: string | null | undefined,
      subject: string | null | undefined,
    ): string | null => {
      if (!groupId || !subject) return null;
      const group = teacherGroupById.get(groupId);
      if (!group) return null;
      if (!canTeacherGroupTeachSubject(group, entry.grade, subject)) {
        return null;
      }

      const members = teachers.filter((teacher) =>
        group.teacher_ids?.includes(teacher.id),
      );
      if (members.length === 0) return null;
      if (
        members.some((teacher) =>
          teacher.unavailable_times?.some(
            (u) =>
              u.day_of_week === entry.day_of_week && u.period === entry.period,
          ),
        )
      ) {
        return null;
      }

      return groupId;
    };

    const teacher_id = normalizeTeacherId(entry.teacher_id, entry.subject);
    const teacher_group_id = teacher_id
      ? null
      : normalizeTeacherGroupId(entry.teacher_group_id, entry.subject);
    const alt_teacher_id = normalizeTeacherId(
      entry.alt_teacher_id,
      entry.alt_subject,
    );
    const alt_teacher_group_id = alt_teacher_id
      ? null
      : normalizeTeacherGroupId(entry.alt_teacher_group_id, entry.alt_subject);

    return {
      ...entry,
      teacher_id,
      teacher_group_id,
      alt_teacher_id,
      alt_teacher_group_id,
    };
  };

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
      fixedEntries.push(
        sanitizeExistingEntryAssignments({
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
        }),
      );
    }
  }

  fixedEntries = expandFixedEntriesWithPairings(
    fixedEntries,
    fixedSlotKeys,
    pairingLookup,
    classInfoByKey,
    class_groups,
    cross_grade_groups,
    sanitizeExistingEntryAssignments,
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
      const subjectCounts = classRequiredSlots[key].reduce<
        Record<string, number>
      >((counts, subject) => {
        counts[subject] = (counts[subject] ?? 0) + 1;
        return counts;
      }, {});
      const pairCount = Math.min(
        subjectCounts[seq.subject_a] ?? 0,
        subjectCounts[seq.subject_b] ?? 0,
      );

      for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
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

        if (removedA === 0 || removedB === 0) break;

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
    subjectPairings: uniqueSubjectPairings,
    altTasks,
    classGroupTasks,
    classGroups: class_groups,
    sequenceTasks,
    teacherConstraints: teacher_constraints,
    subjectFacility: subject_facility,
  };

  // ── グリーディ構築: 時間制限内で多回試行し、最良結果を採用 ──
  let bestResult: TryOnceResult | null = null;
  let bestScore = -Infinity;
  let attempts = 0;

  do {
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
    } else if (attempts % 5 === 0 && bestResult) {
      // ハートビート: 改善なしでも5回に1回UI更新（試行継続中を表示）
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
    if (bestResult && bestResult.placed_count >= bestResult.required_count) {
      break;
    }
  } while (Date.now() < endMs);

  if (!bestResult) {
    bestResult = {
      entries: fixedEntries,
      placed_count: fixedEntries.length,
      required_count: fixedEntries.length,
    };
  }

  const finalResult = bestResult;

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
