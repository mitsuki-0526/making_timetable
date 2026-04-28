/**
 * jsSolver.worker.ts
 * ブラウザ内で動作する時間割自動生成ソルバー（Web Worker）
 * グリーディ解法: 難タスク優先の多回構築 + 未配置回収
 */

import { DAYS, PERIODS } from "@/constants";
import { snapshotTimetableEntriesTeacherTeams } from "@/lib/teamTeaching";
import {
  findMatchingTtAssignment,
  haveSameTeacherSet,
} from "@/lib/ttAssignments";
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
  TtAssignment,
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
  ttAssignments: TtAssignment[];
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
  endMs?: number; // 深層修復の予算管理用
}

interface AltTask {
  sharedAssignment: boolean;
  participants: RepairTaskParticipant[];
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

function getScoreEntryTeacherIds(
  entry: TimetableEntry,
  teacherGroups: TeacherGroup[] = [],
  kind: "primary" | "alt" = "primary",
): string[] {
  const teacherIds = kind === "primary" ? entry.teacher_ids : entry.alt_teacher_ids;
  const teacherId = kind === "primary" ? entry.teacher_id : entry.alt_teacher_id;
  const teacherGroupId =
    kind === "primary" ? entry.teacher_group_id : entry.alt_teacher_group_id;

  const ids = new Set<string>(teacherIds ?? []);
  if (ids.size === 0 && teacherId) {
    ids.add(teacherId);
  }
  if (teacherGroupId) {
    const group = teacherGroups.find(
      (candidate) => candidate.id === teacherGroupId,
    );
    if (group) {
      for (const teacherId of group.teacher_ids || []) {
        ids.add(teacherId);
      }
    }
  }
  return [...ids];
}

function isLegitimateSharedAssignmentForScore(
  entries: TimetableEntry[],
  classGroups: ClassGroup[] = [],
  crossGradeGroups: CrossGradeGroup[] = [],
): boolean {
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

  return (
    classGroups.some(
      (group) =>
        entries.every(
          (entry) =>
            entry.grade === group.grade &&
            group.classes.includes(entry.class_name),
        ) && !(group.split_subjects || []).includes(subject),
    ) ||
    crossGradeGroups.some(
      (group) =>
        group.subject === subject &&
        entries.every((entry) =>
          group.participants.some(
            (participant) =>
              participant.grade === entry.grade &&
              participant.class_name === entry.class_name,
          ),
        ),
    )
  );
}

function countPriorityHardViolationsForResult(
  entries: TimetableEntry[],
  teachers: Teacher[],
  teacherGroups: TeacherGroup[] = [],
  classGroups: ClassGroup[] = [],
  crossGradeGroups: CrossGradeGroup[] = [],
): number {
  let total = 0;
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

  const teacherSlots = new Map<string, TimetableEntry[]>();
  for (const entry of entries) {
    if (!entry.subject) continue;
    for (const teacherId of getScoreEntryTeacherIds(entry, teacherGroups)) {
      const key = `${teacherId}|${entry.day_of_week}|${entry.period}`;
      const list = teacherSlots.get(key) ?? [];
      list.push(entry);
      teacherSlots.set(key, list);
    }
  }
  for (const list of teacherSlots.values()) {
    if (list.length <= 1) continue;
    if (
      isLegitimateSharedAssignmentForScore(
        list,
        classGroups,
        crossGradeGroups,
      )
    ) {
      continue;
    }
    total += list.length - 1;
  }

  const groupSlots = new Map<string, TimetableEntry[]>();
  for (const entry of entries) {
    if (!entry.teacher_group_id || !entry.subject) continue;
    const key = `${entry.teacher_group_id}|${entry.day_of_week}|${entry.period}`;
    const list = groupSlots.get(key) ?? [];
    list.push(entry);
    groupSlots.set(key, list);
  }
  for (const list of groupSlots.values()) {
    if (list.length <= 1) continue;
    if (
      isLegitimateSharedAssignmentForScore(
        list,
        classGroups,
        crossGradeGroups,
      )
    ) {
      continue;
    }
    total += list.length - 1;
  }

  const memberSlots = new Map<string, Set<TimetableEntry>>();
  for (const entry of entries) {
    if (!entry.subject) continue;
    const slotKey = `${entry.day_of_week}|${entry.period}`;
    const addMember = (memberId: string) => {
      const key = `${memberId}|${slotKey}`;
      const set = memberSlots.get(key) ?? new Set<TimetableEntry>();
      set.add(entry);
      memberSlots.set(key, set);
    };
    for (const teacherId of getScoreEntryTeacherIds(entry, teacherGroups)) {
      addMember(teacherId);
    }
  }
  for (const set of memberSlots.values()) {
    if (set.size <= 1) continue;
    const list = [...set];
    if (
      isLegitimateSharedAssignmentForScore(
        list,
        classGroups,
        crossGradeGroups,
      )
    ) {
      continue;
    }
    total += list.length - 1;
  }

  for (const entry of entries) {
    const addUnavailableCount = (
      subject: string | null | undefined,
      kind: "primary" | "alt",
    ) => {
      if (!subject) return;
      for (const teacherId of getScoreEntryTeacherIds(entry, teacherGroups, kind)) {
        const teacher = teacherById.get(teacherId);
        if (
          teacher?.unavailable_times?.some(
            (time) =>
              time.day_of_week === entry.day_of_week &&
              time.period === entry.period,
          )
        ) {
          total++;
        }
      }
    };

    addUnavailableCount(entry.subject, "primary");
    addUnavailableCount(entry.alt_subject, "alt");
  }

  return total;
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
  isPairing?: boolean; // 抱き合わせタスクか
  isAlt?: boolean; // 隔週授業タスクか（alt_subject を持つ）
}

interface PairingTarget {
  class_name: string;
  subject: string;
}

type PairingLookup = Map<string, PairingTarget[]>;

type ResolvedAssignment = {
  teacher_id: string | null;
  teacher_group_id: string | null;
  teacher_ids?: string[] | null;
  usageKey: string;
};

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
  class_name?: string,
): boolean {
  if (!teacher.subjects.includes(subject)) return false;
  return canTeacherCoverClass(teacher, grade, class_name);
}

function canTeacherCoverClass(
  teacher: Teacher,
  grade: number,
  class_name?: string,
): boolean {
  if (!teacher.target_grades.includes(grade)) return false;
  if (class_name && teacher.target_classes) {
    const allowed = teacher.target_classes[grade];
    if (allowed && allowed.length > 0 && !allowed.includes(class_name))
      return false;
  }
  return true;
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

function pickGroupRepresentative(
  group: TeacherGroup,
  teachers: Teacher[],
  participants: Array<{ grade: number; class_name?: string }>,
  day: DayOfWeek,
  period: Period,
  usage: TeacherUsageState,
  teacherGroups: TeacherGroup[],
  teacherConstraints: Record<string, TeacherConstraintSettings>,
): {
  teacher_id: string;
  dailyLoad: number;
  weeklyLoad: number;
  specialization: number;
  overloadPenalty: number;
} | null {
  const candidates = prioritizeWithRandomTiebreak(
    (group.teacher_ids || [])
      .map((memberId) => {
        const teacher = teachers.find((candidate) => candidate.id === memberId);
        if (!teacher) return null;
        if (
          !participants.every((participant) =>
            canTeacherCoverClass(
              teacher,
              participant.grade,
              participant.class_name,
            ),
          )
        ) {
          return null;
        }
        if (
          teacher.unavailable_times?.some(
            (u) => u.day_of_week === day && u.period === period,
          )
        ) {
          return null;
        }
        if (isTeacherBusyInSlot(memberId, day, period, usage, teacherGroups)) {
          return null;
        }
        return {
          teacher_id: memberId,
          dailyLoad: usage.daily.get(`${memberId}|${day}`) ?? 0,
          weeklyLoad: usage.weekly.get(memberId) ?? 0,
          specialization: teacher.subjects.length,
          overloadPenalty:
            getTeacherLoadPenalty(
              memberId,
              day,
              period,
              usage,
              teacherConstraints,
              true,
            ) ?? 0,
        };
      })
      .filter(
        (
          candidate,
        ): candidate is {
          teacher_id: string;
          dailyLoad: number;
          weeklyLoad: number;
          specialization: number;
          overloadPenalty: number;
        } => Boolean(candidate),
      ),
    (candidate) =>
      candidate.overloadPenalty * 1_000_000 +
      candidate.dailyLoad * 1_000 +
      candidate.weeklyLoad * 10 +
      candidate.specialization,
  );

  return candidates[0] ?? null;
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

function buildTtAssignmentCandidate(
  assignment: TtAssignment,
  day: DayOfWeek,
  period: Period,
  teachers: Teacher[],
  teacherGroups: TeacherGroup[],
  usage: TeacherUsageState,
  teacherConstraints: Record<string, TeacherConstraintSettings>,
  allowOverflow: boolean,
): {
  teacher_id: string | null;
  teacher_group_id: string | null;
  teacher_ids?: string[] | null;
  usageKey: string;
  dailyLoad: number;
  weeklyLoad: number;
  specialization: number;
  overloadPenalty: number;
} | null {
  const teamTeacherIds = [...new Set(assignment.teacher_ids.filter(Boolean))];
  if (teamTeacherIds.length === 0) return null;

  const teamTeachers: Teacher[] = [];
  let overloadPenalty = 0;
  let dailyLoad = 0;
  let weeklyLoad = 0;

  for (const teacherId of teamTeacherIds) {
    const teacher = teachers.find((candidate) => candidate.id === teacherId);
    if (!teacher) return null;
    if (
      teacher.unavailable_times?.some(
        (time) => time.day_of_week === day && time.period === period,
      )
    ) {
      return null;
    }
    if (isTeacherBusyInSlot(teacherId, day, period, usage, teacherGroups)) {
      return null;
    }
    const penalty = getTeacherLoadPenalty(
      teacherId,
      day,
      period,
      usage,
      teacherConstraints,
      allowOverflow,
    );
    if (penalty == null) return null;

    teamTeachers.push(teacher);
    overloadPenalty += penalty;
    dailyLoad += usage.daily.get(`${teacherId}|${day}`) ?? 0;
    weeklyLoad += usage.weekly.get(teacherId) ?? 0;
  }

  const representative = prioritizeWithRandomTiebreak(
    teamTeachers,
    (teacher) =>
      (usage.daily.get(`${teacher.id}|${day}`) ?? 0) * 1_000 +
      (usage.weekly.get(teacher.id) ?? 0),
  )[0];
  if (!representative) return null;

  return {
    teacher_id: representative.id,
    teacher_group_id: null,
    teacher_ids: teamTeacherIds,
    usageKey: `tt:${assignment.id}`,
    dailyLoad,
    weeklyLoad,
    specialization: teamTeacherIds.length,
    overloadPenalty,
  };
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
  isSplitAssignment = false, // class_group の split_subjects 担当 → 個人割当
  class_name?: string,
  ttAssignments: TtAssignment[] = [],
): ResolvedAssignment | null {
  type AssignmentCandidate = {
    teacher_id: string | null;
    teacher_group_id: string | null;
    teacher_ids?: string[] | null;
    usageKey: string;
    dailyLoad: number;
    weeklyLoad: number;
    specialization: number;
    overloadPenalty: number;
  };

  const pickBestCandidate = (
    candidates: AssignmentCandidate[],
  ): ResolvedAssignment | null => {
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
      teacher_ids: best.teacher_ids,
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
      if (
        !canTeacherTeachSubject(teacher, grade, isSpecial, subject, class_name)
      )
        continue;
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

      if (isSplitAssignment) {
        // class_group の split_subjects: グループ教科を個人担当へ展開する。
        // メンバー個票に教科が未設定でも、グループが教科を持っていれば候補に含める。
        for (const memberId of group.teacher_ids || []) {
          const teacher = teachers.find((t) => t.id === memberId);
          if (!teacher) continue;
          if (!canTeacherCoverClass(teacher, grade, class_name)) continue;
          if (
            teacher.unavailable_times?.some(
              (u) => u.day_of_week === day && u.period === period,
            )
          )
            continue;
          if (isTeacherBusyInSlot(memberId, day, period, usage, teacherGroups))
            continue;
          const overloadPenalty = getTeacherLoadPenalty(
            memberId,
            day,
            period,
            usage,
            teacherConstraints,
            false,
          );
          if (overloadPenalty == null) continue;
          candidates.push({
            teacher_id: memberId,
            teacher_group_id: null, // split担当は個人IDのみ（グループ全員markを避ける）
            usageKey: memberId,
            dailyLoad: usage.daily.get(`${memberId}|${day}`) ?? 0,
            weeklyLoad: usage.weekly.get(memberId) ?? 0,
            specialization: teacher.subjects.length,
            overloadPenalty,
          });
        }
      } else {
        if (usage.slots.has(`${group.id}|${day}|${period}`)) continue;
        const representative = pickGroupRepresentative(
          group,
          teachers,
          [{ grade, class_name }],
          day,
          period,
          usage,
          teacherGroups,
          teacherConstraints,
        );
        if (!representative) continue;
        candidates.push({
          teacher_id: representative.teacher_id,
          teacher_group_id: group.id,
          usageKey: group.id,
          dailyLoad: representative.dailyLoad,
          weeklyLoad: representative.weeklyLoad,
          specialization: group.subjects?.length ?? 99,
          overloadPenalty: representative.overloadPenalty,
        });
      }
    }
    return candidates;
  };

  const matchingTtAssignment = class_name
    ? findMatchingTtAssignment(ttAssignments, grade, class_name, subject)
    : null;

  if (matchingTtAssignment) {
    const strictTtCandidate = buildTtAssignmentCandidate(
      matchingTtAssignment,
      day,
      period,
      teachers,
      teacherGroups,
      usage,
      teacherConstraints,
      false,
    );
    if (strictTtCandidate) return pickBestCandidate([strictTtCandidate]);

    const relaxedTtCandidate = buildTtAssignmentCandidate(
      matchingTtAssignment,
      day,
      period,
      teachers,
      teacherGroups,
      usage,
      teacherConstraints,
      true,
    );
    if (relaxedTtCandidate) return pickBestCandidate([relaxedTtCandidate]);

    return null;
  }

  // 教員グループに登録されている教科はグループを優先
  const isGroupSubject = groupSubjects?.has(subject) ?? false;

  // 個別教員が1人も担当できない教科 = TT専用教科。個別フォールバック不可
  const hasAnyIndividualTeacher = teachers.some((t) =>
    canTeacherTeachSubject(t, grade, isSpecial, subject),
  );
  const isGroupOnlySubject = isGroupSubject && !hasAnyIndividualTeacher;

  const strictTeacher = isGroupOnlySubject
    ? null
    : pickBestCandidate(collectTeacherCandidates());
  const strictGroup = pickBestCandidate(collectGroupCandidates());
  const relaxedTeacher = isGroupOnlySubject
    ? null
    : pickBestCandidate(collectTeacherCandidatesWithOverflow(true));

  if (!isGroupSubject) {
    if (strictTeacher) return strictTeacher;
    if (strictGroup) return strictGroup;
    if (relaxedTeacher) return relaxedTeacher;
  }

  if (strictGroup) return strictGroup;

  // グループ教科でグループが見つからなかった場合は個別教員にフォールバック（TT専用教科は除く）
  if (isGroupSubject && !isGroupOnlySubject) {
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
  ttAssignments,
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
  endMs,
}: TryOnceParams): TryOnceResult {
  const placed = new Map<string, TimetableEntry>();
  const usage = makeUsage();
  const facilityUsage: FacilityUsage = new Set();
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
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
  const pairingLookup = buildPairingLookup(subjectPairings);

  const getAssignmentResourceIds = (
    teacherId: string | null | undefined,
    teacherGroupId: string | null | undefined,
    teacherIds?: string[] | null,
  ): string[] => {
    const ids = new Set<string>();
    if (teacherId) ids.add(teacherId);
    for (const candidateId of teacherIds ?? []) {
      ids.add(candidateId);
    }
    if (teacherGroupId) {
      ids.add(teacherGroupId);
      const group = teacherGroups.find(
        (candidate) => candidate.id === teacherGroupId,
      );
      if (group) {
        for (const memberId of group.teacher_ids || []) {
          ids.add(memberId);
        }
      }
    }
    return [...ids];
  };
  const pendingRepairTasks: RepairTask[] = [];

  // 深層修復のクラス間スワップ用: クラス別教科必要数を保持
  // key = `${grade}|${className}|${subject}` → required count
  const classSubjectRequired = new Map<string, number>();
  for (const cls of classes) {
    const baseKey = `${cls.grade}|${cls.class_name}`;
    const slots = classRequiredSlots[baseKey] || [];
    for (const subj of slots) {
      const k = `${cls.grade}|${cls.class_name}|${subj}`;
      classSubjectRequired.set(k, (classSubjectRequired.get(k) ?? 0) + 1);
    }
    for (const fe of fixedEntries) {
      if (
        fe.grade === cls.grade &&
        fe.class_name === cls.class_name &&
        fe.subject
      ) {
        const k = `${cls.grade}|${cls.class_name}|${fe.subject}`;
        classSubjectRequired.set(k, (classSubjectRequired.get(k) ?? 0) + 1);
      }
    }
  }

  // class_group の split_subjects に該当するか判定（TT ではなく個人担当扱い）
  const isSplitSubjectForClass = (
    grade: number,
    class_name: string,
    subject: string,
  ): boolean =>
    classGroups.some(
      (g) =>
        g.grade === grade &&
        g.classes.includes(class_name) &&
        (g.split_subjects || []).includes(subject),
    );

  const buildPlannedSubjects = (
    participants: RepairTaskParticipant[],
    day: DayOfWeek,
    period: Period,
  ): Map<string, string> | null => {
    const plannedSubjects = new Map<string, string>();
    for (const participant of participants) {
      const targetPeriod = (period + participant.offset) as Period;
      const slotKey = `${participant.grade}|${participant.class_name}|${day}|${targetPeriod}`;
      const existingSubject = plannedSubjects.get(slotKey);
      if (existingSubject && existingSubject !== participant.subject) {
        return null;
      }
      plannedSubjects.set(slotKey, participant.subject);
    }

    return plannedSubjects;
  };

  const pairingTargetsOk = (
    grade: number,
    class_name: string,
    subject: string,
    day: DayOfWeek,
    period: Period,
    plannedSubjects?: Map<string, string>,
  ): boolean => {
    if (pairingLookup.size === 0) return true;

    const targets =
      pairingLookup.get(`${grade}|${class_name}|${subject}`) ?? [];

    for (const target of targets) {
      const targetKey = `${grade}|${target.class_name}|${day}|${period}`;
      const plannedSubject = plannedSubjects?.get(targetKey);
      if (plannedSubject != null) {
        if (plannedSubject !== target.subject) return false;
        continue;
      }

      const placedSubject = placed.get(targetKey)?.subject;
      if (placedSubject == null) return false;
      if (placedSubject !== target.subject) return false;
    }

    return true;
  };

  const arePairingsSatisfied = (
    participants: RepairTaskParticipant[],
    day: DayOfWeek,
    period: Period,
  ): boolean => {
    const plannedSubjects = buildPlannedSubjects(participants, day, period);
    if (!plannedSubjects) return false;

    for (const participant of participants) {
      const targetPeriod = (period + participant.offset) as Period;
      if (
        !pairingTargetsOk(
          participant.grade,
          participant.class_name,
          participant.subject,
          day,
          targetPeriod,
          plannedSubjects,
        )
      ) {
        return false;
      }
    }

    return true;
  };

  const markEntryResources = (entry: TimetableEntry) => {
    for (const id of getAssignmentResourceIds(
      entry.teacher_id,
      entry.teacher_group_id,
      entry.teacher_ids,
    )) {
      markTeacher(usage, id, entry.day_of_week, entry.period);
    }
    for (const id of getAssignmentResourceIds(
      entry.alt_teacher_id,
      entry.alt_teacher_group_id,
      entry.alt_teacher_ids,
    )) {
      markTeacher(usage, id, entry.day_of_week, entry.period);
    }
    markFacility(entry.subject, entry.day_of_week, entry.period);
    if (entry.alt_subject) {
      markFacility(entry.alt_subject, entry.day_of_week, entry.period);
    }
  };

  const unmarkEntryResources = (entry: TimetableEntry) => {
    for (const id of getAssignmentResourceIds(
      entry.teacher_id,
      entry.teacher_group_id,
      entry.teacher_ids,
    )) {
      unmarkTeacher(usage, id, entry.day_of_week, entry.period);
    }
    for (const id of getAssignmentResourceIds(
      entry.alt_teacher_id,
      entry.alt_teacher_group_id,
      entry.alt_teacher_ids,
    )) {
      unmarkTeacher(usage, id, entry.day_of_week, entry.period);
    }
    unmarkFacility(entry.subject, entry.day_of_week, entry.period);
    if (entry.alt_subject) {
      unmarkFacility(entry.alt_subject, entry.day_of_week, entry.period);
    }
  };

  const markAssignment = (
    key: string,
    teacher_group_id: string | null | undefined,
    day: DayOfWeek,
    period: Period,
    teacher_id?: string | null,
    teacher_ids?: string[] | null,
  ) => {
    const ids = new Set<string>(
      getAssignmentResourceIds(teacher_id, teacher_group_id, teacher_ids),
    );
    ids.add(key);
    for (const id of ids) {
      markTeacher(usage, id, day, period);
    }
  };

  const unmarkAssignment = (
    key: string,
    teacher_group_id: string | null | undefined,
    day: DayOfWeek,
    period: Period,
    teacher_id?: string | null,
    teacher_ids?: string[] | null,
  ) => {
    const ids = new Set<string>(
      getAssignmentResourceIds(teacher_id, teacher_group_id, teacher_ids),
    );
    ids.add(key);
    for (const id of ids) {
      unmarkTeacher(usage, id, day, period);
    }
  };

  const markSlotCounts = (entry: TimetableEntry) => {
    if (!entry.subject) return;
    const dk = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.subject}`;
    dailySubjectCount.set(dk, (dailySubjectCount.get(dk) ?? 0) + 1);
    if (entry.period > lunchAfterPeriod)
      afternoonSubjectCount.set(dk, (afternoonSubjectCount.get(dk) ?? 0) + 1);
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

  const normalizeEntryTeacherTeams = (
    entry: TimetableEntry,
  ): TimetableEntry => {
    const normalized = { ...entry };

    const primaryTtAssignment = findMatchingTtAssignment(
      ttAssignments,
      entry.grade,
      entry.class_name,
      entry.subject,
    );
    if (primaryTtAssignment) {
      const primaryTeacherIds = [
        ...new Set(primaryTtAssignment.teacher_ids.filter(Boolean)),
      ];
      normalized.teacher_id = primaryTeacherIds.includes(entry.teacher_id ?? "")
        ? (entry.teacher_id ?? primaryTeacherIds[0] ?? null)
        : (primaryTeacherIds[0] ?? null);
      normalized.teacher_group_id = null;
      normalized.teacher_ids = primaryTeacherIds;
    }

    const altTtAssignment = findMatchingTtAssignment(
      ttAssignments,
      entry.grade,
      entry.class_name,
      entry.alt_subject,
    );
    if (altTtAssignment) {
      const altTeacherIds = [
        ...new Set(altTtAssignment.teacher_ids.filter(Boolean)),
      ];
      normalized.alt_teacher_id = altTeacherIds.includes(
        entry.alt_teacher_id ?? "",
      )
        ? (entry.alt_teacher_id ?? altTeacherIds[0] ?? null)
        : (altTeacherIds[0] ?? null);
      normalized.alt_teacher_group_id = null;
      normalized.alt_teacher_ids = altTeacherIds;
    }

    return normalized;
  };

  const getEntryTeacherMemberIds = (entry: TimetableEntry): string[] => {
    const teacherIds = new Set<string>(entry.teacher_ids ?? []);
    if (teacherIds.size === 0 && entry.teacher_id) {
      teacherIds.add(entry.teacher_id);
    }
    if (entry.teacher_group_id) {
      const group = teacherGroups.find(
        (candidate) => candidate.id === entry.teacher_group_id,
      );
      if (group) {
        for (const memberId of group.teacher_ids || []) {
          teacherIds.add(memberId);
        }
      }
    }
    return [...teacherIds];
  };

  const addPlacedEntry = (entry: TimetableEntry) => {
    const normalizedEntry = normalizeEntryTeacherTeams(entry);
    placed.set(
      `${normalizedEntry.grade}|${normalizedEntry.class_name}|${normalizedEntry.day_of_week}|${normalizedEntry.period}`,
      normalizedEntry,
    );
    markEntryResources(normalizedEntry);
    markSlotCounts(normalizedEntry);
  };

  const removePlacedEntry = (key: string): TimetableEntry | null => {
    const entry = placed.get(key);
    if (!entry) return null;
    placed.delete(key);
    unmarkEntryResources(entry);
    unmarkSlotCounts(entry);
    return entry;
  };

  const assignFixedEntryResources = (entries: TimetableEntry[]) => {
    const processedKeys = new Set<string>();
    const entriesByKey = new Map(
      entries.map((entry) => [
        `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`,
        entry,
      ]),
    );

    const buildParticipant = (
      entry: TimetableEntry,
    ): RepairTaskParticipant => ({
      grade: entry.grade,
      class_name: entry.class_name,
      isSpecial:
        classInfoByKey.get(`${entry.grade}|${entry.class_name}`)?.isSpecial ??
        false,
      subject: entry.subject,
      offset: 0,
    });

    const collectSharedFixedEntries = (
      entry: TimetableEntry,
    ): TimetableEntry[] => {
      if (!entry.subject) return [entry];

      for (const group of classGroups) {
        if (group.grade !== entry.grade) continue;
        if (!group.classes.includes(entry.class_name)) continue;
        if ((group.split_subjects || []).includes(entry.subject)) continue;

        const groupEntries = group.classes
          .map((className) =>
            entriesByKey.get(
              `${entry.grade}|${className}|${entry.day_of_week}|${entry.period}`,
            ),
          )
          .filter(
            (candidate): candidate is TimetableEntry =>
              Boolean(candidate?.subject) && candidate?.subject === entry.subject,
          );
        if (groupEntries.length > 1) {
          return groupEntries;
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

        const groupEntries = group.participants
          .map((participant) =>
            entriesByKey.get(
              `${participant.grade}|${participant.class_name}|${entry.day_of_week}|${entry.period}`,
            ),
          )
          .filter(
            (candidate): candidate is TimetableEntry =>
              Boolean(candidate?.subject) && candidate?.subject === entry.subject,
          );
        if (groupEntries.length > 1) {
          return groupEntries;
        }
      }

      return [entry];
    };

    for (const entry of entries) {
      const entryKey = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
      if (processedKeys.has(entryKey)) continue;

      const sharedEntries = collectSharedFixedEntries(entry);
      sharedEntries.forEach((candidate) => {
        processedKeys.add(
          `${candidate.grade}|${candidate.class_name}|${candidate.day_of_week}|${candidate.period}`,
        );
      });

      if (!entry.subject) {
        addPlacedEntry(entry);
        continue;
      }

      if (sharedEntries.length > 1) {
        const sharedAssignment = findSharedAssignment(
          sharedEntries.map(buildParticipant),
          entry.day_of_week,
          entry.period,
        );
        if (sharedAssignment) {
          for (const sharedEntry of sharedEntries) {
            const assignedEntry: TimetableEntry = {
              ...sharedEntry,
              teacher_id: sharedAssignment.teacher_id,
              teacher_group_id: sharedAssignment.teacher_group_id,
              teacher_ids: sharedAssignment.teacher_ids,
            };
            const normalizedEntry = normalizeEntryTeacherTeams(assignedEntry);
            placed.set(
              `${normalizedEntry.grade}|${normalizedEntry.class_name}|${normalizedEntry.day_of_week}|${normalizedEntry.period}`,
              normalizedEntry,
            );
            markSlotCounts(normalizedEntry);
          }
          markAssignment(
            sharedAssignment.usageKey,
            sharedAssignment.teacher_group_id,
            entry.day_of_week,
            entry.period,
            sharedAssignment.teacher_id,
            sharedAssignment.teacher_ids,
          );
          markFacility(entry.subject, entry.day_of_week, entry.period);
          continue;
        }
      }

      for (const sharedEntry of sharedEntries) {
        const assignment = sharedEntry.subject
          ? findTeacherOrGroup(
              sharedEntry.grade,
              classInfoByKey.get(
                `${sharedEntry.grade}|${sharedEntry.class_name}`,
              )?.isSpecial ?? false,
              sharedEntry.subject,
              sharedEntry.day_of_week,
              sharedEntry.period,
              teachers,
              teacherGroups,
              usage,
              teacherConstraints,
              groupSubjects,
              isSplitSubjectForClass(
                sharedEntry.grade,
                sharedEntry.class_name,
                sharedEntry.subject,
              ),
              sharedEntry.class_name,
              ttAssignments,
            )
          : null;

        addPlacedEntry({
          ...sharedEntry,
          teacher_id: assignment?.teacher_id ?? sharedEntry.teacher_id ?? null,
          teacher_group_id:
            assignment?.teacher_group_id ??
            sharedEntry.teacher_group_id ??
            null,
          teacher_ids: assignment?.teacher_ids ?? sharedEntry.teacher_ids,
        });
      }
    }
  };

  const slotOk = (
    grade: number,
    className: string,
    subject: string,
    day: DayOfWeek,
    period: Period,
    plannedSubjects?: Map<string, string>,
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
    if (
      !pairingTargetsOk(grade, className, subject, day, period, plannedSubjects)
    ) {
      return false;
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
    // 先読みチェック（Forward Checking）:
    // このスロットで担当できる教員・グループが1つも存在しない場合は配置不可
    // → 「教員なし」で仮配置→後から競合解消」の悪循環を防ぐ
    const isSpecial =
      classInfoByKey.get(`${grade}|${className}`)?.isSpecial ?? false;
    const isSplit = isSplitSubjectForClass(grade, className, subject);
    let hasAvailableAssignment = false;
    const matchingTtAssignment = findMatchingTtAssignment(
      ttAssignments,
      grade,
      className,
      subject,
    );
    if (matchingTtAssignment) {
      hasAvailableAssignment = Boolean(
        buildTtAssignmentCandidate(
          matchingTtAssignment,
          day,
          period,
          teachers,
          teacherGroups,
          usage,
          teacherConstraints,
          false,
        ) ||
          buildTtAssignmentCandidate(
            matchingTtAssignment,
            day,
            period,
            teachers,
            teacherGroups,
            usage,
            teacherConstraints,
            true,
          ),
      );
    }
    // 個別教員を確認
    for (const teacher of teachers) {
      if (hasAvailableAssignment) break;
      if (!canTeacherTeachSubject(teacher, grade, isSpecial, subject)) continue;
      if (
        teacher.unavailable_times?.some(
          (u) => u.day_of_week === day && u.period === period,
        )
      )
        continue;
      if (isTeacherBusyInSlot(teacher.id, day, period, usage, teacherGroups))
        continue;
      hasAvailableAssignment = true;
      break;
    }
    // 個別教員がいなければグループを確認
    if (!hasAvailableAssignment && !isSplit) {
      for (const group of teacherGroups) {
        if (!canTeacherGroupTeachSubject(group, grade, subject)) continue;
        if ((usage.slots.get(`${group.id}|${day}|${period}`) ?? 0) > 0)
          continue;
        if (
          pickGroupRepresentative(
            group,
            teachers,
            [{ grade, class_name: className }],
            day,
            period,
            usage,
            teacherGroups,
            teacherConstraints,
          )
        ) {
          hasAvailableAssignment = true;
          break;
        }
      }
    }
    // split担当（class_group の split_subjects）は個別教員候補をグループ内メンバーから探す
    if (!hasAvailableAssignment && isSplit) {
      for (const group of teacherGroups) {
        if (!canTeacherGroupTeachSubject(group, grade, subject)) continue;
        for (const memberId of group.teacher_ids || []) {
          const member = teachers.find((t) => t.id === memberId);
          if (!member) continue;
          if (!member.target_grades?.includes(grade)) continue;
          if (
            member.unavailable_times?.some(
              (u) => u.day_of_week === day && u.period === period,
            )
          )
            continue;
          if (isTeacherBusyInSlot(memberId, day, period, usage, teacherGroups))
            continue;
          hasAvailableAssignment = true;
          break;
        }
        if (hasAvailableAssignment) break;
      }
    }
    if (!hasAvailableAssignment) return false;
    return true;
  };

  const findSharedAssignment = (
    participants: RepairTaskParticipant[],
    day: DayOfWeek,
    period: Period,
  ): ResolvedAssignment | null => {
    if (participants.length === 0) return null;
    const primarySubject = participants[0].subject;
    const participantGrades = [...new Set(participants.map((p) => p.grade))];

    const matchingTtAssignments = participants.map((participant) =>
      findMatchingTtAssignment(
        ttAssignments,
        participant.grade,
        participant.class_name,
        participant.subject,
      ),
    );
    const ttAssignmentsInUse = matchingTtAssignments.filter(
      (assignment): assignment is TtAssignment => Boolean(assignment),
    );

    if (ttAssignmentsInUse.length > 0) {
      if (ttAssignmentsInUse.length !== participants.length) {
        return null;
      }

      const baseTeacherIds = ttAssignmentsInUse[0].teacher_ids;
      if (
        !ttAssignmentsInUse.every((assignment) =>
          haveSameTeacherSet(assignment.teacher_ids, baseTeacherIds),
        )
      ) {
        return null;
      }

      const strictTtCandidate = buildTtAssignmentCandidate(
        ttAssignmentsInUse[0],
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
        false,
      );
      if (strictTtCandidate) {
        return {
          teacher_id: strictTtCandidate.teacher_id,
          teacher_group_id: null,
          teacher_ids: strictTtCandidate.teacher_ids,
          usageKey: strictTtCandidate.usageKey,
        };
      }

      const relaxedTtCandidate = buildTtAssignmentCandidate(
        ttAssignmentsInUse[0],
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
        true,
      );
      if (relaxedTtCandidate) {
        return {
          teacher_id: relaxedTtCandidate.teacher_id,
          teacher_group_id: null,
          teacher_ids: relaxedTtCandidate.teacher_ids,
          usageKey: relaxedTtCandidate.usageKey,
        };
      }

      return null;
    }

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
      teacherGroups
        .map((group) => {
          if (
            !participantGrades.every((grade) =>
              canTeacherGroupTeachSubject(group, grade, primarySubject),
            )
          ) {
            return null;
          }
          if (usage.slots.has(`${group.id}|${day}|${period}`)) return null;
          const representative = pickGroupRepresentative(
            group,
            teachers,
            participants.map((participant) => ({
              grade: participant.grade,
              class_name: participant.class_name,
            })),
            day,
            period,
            usage,
            teacherGroups,
            teacherConstraints,
          );
          if (!representative) return null;
          return {
            teacher_id: representative.teacher_id,
            teacher_group_id: group.id,
            usageKey: group.id,
            dailyLoad: representative.dailyLoad,
            weeklyLoad: representative.weeklyLoad,
            overloadPenalty: representative.overloadPenalty,
          };
        })
        .filter(
          (
            candidate,
          ): candidate is {
            teacher_id: string;
            teacher_group_id: string;
            usageKey: string;
            dailyLoad: number;
            weeklyLoad: number;
            overloadPenalty: number;
          } => Boolean(candidate),
        ),
      (candidate) =>
        candidate.overloadPenalty * 1_000_000 +
        candidate.dailyLoad * 1_000 +
        candidate.weeklyLoad,
    );
    if (groupCandidates[0]) {
      return {
        teacher_id: groupCandidates[0].teacher_id,
        teacher_group_id: groupCandidates[0].teacher_group_id,
        usageKey: groupCandidates[0].usageKey,
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

  assignFixedEntryResources(fixedEntries);

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

    const plannedSubjects = buildPlannedSubjects(
      task.participants,
      day,
      period,
    );
    if (
      !plannedSubjects ||
      !arePairingsSatisfied(task.participants, day, period)
    ) {
      return false;
    }

    const targetsValid = task.participants.every((participant) => {
      const targetPeriod = (period + participant.offset) as Period;
      if (
        !slotOk(
          participant.grade,
          participant.class_name,
          participant.subject,
          day,
          targetPeriod,
          plannedSubjects,
        )
      ) {
        return false;
      }
      // alt_subject がある場合、教科配置制約（allowed_days/periods、午後制限）を確認
      if (participant.alt_subject) {
        const altSp = subjectPlacement?.[participant.alt_subject];
        if (altSp?.allowed_days?.length && !altSp.allowed_days.includes(day))
          return false;
        if (
          altSp?.allowed_periods?.length &&
          !altSp.allowed_periods.includes(targetPeriod)
        )
          return false;
        if (
          altSp?.max_afternoon_daily != null &&
          targetPeriod > lunchAfterPeriod
        ) {
          const dk = `${participant.grade}|${participant.class_name}|${day}|${participant.alt_subject}`;
          if ((afternoonSubjectCount.get(dk) ?? 0) >= altSp.max_afternoon_daily)
            return false;
        }
      }
      return true;
    });

    if (!targetsValid) return false;

    const repairedEntries: TimetableEntry[] = [];
    if (task.sharedAssignment) {
      const sharedAssignment = findSharedAssignment(
        task.participants,
        day,
        period,
      );
      if (!sharedAssignment) return false;

      const altSubjects = [
        ...new Set(
          task.participants
            .map((participant) => participant.alt_subject)
            .filter((subject): subject is string => Boolean(subject)),
        ),
      ];
      let altSharedAssignment: ResolvedAssignment | null = null;
      if (altSubjects.length > 1) return false;
      if (altSubjects[0]) {
        altSharedAssignment = findSharedAssignment(
          task.participants.map((participant) => ({
            ...participant,
            subject: altSubjects[0],
            alt_subject: undefined,
          })),
          day,
          period,
        );
        if (!altSharedAssignment) return false;
      }

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
          teacher_ids: sharedAssignment.teacher_ids,
          alt_teacher_id: altSharedAssignment?.teacher_id ?? null,
          alt_teacher_group_id: altSharedAssignment?.teacher_group_id ?? null,
          alt_teacher_ids: altSharedAssignment?.teacher_ids,
        });
      }
    } else {
      const tempMarked: Array<{
        id: string;
        teacher_id: string | null | undefined;
        teacher_group_id: string | null | undefined;
        teacher_ids?: string[] | null;
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
          isSplitSubjectForClass(
            participant.grade,
            participant.class_name,
            participant.subject,
          ),
          participant.class_name,
          ttAssignments,
        );

        if (!assignment) {
          allPlaced = false;
          break;
        }

        markAssignment(
          assignment.usageKey,
          assignment.teacher_group_id,
          day,
          targetPeriod,
          assignment.teacher_id,
          assignment.teacher_ids,
        );
        tempMarked.push({
          id: assignment.usageKey,
          teacher_id: assignment.teacher_id,
          teacher_group_id: assignment.teacher_group_id,
          teacher_ids: assignment.teacher_ids,
          day,
          period: targetPeriod,
        });

        // B週（alt_subject）の教員も探して割り当てる
        let altTeacherId: string | null = null;
        let altTeacherGroupId: string | null = null;
        let altTeacherIds: string[] | null | undefined;
        if (participant.alt_subject) {
          const altAssignment = findTeacherOrGroup(
            participant.grade,
            participant.isSpecial,
            participant.alt_subject,
            day,
            targetPeriod,
            teachers,
            teacherGroups,
            usage,
            teacherConstraints,
            groupSubjects,
            isSplitSubjectForClass(
              participant.grade,
              participant.class_name,
              participant.alt_subject,
            ),
            participant.class_name,
            ttAssignments,
          );
          if (!altAssignment) {
            allPlaced = false;
            break;
          }
          altTeacherId = altAssignment.teacher_id;
          altTeacherGroupId = altAssignment.teacher_group_id;
          altTeacherIds = altAssignment.teacher_ids;
          markAssignment(
            altAssignment.usageKey,
            altAssignment.teacher_group_id,
            day,
            targetPeriod,
            altAssignment.teacher_id,
            altAssignment.teacher_ids,
          );
          tempMarked.push({
            id: altAssignment.usageKey,
            teacher_id: altAssignment.teacher_id,
            teacher_group_id: altAssignment.teacher_group_id,
            teacher_ids: altAssignment.teacher_ids,
            day,
            period: targetPeriod,
          });
        }

        repairedEntries.push({
          day_of_week: day,
          period: targetPeriod,
          grade: participant.grade,
          class_name: participant.class_name,
          subject: participant.subject,
          alt_subject: participant.alt_subject ?? null,
          teacher_id: assignment.teacher_id,
          teacher_group_id: assignment.teacher_group_id,
          teacher_ids: assignment.teacher_ids,
          alt_teacher_id: altTeacherId,
          alt_teacher_group_id: altTeacherGroupId,
          alt_teacher_ids: altTeacherIds,
        });
      }

      for (const marked of tempMarked) {
        unmarkAssignment(
          marked.id,
          marked.teacher_group_id,
          marked.day,
          marked.period,
          marked.teacher_id,
          marked.teacher_ids,
        );
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
      const participants = grp.participants.map((participant) => ({
        grade: participant.grade,
        class_name: participant.class_name,
        isSpecial:
          classInfoByKey.get(`${participant.grade}|${participant.class_name}`)
            ?.isSpecial ?? false,
        subject: grp.subject,
        offset: 0,
      }));
      const slots = shuffle(
        DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
      );
      for (const { day, period } of slots) {
        const slotPlannedSubjects = buildPlannedSubjects(
          participants,
          day,
          period,
        );
        if (
          !slotPlannedSubjects ||
          !participants.every((p) =>
            slotOk(
              p.grade,
              p.class_name,
              grp.subject,
              day,
              period,
              slotPlannedSubjects,
            ),
          )
        )
          continue;
        const sharedAssignment = findSharedAssignment(
          participants,
          day,
          period,
        );
        if (!sharedAssignment) continue;
        for (const p of participants) {
          const newEntry: TimetableEntry = {
            day_of_week: day,
            period,
            grade: p.grade,
            class_name: p.class_name,
            subject: grp.subject,
            teacher_id: sharedAssignment.teacher_id,
            teacher_group_id: sharedAssignment.teacher_group_id,
            teacher_ids: sharedAssignment.teacher_ids,
          };
          const normalizedEntry = normalizeEntryTeacherTeams(newEntry);
          placed.set(
            `${p.grade}|${p.class_name}|${day}|${period}`,
            normalizedEntry,
          );
          markSlotCounts(normalizedEntry);
          placed_count++;
        }
        markAssignment(
          sharedAssignment.usageKey,
          sharedAssignment.teacher_group_id,
          day,
          period,
          sharedAssignment.teacher_id,
          sharedAssignment.teacher_ids,
        );
        markFacility(grp.subject, day, period);
        taskPlaced = true;
        break;
      }
      if (!taskPlaced) {
        pendingRepairTasks.push({
          sharedAssignment: true,
          participants,
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
    const participants = classNames.map((className) => ({
      grade,
      class_name: className,
      isSpecial:
        classInfoByKey.get(`${grade}|${className}`)?.isSpecial ?? false,
      subject,
      offset: 0,
    }));
    const candidateSlots = shuffle(
      DAYS.flatMap((day) => PERIODS.map((period) => ({ day, period }))),
    );
    for (const { day, period } of candidateSlots) {
      const slotPlannedSubjects = buildPlannedSubjects(
        participants,
        day,
        period,
      );
      if (
        !slotPlannedSubjects ||
        !classNames.every((cn) =>
          slotOk(grade, cn, subject, day, period, slotPlannedSubjects),
        )
      )
        continue;
      const sharedAssignment = findSharedAssignment(participants, day, period);
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
          teacher_ids: sharedAssignment.teacher_ids,
        };
        const normalizedEntry = normalizeEntryTeacherTeams(newEntry);
        placed.set(`${grade}|${cn}|${day}|${period}`, normalizedEntry);
        markSlotCounts(normalizedEntry);
        placed_count++;
      }
      markAssignment(
        sharedAssignment.usageKey,
        sharedAssignment.teacher_group_id,
        day,
        period,
        sharedAssignment.teacher_id,
        sharedAssignment.teacher_ids,
      );
      markFacility(subject, day, period);
      taskPlaced = true;
      break;
    }
    if (!taskPlaced) {
      pendingRepairTasks.push({
        sharedAssignment: true,
        participants,
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
  for (const task of prioritizeWithRandomTiebreak(altTasks, (task) =>
    task.participants.reduce((sum, participant) => {
      const altSubject = participant.alt_subject ?? participant.subject;
      return (
        sum +
        Math.min(
          getSubjectTightness(
            participant.grade,
            participant.isSpecial,
            participant.subject,
            teachers,
            teacherGroups,
            subjectPlacement,
          ),
          getSubjectTightness(
            participant.grade,
            participant.isSpecial,
            altSubject,
            teachers,
            teacherGroups,
            subjectPlacement,
          ),
        )
      );
    }, 0),
  )) {
    required_count += task.participants.length;
    const repairTask: RepairTask = {
      ...task,
      isAlt: true,
    };

    if (!tryRepairTask(repairTask)) {
      pendingRepairTasks.push({
        ...repairTask,
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

  // 抱き合わせタスクを最優先で処理（doubleTasks より先）
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
    required_count += 2;
    const task: RepairTask = {
      sharedAssignment: false,
      isPairing: true,
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
      pendingRepairTasks.push({ ...task });
    }
  }

  // requires_double な教科を連続ペアとして分離
  const doubleTasks: Array<{
    grade: number;
    class_name: string;
    isSpecial: boolean;
    subject_a: string;
    subject_b: string;
  }> = [];
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
        if (
          slotOk(
            task.grade,
            task.className,
            task.subject,
            day as DayOfWeek,
            period as Period,
          )
        )
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
                (k) => reservedTargetKeys.has(k) || fixedSlotKeys.has(k),
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
                  classInfoByKey.get(`${e.grade}|${e.class_name}`)?.isSpecial ??
                  false,
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
                teacher_ids: sharedAssignment.teacher_ids,
              };
              const normalizedEntry = normalizeEntryTeacherTeams(newEntry);
              placed.set(relKey, normalizedEntry);
              markSlotCounts(normalizedEntry);
              relocatedKeys.push(relKey);
            }
            markAssignment(
              sharedAssignment.usageKey,
              sharedAssignment.teacher_group_id,
              relSlot.day,
              relSlot.period,
              sharedAssignment.teacher_id,
              sharedAssignment.teacher_ids,
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
                isSplitSubjectForClass(
                  entry.grade,
                  entry.class_name,
                  entry.subject,
                ),
                entry.class_name,
                ttAssignments,
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

  const repairScoreFn = (task: RepairTask): number => {
    // 全参加者が同時に空いているアンカースロット数を返す（少ないほど優先）
    let count = 0;
    for (const day of DAYS) {
      for (const period of PERIODS) {
        if (
          task.participants.every((p) =>
            slotOk(
              p.grade,
              p.class_name,
              p.subject,
              day as DayOfWeek,
              (period + p.offset) as Period,
            ),
          )
        )
          count++;
      }
    }
    return count;
  };

  // 1回目の repair パス
  const failedAfterRepair: RepairTask[] = [];
  for (const repairTask of prioritizeWithRandomTiebreak(
    pendingRepairTasks,
    repairScoreFn,
  )) {
    if (!tryRepairTask(repairTask)) {
      if (!tryDisplacementRepair(repairTask)) {
        failedAfterRepair.push(repairTask);
      }
    }
  }

  // 2回目の repair パス（異なる乱数順序で再挑戦）
  const stillFailedAfterRepair: RepairTask[] = [];
  for (const repairTask of prioritizeWithRandomTiebreak(
    failedAfterRepair,
    repairScoreFn,
  )) {
    if (!tryRepairTask(repairTask)) {
      if (!tryDisplacementRepair(repairTask)) {
        stillFailedAfterRepair.push(repairTask);
      }
    }
  }

  // 隔週授業救済パス: altTask が失敗した場合、A週教科だけでも配置して時数を確保する
  for (const failedTask of stillFailedAfterRepair) {
    if (!failedTask.isAlt) continue;
    for (const participant of failedTask.participants) {
      // alt_subject なし（A週のみ）で再試行
      const altOnlyTask: RepairTask = {
        sharedAssignment: false,
        participants: [{ ...participant, alt_subject: undefined }],
      };
      if (!tryRepairTask(altOnlyTask)) {
        tryDisplacementRepair(altOnlyTask);
      }
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

    const classGroup = classGroups.find(
      (group) =>
        !(group.split_subjects || []).includes(subject) &&
        group.classes.length === entries.length &&
        entries.every(
          (entry) =>
            entry.grade === group.grade &&
            group.classes.includes(entry.class_name),
        ),
    );
    if (classGroup) return true;

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
    options?: { allowRelocation?: boolean },
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
      isSplitSubjectForClass(entry.grade, entry.class_name, entry.subject),
      entry.class_name,
      ttAssignments,
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

    if (options?.allowRelocation === false) {
      addPlacedEntry(removed);
      return false;
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
        const slotPlannedSubjects = buildPlannedSubjects(
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
        if (
          !slotPlannedSubjects ||
          !allEntries.every((e) =>
            slotOk(
              e.grade,
              e.class_name,
              e.subject,
              day,
              period,
              slotPlannedSubjects,
            ),
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
            teacher_ids: sharedAssignment.teacher_ids,
          };
          const normalizedEntry = normalizeEntryTeacherTeams(newEntry);
          placed.set(
            `${e.grade}|${e.class_name}|${day}|${period}`,
            normalizedEntry,
          );
          markSlotCounts(normalizedEntry);
        }
        markAssignment(
          sharedAssignment.usageKey,
          sharedAssignment.teacher_group_id,
          day,
          period,
          sharedAssignment.teacher_id,
          sharedAssignment.teacher_ids,
        );
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
        isSplitSubjectForClass(entry.grade, entry.class_name, entry.subject),
        entry.class_name,
        ttAssignments,
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

  const countEntryUnavailableTeachers = (entry: TimetableEntry): number => {
    const countUnavailable = (teacherIds: string[]): number => {
      let total = 0;
      for (const teacherId of teacherIds) {
        const teacher = teacherById.get(teacherId);
        if (
          teacher?.unavailable_times?.some(
            (time) =>
              time.day_of_week === entry.day_of_week &&
              time.period === entry.period,
          )
        ) {
          total++;
        }
      }
      return total;
    };

    return (
      countUnavailable(getScoreEntryTeacherIds(entry, teacherGroups, "primary")) +
      countUnavailable(getScoreEntryTeacherIds(entry, teacherGroups, "alt"))
    );
  };

  const resolveTeacherConflicts = (): boolean => {
    let changed = false;

    const teacherSlotEntries = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.subject) continue;
      for (const teacherId of getEntryTeacherMemberIds(entry)) {
        const slotKey = `${teacherId}|${entry.day_of_week}|${entry.period}`;
        const current = teacherSlotEntries.get(slotKey) ?? [];
        current.push({ key, entry });
        teacherSlotEntries.set(slotKey, current);
      }
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

    // クロスグループ重複の解決: 個別教員・別グループにまたがって同一教員が同時刻に出現する場合
    const memberSlotEntries = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.subject) continue;
      const slotKey = `${entry.day_of_week}|${entry.period}`;
      const pushMember = (memberId: string) => {
        const mk = `${memberId}|${slotKey}`;
        const list = memberSlotEntries.get(mk) ?? [];
        if (!list.some((x) => x.key === key)) {
          list.push({ key, entry });
        }
        memberSlotEntries.set(mk, list);
      };
      for (const teacherId of getEntryTeacherMemberIds(entry)) {
        pushMember(teacherId);
      }
    }

    for (const conflictEntries of memberSlotEntries.values()) {
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

  const countTeacherUnavailableAssignments = (): number => {
    let total = 0;
    for (const entry of placed.values()) {
      if (!entry.subject) continue;
      total += countEntryUnavailableTeachers(entry);
    }
    return total;
  };

  const countPriorityHardViolations = (): number =>
    countTeacherConflicts() + countTeacherUnavailableAssignments();

  const collectGroupedEntries = (entry: TimetableEntry): TimetableEntry[] => {
    const grouped = new Map<string, TimetableEntry>();
    const pushEntry = (candidate: TimetableEntry | undefined) => {
      if (!candidate?.subject) return;
      grouped.set(
        `${candidate.grade}|${candidate.class_name}|${candidate.day_of_week}|${candidate.period}`,
        candidate,
      );
    };

    pushEntry(entry);

    for (const group of classGroups) {
      if (group.grade !== entry.grade) continue;
      if (!group.classes.includes(entry.class_name)) continue;
      if (group.split_subjects?.includes(entry.subject)) continue;
      for (const className of group.classes) {
        if (className === entry.class_name) continue;
        const partner = placed.get(
          `${group.grade}|${className}|${entry.day_of_week}|${entry.period}`,
        );
        if (partner?.subject === entry.subject) {
          pushEntry(partner);
        }
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
        const partner = placed.get(
          `${participant.grade}|${participant.class_name}|${entry.day_of_week}|${entry.period}`,
        );
        if (partner?.subject === entry.subject) {
          pushEntry(partner);
        }
      }
    }

    return [...grouped.values()];
  };

  const buildRepairTaskFromEntries = (
    entries: TimetableEntry[],
  ): RepairTask => ({
    sharedAssignment: entries.length > 1,
    isAlt: entries.some((entry) => Boolean(entry.alt_subject)),
    participants: entries.map((entry) => ({
      grade: entry.grade,
      class_name: entry.class_name,
      isSpecial:
        classInfoByKey.get(`${entry.grade}|${entry.class_name}`)?.isSpecial ??
        false,
      subject: entry.subject,
      alt_subject: entry.alt_subject ?? undefined,
      offset: 0,
    })),
  });

  const tryRepairPlacedTask = (
    task: RepairTask,
    anchorDay: DayOfWeek,
    anchorPeriod: Period,
    allowRelocation: boolean,
  ): boolean => {
    if (placeTaskAtAnchor(task, anchorDay, anchorPeriod, false)) {
      return true;
    }
    if (!allowRelocation) {
      return false;
    }

    const maxOffset = Math.max(
      ...task.participants.map((participant) => participant.offset),
    );
    const candidateSlots = shuffle(
      DAYS.flatMap((day) =>
        PERIODS.filter((period) => period + maxOffset <= 6).map((period) => ({
          day,
          period,
        })),
      ),
    );

    for (const { day, period } of candidateSlots) {
      if (day === anchorDay && period === anchorPeriod) continue;
      if (placeTaskAtAnchor(task, day, period, false)) {
        return true;
      }
    }

    return false;
  };

  const resolveTeacherUnavailableAssignments = (): boolean => {
    let changed = false;
    const processedKeys = new Set<string>();
    for (const [key, entry] of prioritizeWithRandomTiebreak(
      [...placed.entries()].filter(
        ([, currentEntry]) =>
          currentEntry.subject && countEntryUnavailableTeachers(currentEntry) > 0,
      ),
      ([key, currentEntry]) =>
        (fixedSlotKeys.has(key) ? -1_000_000 : 0) +
        getEntryTightness(currentEntry),
    )) {
      if (processedKeys.has(key)) continue;

      const groupedEntries = collectGroupedEntries(entry);
      const task = buildRepairTaskFromEntries(groupedEntries);
      const taskKeys = groupedEntries.map(
        (groupedEntry) =>
          `${groupedEntry.grade}|${groupedEntry.class_name}|${groupedEntry.day_of_week}|${groupedEntry.period}`,
      );
      for (const taskKey of taskKeys) {
        processedKeys.add(taskKey);
      }

      const removedEntries: TimetableEntry[] = [];
      let removedAll = true;
      for (const taskKey of taskKeys) {
        const removedEntry = removePlacedEntry(taskKey);
        if (!removedEntry) {
          removedAll = false;
          break;
        }
        removedEntries.push(removedEntry);
      }
      if (!removedAll) {
        for (const removedEntry of removedEntries) {
          addPlacedEntry(removedEntry);
        }
        continue;
      }

      const repaired = tryRepairPlacedTask(
        task,
        entry.day_of_week,
        entry.period,
        !taskKeys.some((taskKey) => fixedSlotKeys.has(taskKey)),
      );
      if (repaired) {
        changed = true;
        continue;
      }

      if (!taskKeys.some((taskKey) => fixedSlotKeys.has(taskKey))) {
        placed_count = Math.max(0, placed_count - removedEntries.length);
        changed = true;
        continue;
      }

      for (const removedEntry of removedEntries) {
        addPlacedEntry(removedEntry);
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
          isSplitSubjectForClass(
            srcEntry.grade,
            srcEntry.class_name,
            srcEntry.subject,
          ),
          srcEntry.class_name,
          ttAssignments,
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
            isSplitSubjectForClass(
              removedDest.grade,
              removedDest.class_name,
              removedDest.subject,
            ),
            removedDest.class_name,
            ttAssignments,
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

  /**
   * クロスグループ競合エントリを、同クラスの別スロットのエントリとスワップして解消する。
   * resolveByDisplacement の対象が「未割当」のみのため、グループ付き競合エントリに対応する別処理。
   */
  const resolveConflictByDisplacement = (): boolean => {
    let changed = false;

    // クロスグループ競合エントリを収集
    const memberSlotMap = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.subject) continue;
      const slotKey = `${entry.day_of_week}|${entry.period}`;
      const addMember = (memberId: string) => {
        const mk = `${memberId}|${slotKey}`;
        const list = memberSlotMap.get(mk) ?? [];
        if (!list.some((x) => x.key === key)) list.push({ key, entry });
        memberSlotMap.set(mk, list);
      };
      for (const teacherId of getEntryTeacherMemberIds(entry)) {
        addMember(teacherId);
      }
    }

    const conflictKeys = new Set<string>();
    for (const conflictEntries of memberSlotMap.values()) {
      if (
        conflictEntries.length <= 1 ||
        isLegitimateSharedAssignment(conflictEntries.map(({ entry }) => entry))
      )
        continue;
      const prioritized = prioritizeWithRandomTiebreak(
        conflictEntries,
        ({ key, entry }) =>
          (fixedSlotKeys.has(key) ? -1_000_000 : 0) + getEntryTightness(entry),
      );
      for (const item of prioritized.slice(1)) {
        if (!fixedSlotKeys.has(item.key)) conflictKeys.add(item.key);
      }
    }

    for (const srcKey of conflictKeys) {
      const srcEntry = placed.get(srcKey);
      if (!srcEntry || fixedSlotKeys.has(srcKey) || srcEntry.cell_group_id)
        continue;
      const isSpecial =
        classInfoByKey.get(`${srcEntry.grade}|${srcEntry.class_name}`)
          ?.isSpecial ?? false;

      const candidateSlots = shuffle(
        DAYS.flatMap((d) => PERIODS.map((p) => ({ day: d, period: p }))),
      );

      for (const { day, period } of candidateSlots) {
        if (day === srcEntry.day_of_week && period === srcEntry.period)
          continue;
        const destKey = `${srcEntry.grade}|${srcEntry.class_name}|${day}|${period}`;
        if (fixedSlotKeys.has(destKey)) continue;
        const destEntry = placed.get(destKey);
        if (!destEntry?.subject || destEntry.cell_group_id) continue;

        if (
          !slotOk(
            srcEntry.grade,
            srcEntry.class_name,
            srcEntry.subject,
            day,
            period,
          )
        )
          continue;

        const removedDest = removePlacedEntry(destKey);
        if (!removedDest) continue;
        const removedSrc = removePlacedEntry(srcKey);
        if (!removedSrc) {
          addPlacedEntry(removedDest);
          continue;
        }

        const assignSrc = findTeacherOrGroup(
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
          isSplitSubjectForClass(
            srcEntry.grade,
            srcEntry.class_name,
            srcEntry.subject,
          ),
          srcEntry.class_name,
          ttAssignments,
        );

        if (!assignSrc) {
          addPlacedEntry(removedSrc);
          addPlacedEntry(removedDest);
          continue;
        }

        addPlacedEntry({
          ...removedSrc,
          day_of_week: day,
          period,
          teacher_id: assignSrc.teacher_id,
          teacher_group_id: assignSrc.teacher_group_id,
        });

        if (
          slotOk(
            removedDest.grade,
            removedDest.class_name,
            removedDest.subject,
            srcEntry.day_of_week,
            srcEntry.period,
          )
        ) {
          const destIsSpecial =
            classInfoByKey.get(`${removedDest.grade}|${removedDest.class_name}`)
              ?.isSpecial ?? false;
          const assignDest = findTeacherOrGroup(
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
            isSplitSubjectForClass(
              removedDest.grade,
              removedDest.class_name,
              removedDest.subject,
            ),
            removedDest.class_name,
            ttAssignments,
          );
          if (assignDest) {
            addPlacedEntry({
              ...removedDest,
              day_of_week: srcEntry.day_of_week,
              period: srcEntry.period,
              teacher_id: assignDest.teacher_id,
              teacher_group_id: assignDest.teacher_group_id,
            });
            changed = true;
            break;
          }
        }

        // ロールバック
        removePlacedEntry(destKey);
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
      }
    }

    return changed;
  };

  // ── 深層修復（Deep Conflict Repair）用ヘルパー ────────────────────────

  // 残存する教員競合数をカウント（変更なし）
  const countTeacherConflicts = (): number => {
    let total = 0;

    const teacherSlotEntries = new Map<string, TimetableEntry[]>();
    for (const entry of placed.values()) {
      if (!entry.subject) continue;
      for (const teacherId of getEntryTeacherMemberIds(entry)) {
        const slotKey = `${teacherId}|${entry.day_of_week}|${entry.period}`;
        const list = teacherSlotEntries.get(slotKey) ?? [];
        list.push(entry);
        teacherSlotEntries.set(slotKey, list);
      }
    }
    for (const list of teacherSlotEntries.values()) {
      if (list.length <= 1) continue;
      if (isLegitimateSharedAssignment(list)) continue;
      total += list.length - 1;
    }

    const groupSlotEntries = new Map<string, TimetableEntry[]>();
    for (const entry of placed.values()) {
      if (!entry.teacher_group_id || !entry.subject) continue;
      const slotKey = `${entry.teacher_group_id}|${entry.day_of_week}|${entry.period}`;
      const list = groupSlotEntries.get(slotKey) ?? [];
      list.push(entry);
      groupSlotEntries.set(slotKey, list);
    }
    for (const list of groupSlotEntries.values()) {
      if (list.length <= 1) continue;
      if (isLegitimateSharedAssignment(list)) continue;
      total += list.length - 1;
    }

    const memberSlotEntries = new Map<string, Set<TimetableEntry>>();
    for (const entry of placed.values()) {
      if (!entry.subject) continue;
      const slotKey = `${entry.day_of_week}|${entry.period}`;
      const pushMember = (memberId: string) => {
        const mk = `${memberId}|${slotKey}`;
        const set = memberSlotEntries.get(mk) ?? new Set<TimetableEntry>();
        set.add(entry);
        memberSlotEntries.set(mk, set);
      };
      for (const teacherId of getEntryTeacherMemberIds(entry)) {
        pushMember(teacherId);
      }
    }
    for (const set of memberSlotEntries.values()) {
      if (set.size <= 1) continue;
      const list = [...set];
      if (isLegitimateSharedAssignment(list)) continue;
      total += list.length - 1;
    }

    return total;
  };

  // 残存競合エントリを優先度付きで列挙
  const listConflictEntries = (): Array<{
    key: string;
    entry: TimetableEntry;
    severity: number;
  }> => {
    const conflictMap = new Map<
      string,
      { key: string; entry: TimetableEntry; severity: number }
    >();

    const addConflict = (
      key: string,
      entry: TimetableEntry,
      sizeMinusOne: number,
      allowFixed = false,
    ) => {
      if (!allowFixed && fixedSlotKeys.has(key)) return;
      const existing = conflictMap.get(key);
      const severity = sizeMinusOne + getEntryTightness(entry);
      if (!existing || severity > existing.severity) {
        conflictMap.set(key, { key, entry, severity });
      }
    };

    const teacherSlots = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.subject) continue;
      for (const teacherId of getEntryTeacherMemberIds(entry)) {
        const slotKey = `${teacherId}|${entry.day_of_week}|${entry.period}`;
        const list = teacherSlots.get(slotKey) ?? [];
        list.push({ key, entry });
        teacherSlots.set(slotKey, list);
      }
    }
    for (const list of teacherSlots.values()) {
      if (list.length <= 1) continue;
      if (isLegitimateSharedAssignment(list.map((x) => x.entry))) continue;
      for (const item of list) {
        addConflict(item.key, item.entry, list.length - 1);
      }
    }

    const groupSlots = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.teacher_group_id || !entry.subject) continue;
      const slotKey = `${entry.teacher_group_id}|${entry.day_of_week}|${entry.period}`;
      const list = groupSlots.get(slotKey) ?? [];
      list.push({ key, entry });
      groupSlots.set(slotKey, list);
    }
    for (const list of groupSlots.values()) {
      if (list.length <= 1) continue;
      if (isLegitimateSharedAssignment(list.map((x) => x.entry))) continue;
      for (const item of list) {
        addConflict(item.key, item.entry, list.length - 1);
      }
    }

    const memberSlots = new Map<
      string,
      Array<{ key: string; entry: TimetableEntry }>
    >();
    for (const [key, entry] of placed.entries()) {
      if (!entry.subject) continue;
      const slotKey = `${entry.day_of_week}|${entry.period}`;
      const pushMember = (memberId: string) => {
        const mk = `${memberId}|${slotKey}`;
        const list = memberSlots.get(mk) ?? [];
        if (!list.some((x) => x.key === key)) list.push({ key, entry });
        memberSlots.set(mk, list);
      };
      for (const teacherId of getEntryTeacherMemberIds(entry)) {
        pushMember(teacherId);
      }
    }
    for (const list of memberSlots.values()) {
      if (list.length <= 1) continue;
      if (isLegitimateSharedAssignment(list.map((x) => x.entry))) continue;
      for (const item of list) {
        addConflict(item.key, item.entry, list.length - 1);
      }
    }

    for (const [key, entry] of placed.entries()) {
      if (!entry.subject) continue;
      const unavailableCount = countEntryUnavailableTeachers(entry);
      if (unavailableCount <= 0) continue;
      addConflict(key, entry, unavailableCount, true);
    }

    return [...conflictMap.values()].sort(
      (a, b) => b.severity - a.severity || Math.random() - 0.5,
    );
  };

  // エントリが合同クラス・学年横断合同のパートナーを持つか判定
  const hasGroupPartners = (entry: TimetableEntry): boolean => {
    return collectGroupedEntries(entry).length > 1;
  };

  // 現在 placed 内のクラス・教科コマ数
  const getClassSubjectCount = (
    grade: number,
    className: string,
    subject: string,
  ): number => {
    let count = 0;
    for (const entry of placed.values()) {
      if (
        entry.grade === grade &&
        entry.class_name === className &&
        entry.subject === subject
      ) {
        count++;
      }
      if (
        entry.grade === grade &&
        entry.class_name === className &&
        entry.alt_subject === subject
      ) {
        count++;
      }
    }
    return count;
  };

  // 同一クラス内の別スロットと教科ごと入れ替える
  const trySubjectSwapInSameClass = (
    srcKey: string,
    srcEntry: TimetableEntry,
  ): boolean => {
    if (fixedSlotKeys.has(srcKey)) return false;
    if (srcEntry.cell_group_id) return false;
    if (hasGroupPartners(srcEntry)) return false;

    const isSpecial =
      classInfoByKey.get(`${srcEntry.grade}|${srcEntry.class_name}`)
        ?.isSpecial ?? false;
    const preConflicts = countTeacherConflicts();

    const candidateSlots = shuffle(
      DAYS.flatMap((d) => PERIODS.map((p) => ({ day: d, period: p }))),
    );

    for (const { day, period } of candidateSlots) {
      if (day === srcEntry.day_of_week && period === srcEntry.period) continue;
      const destKey = `${srcEntry.grade}|${srcEntry.class_name}|${day}|${period}`;
      if (fixedSlotKeys.has(destKey)) continue;
      const destEntry = placed.get(destKey);
      if (!destEntry?.subject) continue;
      if (destEntry.subject === srcEntry.subject) continue;
      if (destEntry.cell_group_id) continue;
      if (hasGroupPartners(destEntry)) continue;

      // スワップ後のスロット適合性を事前確認（仮想削除した状態を模擬するため、
      // 削除→slotOk→ロールバックではなく、両者を一旦削除してから検証）
      const removedSrc = removePlacedEntry(srcKey);
      if (!removedSrc) continue;
      const removedDest = removePlacedEntry(destKey);
      if (!removedDest) {
        addPlacedEntry(removedSrc);
        continue;
      }

      // src教科を destスロットへ、dest教科を srcスロットへ
      const srcOkAtDest = slotOk(
        srcEntry.grade,
        srcEntry.class_name,
        srcEntry.subject,
        day,
        period,
      );
      const destOkAtSrc = slotOk(
        srcEntry.grade,
        srcEntry.class_name,
        destEntry.subject,
        srcEntry.day_of_week,
        srcEntry.period,
      );
      if (!srcOkAtDest || !destOkAtSrc) {
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
        continue;
      }

      const asgSrc = findTeacherOrGroup(
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
        isSplitSubjectForClass(
          srcEntry.grade,
          srcEntry.class_name,
          srcEntry.subject,
        ),
        srcEntry.class_name,
        ttAssignments,
      );
      const asgDest = asgSrc
        ? (() => {
            // src を仮配置してから dest 教員を探す
            const tmpSrc: TimetableEntry = {
              ...removedSrc,
              day_of_week: day,
              period,
              teacher_id: asgSrc.teacher_id,
              teacher_group_id: asgSrc.teacher_group_id,
            };
            addPlacedEntry(tmpSrc);
            const result = findTeacherOrGroup(
              srcEntry.grade,
              isSpecial,
              destEntry.subject,
              srcEntry.day_of_week,
              srcEntry.period,
              teachers,
              teacherGroups,
              usage,
              teacherConstraints,
              groupSubjects,
              isSplitSubjectForClass(
                srcEntry.grade,
                srcEntry.class_name,
                destEntry.subject,
              ),
              srcEntry.class_name,
              ttAssignments,
            );
            removePlacedEntry(
              `${tmpSrc.grade}|${tmpSrc.class_name}|${tmpSrc.day_of_week}|${tmpSrc.period}`,
            );
            return result;
          })()
        : null;

      if (!asgSrc || !asgDest) {
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
        continue;
      }

      addPlacedEntry({
        ...removedSrc,
        day_of_week: day,
        period,
        teacher_id: asgSrc.teacher_id,
        teacher_group_id: asgSrc.teacher_group_id,
      });
      addPlacedEntry({
        ...removedDest,
        day_of_week: srcEntry.day_of_week,
        period: srcEntry.period,
        teacher_id: asgDest.teacher_id,
        teacher_group_id: asgDest.teacher_group_id,
      });

      if (countTeacherConflicts() > preConflicts) {
        // 完全ロールバック
        removePlacedEntry(
          `${removedSrc.grade}|${removedSrc.class_name}|${day}|${period}`,
        );
        removePlacedEntry(
          `${removedDest.grade}|${removedDest.class_name}|${srcEntry.day_of_week}|${srcEntry.period}`,
        );
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
        continue;
      }
      return true;
    }
    return false;
  };

  // 異なるクラスの同一スロットと教科ごと入れ替える（教科時数を厳密管理）
  const trySubjectSwapAcrossClasses = (
    srcKey: string,
    srcEntry: TimetableEntry,
  ): boolean => {
    if (fixedSlotKeys.has(srcKey)) return false;
    if (srcEntry.cell_group_id) return false;
    if (hasGroupPartners(srcEntry)) return false;

    const day = srcEntry.day_of_week;
    const period = srcEntry.period;
    const preConflicts = countTeacherConflicts();
    const isSpecialSrc =
      classInfoByKey.get(`${srcEntry.grade}|${srcEntry.class_name}`)
        ?.isSpecial ?? false;

    const candidateClasses = shuffle([...classes]);

    for (const cls2 of candidateClasses) {
      if (
        cls2.grade === srcEntry.grade &&
        cls2.class_name === srcEntry.class_name
      )
        continue;
      const destKey = `${cls2.grade}|${cls2.class_name}|${day}|${period}`;
      if (fixedSlotKeys.has(destKey)) continue;
      const destEntry = placed.get(destKey);
      if (!destEntry?.subject) continue;
      if (destEntry.subject === srcEntry.subject) continue;
      if (destEntry.cell_group_id) continue;
      if (hasGroupPartners(destEntry)) continue;

      // 教科時数の厳密チェック
      // クラスA: srcSubj -1, destSubj +1
      // クラスB: srcSubj +1, destSubj -1
      const reqAsrc =
        classSubjectRequired.get(
          `${srcEntry.grade}|${srcEntry.class_name}|${srcEntry.subject}`,
        ) ?? 0;
      const reqAdest =
        classSubjectRequired.get(
          `${srcEntry.grade}|${srcEntry.class_name}|${destEntry.subject}`,
        ) ?? 0;
      const reqBsrc =
        classSubjectRequired.get(
          `${cls2.grade}|${cls2.class_name}|${srcEntry.subject}`,
        ) ?? 0;
      const reqBdest =
        classSubjectRequired.get(
          `${cls2.grade}|${cls2.class_name}|${destEntry.subject}`,
        ) ?? 0;

      const curAsrc = getClassSubjectCount(
        srcEntry.grade,
        srcEntry.class_name,
        srcEntry.subject,
      );
      const curAdest = getClassSubjectCount(
        srcEntry.grade,
        srcEntry.class_name,
        destEntry.subject,
      );
      const curBsrc = getClassSubjectCount(
        cls2.grade,
        cls2.class_name,
        srcEntry.subject,
      );
      const curBdest = getClassSubjectCount(
        cls2.grade,
        cls2.class_name,
        destEntry.subject,
      );

      // スワップ後の各カウントが必要数を超えないか
      if (curAsrc - 1 < 0) continue;
      if (curBdest - 1 < 0) continue;
      if (curAdest + 1 > reqAdest) continue;
      if (curBsrc + 1 > reqBsrc) continue;
      // src教科がクラスAで必要数を満たさなくなる、または dest教科がクラスBで満たさなくなる
      if (curAsrc - 1 < 0 || curAsrc - 1 > reqAsrc) continue;
      if (curBdest - 1 < 0 || curBdest - 1 > reqBdest) continue;

      const removedSrc = removePlacedEntry(srcKey);
      if (!removedSrc) continue;
      const removedDest = removePlacedEntry(destKey);
      if (!removedDest) {
        addPlacedEntry(removedSrc);
        continue;
      }

      const isSpecialDest = cls2.isSpecial;

      const srcOkAtDestClass = slotOk(
        cls2.grade,
        cls2.class_name,
        srcEntry.subject,
        day,
        period,
      );
      const destOkAtSrcClass = slotOk(
        srcEntry.grade,
        srcEntry.class_name,
        destEntry.subject,
        day,
        period,
      );
      if (!srcOkAtDestClass || !destOkAtSrcClass) {
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
        continue;
      }

      const asgA = findTeacherOrGroup(
        srcEntry.grade,
        isSpecialSrc,
        destEntry.subject,
        day,
        period,
        teachers,
        teacherGroups,
        usage,
        teacherConstraints,
        groupSubjects,
        isSplitSubjectForClass(
          srcEntry.grade,
          srcEntry.class_name,
          destEntry.subject,
        ),
        srcEntry.class_name,
        ttAssignments,
      );
      const asgB = asgA
        ? (() => {
            // 一時的に Aクラスの dest教科を配置してから Bクラスを探索
            const tmpA: TimetableEntry = {
              ...removedSrc,
              subject: destEntry.subject,
              teacher_id: asgA.teacher_id,
              teacher_group_id: asgA.teacher_group_id,
            };
            addPlacedEntry(tmpA);
            const result = findTeacherOrGroup(
              cls2.grade,
              isSpecialDest,
              srcEntry.subject,
              day,
              period,
              teachers,
              teacherGroups,
              usage,
              teacherConstraints,
              groupSubjects,
              isSplitSubjectForClass(
                cls2.grade,
                cls2.class_name,
                srcEntry.subject,
              ),
              cls2.class_name,
              ttAssignments,
            );
            removePlacedEntry(
              `${tmpA.grade}|${tmpA.class_name}|${tmpA.day_of_week}|${tmpA.period}`,
            );
            return result;
          })()
        : null;

      if (!asgA || !asgB) {
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
        continue;
      }

      addPlacedEntry({
        ...removedSrc,
        subject: destEntry.subject,
        teacher_id: asgA.teacher_id,
        teacher_group_id: asgA.teacher_group_id,
      });
      addPlacedEntry({
        ...removedDest,
        subject: srcEntry.subject,
        teacher_id: asgB.teacher_id,
        teacher_group_id: asgB.teacher_group_id,
      });

      if (countTeacherConflicts() > preConflicts) {
        removePlacedEntry(srcKey);
        removePlacedEntry(destKey);
        addPlacedEntry(removedSrc);
        addPlacedEntry(removedDest);
        continue;
      }
      return true;
    }
    return false;
  };

  // 1つの競合エントリに対して複数戦略を順次試行
  const repairConflictEntry = (key: string, entry: TimetableEntry): boolean => {
    const isSpecial =
      classInfoByKey.get(`${entry.grade}|${entry.class_name}`)?.isSpecial ??
      false;
    const preHardViolations = countPriorityHardViolations();
    const strategies: Array<() => boolean> = [
      () =>
        reassignEntryTeacher(key, entry, {
          allowRelocation: !fixedSlotKeys.has(key),
        }),
      () => {
        const current = placed.get(key);
        if (!current) return false;
        if (fixedSlotKeys.has(key)) return false;
        return relocateEntryWithTeacher(current, isSpecial);
      },
      () => trySubjectSwapInSameClass(key, entry),
      () => trySubjectSwapAcrossClasses(key, entry),
    ];
    for (const strat of strategies) {
      if (!placed.has(key)) {
        if (countPriorityHardViolations() < preHardViolations) return true;
        return false;
      }
      if (strat()) {
        if (countPriorityHardViolations() < preHardViolations) return true;
      }
    }
    return false;
  };

  for (let pass = 0; pass < 8; pass++) {
    const resolvedConflicts = resolveTeacherConflicts();
    const resolvedUnavailable = resolveTeacherUnavailableAssignments();
    const assignedUnassigned = assignTeachersToUnassignedEntries();
    // 通常の再割当で改善がなければ退避付き移動を試みる
    if (!resolvedConflicts && !resolvedUnavailable && !assignedUnassigned) {
      if (
        pass < 4 &&
        (resolveByDisplacement() || resolveConflictByDisplacement())
      )
        continue;
      break;
    }
  }

  // ── Deep Conflict Repair: 残存競合の集中的解消 ────────────────────────
  const DEEP_REPAIR_MAX_ITER = 12;
  const remainingMs = endMs != null ? Math.max(0, endMs - Date.now()) : 5000;
  const deepDeadline = Date.now() + Math.floor(remainingMs * 0.2);
  let prevHardViolationCount = countPriorityHardViolations();
  const deepRepairStartCount = prevHardViolationCount;
  console.log(
    `[DeepRepair] 開始 hardViolations=${prevHardViolationCount} 予算=${Math.floor(remainingMs * 0.2)}ms`,
  );

  for (let iter = 0; iter < DEEP_REPAIR_MAX_ITER; iter++) {
    if (prevHardViolationCount === 0) break;
    if (Date.now() > deepDeadline) break;

    const targets = listConflictEntries();
    if (targets.length === 0) break;

    let progressed = false;
    for (const { key } of targets) {
      if (Date.now() > deepDeadline) break;
      const current = placed.get(key);
      if (!current) continue;
      if (repairConflictEntry(key, current)) {
        progressed = true;
      }
    }

    // 修復で生まれた未割当・別重複を回収
    resolveTeacherConflicts();
    resolveTeacherUnavailableAssignments();
    assignTeachersToUnassignedEntries();

    const newHardViolationCount = countPriorityHardViolations();
    console.log(
      `[DeepRepair] iter=${iter + 1} hardViolations: ${prevHardViolationCount} → ${newHardViolationCount} progressed=${progressed}`,
    );
    if (newHardViolationCount >= prevHardViolationCount && !progressed) break;
    prevHardViolationCount = newHardViolationCount;
  }
  console.log(
    `[DeepRepair] 完了 hardViolations: ${deepRepairStartCount} → ${prevHardViolationCount}`,
  );

  return { entries: [...placed.values()], placed_count, required_count };
}

// ── スコア計算（違反ペナルティ込み） ──────────────────────────────────

function calcDetailedScore(
  result: TryOnceResult,
  teachers: Teacher[],
  teacherConstraints: Record<string, TeacherConstraintSettings>,
  subjectFacility: Record<string, string | null>,
  subjectPlacement: Record<string, SubjectPlacement>,
  teacherGroups: TeacherGroup[] = [],
  subjectPairings: SubjectPairing[] = [],
  classGroups: ClassGroup[] = [],
  crossGradeGroups: CrossGradeGroup[] = [],
): number {
  const { placed_count, entries } = result;
  const withTeacher = entries.filter(
    (e) =>
      e.teacher_id || e.teacher_group_id || (e.teacher_ids?.length ?? 0) > 0,
  ).length;
  const unassignedCount = Math.max(0, entries.length - withTeacher);
  const hardViolationCount = countPriorityHardViolationsForResult(
    entries,
    teachers,
    teacherGroups,
    classGroups,
    crossGradeGroups,
  );
  let score = -hardViolationCount * 1_000_000_000_000;

  // まず教員重複・勤務不可の hard 違反ゼロ化を最優先に比較する
  score += placed_count * 1_000_000_000;
  score += withTeacher * 10_000_000;
  score -= unassignedCount * 2_000_000;

  // 教員時間重複 (-500000/件)
  const teacherSlots = new Map<string, number>();
  for (const e of entries) {
    for (const teacherId of getScoreEntryTeacherIds(e, teacherGroups)) {
      const k = `${teacherId}|${e.day_of_week}|${e.period}`;
      teacherSlots.set(k, (teacherSlots.get(k) ?? 0) + 1);
    }
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
    for (const teacherId of getScoreEntryTeacherIds(e, teacherGroups)) {
      const dk = `${teacherId}|${e.day_of_week}`;
      teacherDaily.set(dk, (teacherDaily.get(dk) ?? 0) + 1);
      teacherWeekly.set(teacherId, (teacherWeekly.get(teacherId) ?? 0) + 1);
    }
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

  // クロスグループ教員重複ペナルティ (-480000/件)
  // 同一教員が異なるグループ経由で同時刻に複数コマに割り当てられているケースを検出
  if (teacherGroups.length > 0) {
    const memberSlots = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      if (!e.subject) continue;
      const slotKey = `${e.day_of_week}|${e.period}`;
      const addMember = (memberId: string) => {
        const mk = `${memberId}|${slotKey}`;
        const list = memberSlots.get(mk) ?? [];
        if (!list.some((x) => x === e)) list.push(e);
        memberSlots.set(mk, list);
      };
      for (const teacherId of getScoreEntryTeacherIds(e, teacherGroups)) {
        addMember(teacherId);
      }
    }
    for (const conflictEntries of memberSlots.values()) {
      if (conflictEntries.length <= 1) continue;
      // 合同クラス・学年横断グループによる正当な重複を除外
      const subject = conflictEntries[0].subject;
      const allSameSubject = conflictEntries.every(
        (e) => e.subject === subject,
      );
      if (allSameSubject) {
        const inClassGroup = classGroups.some(
          (g) =>
            conflictEntries.every(
              (e) => e.grade === g.grade && g.classes.includes(e.class_name),
            ) && !(g.split_subjects || []).includes(subject),
        );
        if (inClassGroup) continue;
        const inCrossGroup = crossGradeGroups.some(
          (g) =>
            g.subject === subject &&
            conflictEntries.every((e) =>
              g.participants.some(
                (p) => p.grade === e.grade && p.class_name === e.class_name,
              ),
            ),
        );
        if (inCrossGroup) continue;
      }
      score -= (conflictEntries.length - 1) * 480_000;
    }
  }

  // 抱き合わせ違反ペナルティ (-400000/件)
  if (subjectPairings.length > 0) {
    const byCell = new Map(
      entries.map((e) => [
        `${e.grade}|${e.class_name}|${e.day_of_week}|${e.period}`,
        e,
      ]),
    );
    const seen = new Set<string>();
    for (const pairing of subjectPairings) {
      const { grade, classA, subjectA, classB, subjectB } = pairing;
      for (const e of entries) {
        if (e.grade !== grade) continue;
        if (e.class_name === classA && e.subject === subjectA) {
          const partner = byCell.get(
            `${grade}|${classB}|${e.day_of_week}|${e.period}`,
          );
          if (partner?.subject !== subjectB) {
            const vk = `${grade}|${classA}|${e.day_of_week}|${e.period}`;
            if (!seen.has(vk)) {
              seen.add(vk);
              score -= 400_000;
            }
          }
        } else if (e.class_name === classB && e.subject === subjectB) {
          const partner = byCell.get(
            `${grade}|${classA}|${e.day_of_week}|${e.period}`,
          );
          if (partner?.subject !== subjectA) {
            const vk = `${grade}|${classB}|${e.day_of_week}|${e.period}`;
            if (!seen.has(vk)) {
              seen.add(vk);
              score -= 400_000;
            }
          }
        }
      }
    }
  }

  return score;
}

// ── メインソルバー ──────────────────────────────────────────────────────

function solve(data: SolverInput): TryOnceResult {
  const {
    teachers = [],
    teacher_groups = [],
    tt_assignments = [],
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

  const classInfoByKey = new Map<string, ClassInfo>(
    classes.map((cls) => [`${cls.grade}|${cls.class_name}`, cls] as const),
  );
  const resolveAltWeekTargetClasses = (classKey: string): ClassInfo[] => {
    const directClass = classInfoByKey.get(classKey);
    if (directClass) {
      return [directClass];
    }

    const scopeMatch = classKey.match(/^(\d+)_(通常|特支)$/);
    if (!scopeMatch) {
      return [];
    }

    const grade = Number(scopeMatch[1]);
    const isSpecial = scopeMatch[2] === "特支";
    return classes.filter(
      (cls) => cls.grade === grade && cls.isSpecial === isSpecial,
    );
  };
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

  // existing_timetable をキーで引けるようにしておく（固定スロットとの照合用）
  const existingByKey = new Map<string, TimetableEntry>();
  for (const entry of existing_timetable) {
    const key = `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`;
    existingByKey.set(key, entry);
  }

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
      if (slot.subject) {
        fixedEntries.push({
          day_of_week: slot.day_of_week,
          period: slot.period,
          grade: cls.grade,
          class_name: cls.class_name,
          subject: slot.subject,
          teacher_id: null,
        });
      } else {
        // 教科なし固定スロット: existing_timetable に教科が入っていれば時数をカウントに含める
        const existing = existingByKey.get(key);
        if (existing?.subject) {
          fixedEntries.push(
            sanitizeExistingEntryAssignments({
              day_of_week: existing.day_of_week,
              period: existing.period,
              grade: existing.grade,
              class_name: existing.class_name,
              subject: existing.subject,
              teacher_id: existing.teacher_id || null,
              teacher_group_id: existing.teacher_group_id ?? null,
              alt_subject: existing.alt_subject ?? null,
              alt_teacher_id: existing.alt_teacher_id ?? null,
              alt_teacher_group_id: existing.alt_teacher_group_id ?? null,
            }),
          );
        }
      }
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

  const altTasks: AltTask[] = [];
  const countRequiredSubject = (classKey: string, subject: string): number =>
    (classRequiredSlots[classKey] || []).reduce(
      (count, slotSubject) => count + (slotSubject === subject ? 1 : 0),
      0,
    );
  const consumeRequiredSubject = (
    classKey: string,
    subject: string,
    count: number,
  ) => {
    let removed = 0;
    classRequiredSlots[classKey] = (classRequiredSlots[classKey] || []).filter(
      (slotSubject) => {
        if (slotSubject === subject && removed < count) {
          removed++;
          return false;
        }
        return true;
      },
    );
    return removed;
  };
  for (const pair of alt_week_pairs) {
    const requestedPairCount = Math.max(0, pair.count ?? 1);
    if (requestedPairCount < 1) continue;

    const targetClasses = resolveAltWeekTargetClasses(pair.class_key);
    const targetClassKeys = new Set(
      targetClasses.map((cls) => `${cls.grade}|${cls.class_name}`),
    );
    const handledClassKeys = new Set<string>();

    for (const cls of targetClasses) {
      const classKey = `${cls.grade}|${cls.class_name}`;
      if (handledClassKeys.has(classKey)) continue;

      const sharedGroup = class_groups.find(
        (group) =>
          group.grade === cls.grade &&
          group.classes.includes(cls.class_name) &&
          !(group.split_subjects || []).includes(pair.subject_a) &&
          !(group.split_subjects || []).includes(pair.subject_b) &&
          group.classes.every((className) =>
            targetClassKeys.has(`${group.grade}|${className}`),
          ),
      );

      const groupClasses = sharedGroup
        ? sharedGroup.classes
            .map((className) => classInfoByKey.get(`${cls.grade}|${className}`))
            .filter((groupClass): groupClass is ClassInfo =>
              Boolean(groupClass),
            )
        : [cls];
      if (groupClasses.length === 0) continue;

      const pairCount = groupClasses.reduce((minCount, groupClass) => {
        const groupClassKey = `${groupClass.grade}|${groupClass.class_name}`;
        const availablePairCount = Math.min(
          countRequiredSubject(groupClassKey, pair.subject_a),
          countRequiredSubject(groupClassKey, pair.subject_b),
        );
        return Math.min(minCount, availablePairCount);
      }, requestedPairCount);

      groupClasses.forEach((groupClass) => {
        handledClassKeys.add(`${groupClass.grade}|${groupClass.class_name}`);
      });
      if (pairCount < 1) continue;

      const resolvedPairCount = groupClasses.reduce((minCount, groupClass) => {
        const groupClassKey = `${groupClass.grade}|${groupClass.class_name}`;
        const removedA = consumeRequiredSubject(
          groupClassKey,
          pair.subject_a,
          pairCount,
        );
        const removedB = consumeRequiredSubject(
          groupClassKey,
          pair.subject_b,
          pairCount,
        );
        return Math.min(minCount, removedA, removedB);
      }, pairCount);

      for (let i = 0; i < resolvedPairCount; i++) {
        altTasks.push({
          sharedAssignment: groupClasses.length > 1,
          participants: groupClasses.map((groupClass) => ({
            grade: groupClass.grade,
            class_name: groupClass.class_name,
            isSpecial: groupClass.isSpecial,
            subject: pair.subject_a,
            alt_subject: pair.subject_b,
            offset: 0,
          })),
        });
      }
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
    ttAssignments: tt_assignments,
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
    endMs,
  };

  // ── グリーディ構築: 時間制限内で多回試行し、最良結果を採用 ──
  let bestResult: TryOnceResult | null = null;
  let bestScore = -Infinity;
  let bestHardViolationCount = Infinity;
  let attempts = 0;
  do {
    attempts++;

    const result = tryOnce(params);
    const hardViolationCount = countPriorityHardViolationsForResult(
      result.entries,
      teachers,
      teacher_groups,
      class_groups,
      cross_grade_groups,
    );
    const score = calcDetailedScore(
      result,
      teachers,
      teacher_constraints,
      subject_facility,
      subject_placement,
      teacher_groups,
      uniqueSubjectPairings,
      class_groups,
      cross_grade_groups,
    );
    if (score > bestScore) {
      bestScore = score;
      bestResult = result;
      bestHardViolationCount = hardViolationCount;
      const pct = Math.min(
        99,
        Math.round(
          (result.placed_count / Math.max(1, result.required_count)) * 100,
        ),
      );
      if (typeof self !== "undefined") {
        self.postMessage({
          type: "progress",
          score: pct,
          attempts,
          placed: result.placed_count,
          required: result.required_count,
        });
      }
    } else if (attempts % 5 === 0 && bestResult) {
      // ハートビート: 改善なしでも5回に1回UI更新（試行継続中を表示）
      const pct = Math.min(
        99,
        Math.round(
          (bestResult.placed_count / Math.max(1, bestResult.required_count)) *
            100,
        ),
      );
      if (typeof self !== "undefined") {
        self.postMessage({
          type: "progress",
          score: pct,
          attempts,
          placed: bestResult.placed_count,
          required: bestResult.required_count,
        });
      }
    }
    if (
      bestResult &&
      bestResult.placed_count >= bestResult.required_count &&
      bestHardViolationCount === 0
    ) {
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
  finalResult.entries = snapshotTimetableEntriesTeacherTeams(finalResult.entries);

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
      if (e.teacher_id) {
        markTeacher(usageForCheck, e.teacher_id, e.day_of_week, e.period);
        // teacher_id + teacher_group_id = 教科グループ個人担当: 個人のみマーク
      } else if (e.teacher_group_id) {
        // ホームルームグループ: グループ自体と全メンバーをマーク
        markTeacher(usageForCheck, e.teacher_group_id, e.day_of_week, e.period);
        const grp = (params.teacherGroups || []).find(
          (g) => g.id === e.teacher_group_id,
        );
        if (grp) {
          for (const memberId of grp.teacher_ids || []) {
            markTeacher(usageForCheck, memberId, e.day_of_week, e.period);
          }
        }
      }
      if (e.alt_teacher_id) {
        markTeacher(usageForCheck, e.alt_teacher_id, e.day_of_week, e.period);
      } else if (e.alt_teacher_group_id) {
        markTeacher(
          usageForCheck,
          e.alt_teacher_group_id,
          e.day_of_week,
          e.period,
        );
        const altGrp = (params.teacherGroups || []).find(
          (g) => g.id === e.alt_teacher_group_id,
        );
        if (altGrp) {
          for (const memberId of altGrp.teacher_ids || []) {
            markTeacher(usageForCheck, memberId, e.day_of_week, e.period);
          }
        }
      }
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
              (params.classGroups || []).some(
                (g) =>
                  g.grade === grade &&
                  g.classes.includes(className) &&
                  (g.split_subjects || []).includes(subject),
              ),
              className,
              params.ttAssignments,
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

export { solve };

if (typeof self !== "undefined") {
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
}
