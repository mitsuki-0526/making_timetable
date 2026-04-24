// ═══════════════════════════════════════════════════════════
// バリデーション — ピュアなビジネスロジック
// UIコンポーネントから分離してテスト可能にする
// ═══════════════════════════════════════════════════════════

import { DAYS, PERIODS } from "@/constants";
import type {
  AfternoonDailyViolation,
  ClassGroup,
  CrossGradeGroup,
  DayOfWeek,
  DoublePeriodViolation,
  Facility,
  FacilityViolation,
  FixedSlot,
  FixedSlotViolation,
  Period,
  SchoolStructure,
  SubjectPairing,
  SubjectPeriodViolation,
  SubjectPlacement,
  Teacher,
  TeacherConsecutiveViolation,
  TeacherConstraintSettings,
  TeacherDailyViolation,
  TeacherGroup,
  TeacherTimeConflictViolation,
  TeacherWeeklyViolation,
  TimetableEntry,
} from "@/types";

function getSubjectPairingKey(pairing: SubjectPairing): string {
  const endpointA = `${pairing.classA}|${pairing.subjectA}`;
  const endpointB = `${pairing.classB}|${pairing.subjectB}`;
  return `${[endpointA, endpointB].sort().join("<->")}|${pairing.grade}`;
}

function dedupeSubjectPairings(
  subject_pairings: SubjectPairing[],
): SubjectPairing[] {
  const seen = new Set<string>();
  const deduped: SubjectPairing[] = [];
  for (const pairing of subject_pairings || []) {
    const key = getSubjectPairingKey(pairing);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(pairing);
  }
  return deduped;
}

function getParticipantKey(grade: number, class_name: string): string {
  return `${grade}|${class_name}`;
}

function parseParticipantKey(key: string): {
  grade: number;
  class_name: string;
} {
  const [grade, class_name] = key.split("|");
  return {
    grade: Number(grade),
    class_name,
  };
}

function countCoveredParticipants(groupSets: string[][]): number {
  return groupSets.reduce((sum, group) => sum + group.length, 0);
}

function findBestExactCrossGradeCover(
  remaining: Set<string>,
  candidateGroups: string[][],
  startIndex = 0,
): string[][] {
  let best: string[][] = [];

  for (let index = startIndex; index < candidateGroups.length; index++) {
    const group = candidateGroups[index];
    if (!group.every((participantKey) => remaining.has(participantKey))) {
      continue;
    }

    const nextRemaining = new Set(remaining);
    for (const participantKey of group) {
      nextRemaining.delete(participantKey);
    }

    const cover = [
      group,
      ...findBestExactCrossGradeCover(
        nextRemaining,
        candidateGroups,
        index + 1,
      ),
    ];
    if (countCoveredParticipants(cover) > countCoveredParticipants(best)) {
      best = cover;
    }
  }

  return best;
}

/** 固定コマ違反: 指定スロットに指定教科が入っていない */
export function checkFixedSlotViolations(
  timetable: TimetableEntry[],
  fixed_slots: FixedSlot[],
  structure: SchoolStructure,
): FixedSlotViolation[] {
  const violations: FixedSlotViolation[] = [];
  for (const slot of fixed_slots || []) {
    const { scope, grade, class_name, day_of_week, period, subject, label } =
      slot;

    const targets: { grade: number; class_name: string }[] = [];
    for (const g of structure.grades || []) {
      const allClasses = [...(g.classes || []), ...(g.special_classes || [])];
      for (const cn of allClasses) {
        if (scope === "all") targets.push({ grade: g.grade, class_name: cn });
        else if (scope === "grade" && g.grade === grade)
          targets.push({ grade: g.grade, class_name: cn });
        else if (scope === "class" && g.grade === grade && cn === class_name)
          targets.push({ grade: g.grade, class_name: cn });
      }
    }

    for (const { grade: g, class_name: cn } of targets) {
      const entry = timetable.find(
        (e) =>
          e.grade === g &&
          e.class_name === cn &&
          e.day_of_week === day_of_week &&
          e.period === period,
      );
      if (!entry || entry.subject !== subject) {
        violations.push({
          label: label || subject,
          grade: g,
          class_name: cn,
          day_of_week,
          period,
          expected: subject,
          actual: entry?.subject || "（空欄）",
        });
      }
    }
  }
  return violations;
}

/** 教員の勤務不可時間違反 */
export function checkTeacherUnavailableAssignments(
  timetable: TimetableEntry[],
  teachers: Teacher[],
): {
  teacher_name: string;
  subject: string;
  grade: number;
  class_name: string;
  day: DayOfWeek;
  period: Period;
}[] {
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const violations: {
    teacher_name: string;
    subject: string;
    grade: number;
    class_name: string;
    day: DayOfWeek;
    period: Period;
  }[] = [];

  const pushIfUnavailable = (
    teacherId: string | null | undefined,
    subject: string | null | undefined,
    grade: number,
    class_name: string,
    day: DayOfWeek,
    period: Period,
  ) => {
    if (!teacherId || !subject) return;
    const teacher = teacherById.get(teacherId);
    if (!teacher) return;
    if (
      !teacher.unavailable_times.some(
        (time) => time.day_of_week === day && time.period === period,
      )
    ) {
      return;
    }

    violations.push({
      teacher_name: teacher.name,
      subject,
      grade,
      class_name,
      day,
      period,
    });
  };

  for (const entry of timetable) {
    pushIfUnavailable(
      entry.teacher_id,
      entry.subject,
      entry.grade,
      entry.class_name,
      entry.day_of_week,
      entry.period,
    );
    pushIfUnavailable(
      entry.alt_teacher_id,
      entry.alt_subject,
      entry.grade,
      entry.class_name,
      entry.day_of_week,
      entry.period,
    );
  }

  return violations;
}

/** 抱き合わせ教科違反 */
export function checkSubjectPairingViolations(
  timetable: TimetableEntry[],
  subject_pairings: SubjectPairing[],
): {
  grade: number;
  class_name: string;
  paired_class_name: string;
  day: DayOfWeek;
  period: Period;
  subject: string;
  expected: string;
}[] {
  const violations: {
    grade: number;
    class_name: string;
    paired_class_name: string;
    day: DayOfWeek;
    period: Period;
    subject: string;
    expected: string;
  }[] = [];

  const byCell = new Map(
    timetable.map((entry) => [
      `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`,
      entry,
    ]),
  );

  for (const pairing of dedupeSubjectPairings(subject_pairings)) {
    for (const day of DAYS) {
      for (const period of PERIODS) {
        const entryA = byCell.get(
          `${pairing.grade}|${pairing.classA}|${day}|${period}`,
        );
        const entryB = byCell.get(
          `${pairing.grade}|${pairing.classB}|${day}|${period}`,
        );

        const hasA = entryA?.subject === pairing.subjectA;
        const hasB = entryB?.subject === pairing.subjectB;
        if (hasA === hasB) continue;

        if (hasA) {
          violations.push({
            grade: pairing.grade,
            class_name: pairing.classB,
            paired_class_name: pairing.classA,
            day,
            period,
            subject: pairing.subjectB,
            expected: pairing.subjectA,
          });
        }
        if (hasB) {
          violations.push({
            grade: pairing.grade,
            class_name: pairing.classA,
            paired_class_name: pairing.classB,
            day,
            period,
            subject: pairing.subjectA,
            expected: pairing.subjectB,
          });
        }
      }
    }
  }

  return violations;
}

/** 合同クラスの同期違反 */
export function checkClassGroupSyncViolations(
  timetable: TimetableEntry[],
  class_groups: ClassGroup[] = [],
): {
  grade: number;
  class_name: string;
  day: DayOfWeek;
  period: Period;
  subject: string;
  group_classes: string[];
}[] {
  const violations: {
    grade: number;
    class_name: string;
    day: DayOfWeek;
    period: Period;
    subject: string;
    group_classes: string[];
  }[] = [];

  const byCell = new Map(
    timetable.map((entry) => [
      `${entry.grade}|${entry.class_name}|${entry.day_of_week}|${entry.period}`,
      entry,
    ]),
  );

  for (const group of class_groups) {
    for (const day of DAYS) {
      for (const period of PERIODS) {
        const entries = group.classes.map((class_name) =>
          byCell.get(`${group.grade}|${class_name}|${day}|${period}`),
        );
        const nonSplitEntries = entries.filter(
          (entry): entry is TimetableEntry =>
            Boolean(entry?.subject) &&
            !group.split_subjects.includes(entry.subject),
        );

        if (nonSplitEntries.length === 0) continue;

        const expectedSubject = nonSplitEntries[0].subject;
        const allSynced = group.classes.every((class_name) => {
          const entry = byCell.get(
            `${group.grade}|${class_name}|${day}|${period}`,
          );
          return entry?.subject === expectedSubject;
        });

        if (allSynced) continue;

        for (const class_name of group.classes) {
          const entry = byCell.get(
            `${group.grade}|${class_name}|${day}|${period}`,
          );
          if (entry?.subject === expectedSubject) continue;
          violations.push({
            grade: group.grade,
            class_name,
            day,
            period,
            subject: expectedSubject,
            group_classes: group.classes,
          });
        }
      }
    }
  }

  return violations;
}

/** 合同授業の同期違反 */
export function checkCrossGradeGroupViolations(
  timetable: TimetableEntry[],
  cross_grade_groups: CrossGradeGroup[] = [],
): {
  name: string;
  grade: number;
  class_name: string;
  day: DayOfWeek;
  period: Period;
  subject: string;
}[] {
  const violations: {
    name: string;
    grade: number;
    class_name: string;
    day: DayOfWeek;
    period: Period;
    subject: string;
  }[] = [];

  const actualBySlotSubject = new Map<
    string,
    {
      subject: string;
      day: DayOfWeek;
      period: Period;
      actualParticipants: Set<string>;
    }
  >();

  for (const entry of timetable) {
    if (!entry.subject) continue;
    const slotKey = `${entry.subject}|${entry.day_of_week}|${entry.period}`;
    const current = actualBySlotSubject.get(slotKey) ?? {
      subject: entry.subject,
      day: entry.day_of_week,
      period: entry.period,
      actualParticipants: new Set<string>(),
    };
    current.actualParticipants.add(
      getParticipantKey(entry.grade, entry.class_name),
    );
    actualBySlotSubject.set(slotKey, current);
  }

  for (const {
    subject,
    day,
    period,
    actualParticipants,
  } of actualBySlotSubject.values()) {
    const relevantGroups = cross_grade_groups
      .filter(
        (group) =>
          group.subject === subject &&
          group.participants?.some((participant) =>
            actualParticipants.has(
              getParticipantKey(participant.grade, participant.class_name),
            ),
          ),
      )
      .map((group) => ({
        group,
        participantKeys: group.participants.map((participant) =>
          getParticipantKey(participant.grade, participant.class_name),
        ),
      }));

    if (relevantGroups.length === 0) continue;

    const exactCandidateGroups = relevantGroups
      .map((item) => item.participantKeys)
      .filter((participantKeys) =>
        participantKeys.every((participantKey) =>
          actualParticipants.has(participantKey),
        ),
      )
      .sort((a, b) => b.length - a.length);

    const exactCover = findBestExactCrossGradeCover(
      actualParticipants,
      exactCandidateGroups,
    );
    const coveredParticipants = new Set(exactCover.flat());
    if (coveredParticipants.size === actualParticipants.size) {
      continue;
    }

    const remainingParticipants = [...actualParticipants].filter(
      (participantKey) => !coveredParticipants.has(participantKey),
    );
    const reported = new Set<string>();

    for (const participantKey of remainingParticipants) {
      const bestGroup = relevantGroups
        .filter(({ participantKeys }) =>
          participantKeys.includes(participantKey),
        )
        .map(({ group, participantKeys }) => {
          const missing = participantKeys.filter(
            (key) => !actualParticipants.has(key),
          );
          const matchedCount = participantKeys.filter((key) =>
            actualParticipants.has(key),
          ).length;
          return {
            group,
            participantKeys,
            missing,
            matchedCount,
          };
        })
        .filter(
          ({ matchedCount, missing }) => matchedCount > 0 && missing.length > 0,
        )
        .sort(
          (a, b) =>
            a.missing.length - b.missing.length ||
            a.participantKeys.length - b.participantKeys.length,
        )[0];

      if (!bestGroup) continue;

      for (const missingKey of bestGroup.missing) {
        const reportKey = `${subject}|${day}|${period}|${bestGroup.group.id}|${missingKey}`;
        if (reported.has(reportKey)) continue;
        reported.add(reportKey);

        const parsed = parseParticipantKey(missingKey);
        violations.push({
          name: bestGroup.group.name,
          grade: parsed.grade,
          class_name: parsed.class_name,
          day,
          period,
          subject,
        });
      }
    }
  }

  return violations;
}

/** 教員の1日最大コマ数違反 */
export function checkTeacherDailyViolations(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  teacher_constraints: Record<string, TeacherConstraintSettings>,
): TeacherDailyViolation[] {
  const violations: TeacherDailyViolation[] = [];
  for (const teacher of teachers) {
    const max_d = teacher_constraints[teacher.id]?.max_daily;
    if (!max_d) continue;
    for (const day of DAYS) {
      const count = timetable.filter(
        (e) => e.teacher_id === teacher.id && e.day_of_week === day,
      ).length;
      if (count > max_d) {
        violations.push({ teacher: teacher.name, day, count, limit: max_d });
      }
    }
  }
  return violations;
}

/** 教員の連続コマ数違反 */
export function checkTeacherConsecutiveViolations(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  teacher_constraints: Record<string, TeacherConstraintSettings>,
): TeacherConsecutiveViolation[] {
  const violations: TeacherConsecutiveViolation[] = [];
  for (const teacher of teachers) {
    const max_c = teacher_constraints[teacher.id]?.max_consecutive;
    if (!max_c) continue;
    for (const day of DAYS) {
      let consecutive = 0;
      let maxRun = 0;
      for (const period of PERIODS) {
        const assigned = timetable.some(
          (e) =>
            e.teacher_id === teacher.id &&
            e.day_of_week === day &&
            e.period === period,
        );
        if (assigned) {
          consecutive++;
          if (consecutive > maxRun) maxRun = consecutive;
        } else {
          consecutive = 0;
        }
      }
      if (maxRun > max_c) {
        violations.push({ teacher: teacher.name, day, maxRun, limit: max_c });
      }
    }
  }
  return violations;
}

/** 教科の配置可能時限違反 */
export function checkSubjectPeriodViolations(
  timetable: TimetableEntry[],
  subject_placement: Record<string, SubjectPlacement>,
): SubjectPeriodViolation[] {
  const violations: SubjectPeriodViolation[] = [];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    const allowed = placement.allowed_periods || [];
    if (!allowed.length) continue;
    const badEntries = timetable.filter(
      (e) => e.subject === subject && !allowed.includes(e.period),
    );
    for (const e of badEntries) {
      violations.push({
        subject,
        grade: e.grade,
        class_name: e.class_name,
        day: e.day_of_week,
        period: e.period,
        allowed,
      });
    }
  }
  return violations;
}

/** 教科の午後1日最大コマ数違反 */
export function checkAfternoonDailyViolations(
  timetable: TimetableEntry[],
  subject_placement: Record<string, SubjectPlacement>,
  lunch_after_period: number,
): AfternoonDailyViolation[] {
  const violations: AfternoonDailyViolation[] = [];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    const max_pm = placement.max_afternoon_daily;
    if (max_pm == null) continue;
    const counts: Record<string, number> = {};
    for (const e of timetable) {
      if (e.subject !== subject) continue;
      if (e.period <= lunch_after_period) continue;
      const key = `${e.grade}|${e.class_name}|${e.day_of_week}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      if (count > max_pm) {
        const [grade, class_name, day] = key.split("|");
        violations.push({
          subject,
          grade: Number(grade),
          class_name,
          day: day as DayOfWeek,
          count,
          limit: max_pm,
        });
      }
    }
  }
  return violations;
}

/** 施設競合チェック: 同一時限に同施設を複数クラスが使用 */
export function checkFacilityViolations(
  timetable: TimetableEntry[],
  facilities: Facility[],
  subject_facility: Record<string, string | null>,
): FacilityViolation[] {
  if (!facilities?.length || !subject_facility) return [];
  const violations: FacilityViolation[] = [];
  for (const fac of facilities) {
    for (const day of DAYS) {
      for (const period of PERIODS) {
        const users = timetable.filter(
          (e) =>
            e.day_of_week === day &&
            e.period === period &&
            subject_facility[e.subject] === fac.id,
        );
        if (users.length > 1) {
          violations.push({
            facility: fac.name,
            day,
            period: period as Period,
            classes: users.map(
              (e) => `${e.grade}年${e.class_name}(${e.subject})`,
            ),
          });
        }
      }
    }
  }
  return violations;
}

/** 2コマ連続授業チェック: 孤立した単発コマを検出 */
export function checkDoublePeriodViolations(
  timetable: TimetableEntry[],
  subject_placement: Record<string, SubjectPlacement>,
): DoublePeriodViolation[] {
  const violations: DoublePeriodViolation[] = [];
  for (const [subject, placement] of Object.entries(subject_placement || {})) {
    if (!placement.requires_double) continue;
    const counts: Record<string, number> = {};
    for (const e of timetable) {
      if (e.subject !== subject) continue;
      const key = `${e.grade}|${e.class_name}|${e.day_of_week}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      if (count % 2 !== 0) {
        const [grade, class_name, day] = key.split("|");
        violations.push({
          subject,
          grade: Number(grade),
          class_name,
          day: day as DayOfWeek,
          count,
        });
      }
    }
  }
  return violations;
}

/** 同一教員が同時刻に複数クラスに割り当てられている（教員時間重複） */
export function checkTeacherTimeConflicts(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  class_groups: ClassGroup[] = [],
  cross_grade_groups: CrossGradeGroup[] = [],
): TeacherTimeConflictViolation[] {
  const violations: TeacherTimeConflictViolation[] = [];
  const bySlot: Record<string, TimetableEntry[]> = {};
  for (const e of timetable) {
    if (!e.teacher_id || !e.subject) continue;
    const key = `${e.teacher_id}-${e.day_of_week}-${e.period}`;
    bySlot[key] = bySlot[key] ?? [];
    bySlot[key].push(e);
  }
  for (const entries of Object.values(bySlot)) {
    if (entries.length <= 1) continue;

    // 合同クラスによる正当な重複かチェック
    const subject = entries[0].subject;
    const allSameSubject = entries.every((e) => e.subject === subject);
    if (allSameSubject) {
      // 1) cell_group_id でグルーピングされている場合は合同扱い
      const cgId = entries[0].cell_group_id;
      if (cgId && entries.every((e) => e.cell_group_id === cgId)) continue;

      // 2) 学年内の class_groups に含まれるクラス群であれば合同扱い（split_subjects を除外）
      const classGroup = class_groups.find((g) =>
        entries.every(
          (e) => e.grade === g.grade && g.classes.includes(e.class_name),
        ),
      );
      if (classGroup && !(classGroup.split_subjects || []).includes(subject))
        continue;

      // 3) 複数学年合同（cross_grade_groups）で参加者に一致し、対象科目が一致する場合も合同扱い
      const crossGroup = cross_grade_groups.find(
        (g) =>
          g.subject === subject &&
          entries.every((e) =>
            g.participants.some(
              (p) => p.grade === e.grade && p.class_name === e.class_name,
            ),
          ),
      );
      if (crossGroup) continue;
    }

    const teacher = teachers.find((t) => t.id === entries[0].teacher_id);
    const teacher_name = teacher?.name ?? entries[0].teacher_id;
    for (const e of entries) {
      violations.push({
        teacher_name,
        teacher_id: e.teacher_id as string,
        day: e.day_of_week,
        period: e.period,
        grade: e.grade,
        class_name: e.class_name,
      });
    }
  }
  return violations;
}

/** 同一教員グループが同時刻に複数クラスに割り当てられている */
export function checkTeacherGroupConflicts(
  timetable: TimetableEntry[],
  teacher_groups: TeacherGroup[],
  class_groups: ClassGroup[] = [],
  cross_grade_groups: CrossGradeGroup[] = [],
): {
  group_name: string;
  day: DayOfWeek;
  period: Period;
  grade: number;
  class_name: string;
}[] {
  const violations: {
    group_name: string;
    day: DayOfWeek;
    period: Period;
    grade: number;
    class_name: string;
  }[] = [];
  const bySlot: Record<string, TimetableEntry[]> = {};
  for (const e of timetable) {
    if (!e.teacher_group_id || !e.subject) continue;
    const key = `${e.teacher_group_id}-${e.day_of_week}-${e.period}`;
    bySlot[key] = bySlot[key] ?? [];
    bySlot[key].push(e);
  }
  for (const entries of Object.values(bySlot)) {
    if (entries.length <= 1) continue;
    // 合同クラスによる正当な重複かチェック
    const subject = entries[0].subject;
    const allSameSubject = entries.every((e) => e.subject === subject);
    if (allSameSubject) {
      const cgId = entries[0].cell_group_id;
      if (cgId && entries.every((e) => e.cell_group_id === cgId)) continue;

      const classGroup = class_groups.find((g) =>
        entries.every(
          (e) => e.grade === g.grade && g.classes.includes(e.class_name),
        ),
      );
      if (classGroup && !(classGroup.split_subjects || []).includes(subject))
        continue;

      const crossGroup = cross_grade_groups.find(
        (g) =>
          g.subject === subject &&
          entries.every((e) =>
            g.participants.some(
              (p) => p.grade === e.grade && p.class_name === e.class_name,
            ),
          ),
      );
      if (crossGroup) continue;
    }
    const tg = teacher_groups.find((g) => g.id === entries[0].teacher_group_id);
    const group_name = tg?.name ?? entries[0].teacher_group_id ?? "";
    for (const e of entries) {
      violations.push({
        group_name,
        day: e.day_of_week,
        period: e.period,
        grade: e.grade,
        class_name: e.class_name,
      });
    }
  }
  return violations;
}

/** グループ間での教員メンバー重複（異なるグループ同士、またはグループと直接割当で同一教員が同時刻に重なる） */
export function checkCrossGroupTeacherConflicts(
  timetable: TimetableEntry[],
  teacher_groups: TeacherGroup[],
  teachers: Teacher[],
  class_groups: ClassGroup[] = [],
  cross_grade_groups: CrossGradeGroup[] = [],
): {
  teacher_name: string;
  teacher_id: string;
  day: DayOfWeek;
  period: Period;
  grade: number;
  class_name: string;
}[] {
  const violations: {
    teacher_name: string;
    teacher_id: string;
    day: DayOfWeek;
    period: Period;
    grade: number;
    class_name: string;
  }[] = [];

  // スロットごとに「コマと担当教員IDのリスト」を収集
  type SlotEntry = { entry: TimetableEntry; teacher_id: string };
  const bySlot: Record<string, SlotEntry[]> = {};

  for (const e of timetable) {
    if (!e.subject) continue;
    const slotKey = `${e.day_of_week}-${e.period}`;

    if (e.teacher_id) {
      bySlot[slotKey] = bySlot[slotKey] ?? [];
      bySlot[slotKey].push({ entry: e, teacher_id: e.teacher_id });
    }

    if (e.teacher_group_id) {
      const grp = teacher_groups.find((g) => g.id === e.teacher_group_id);
      if (grp) {
        bySlot[slotKey] = bySlot[slotKey] ?? [];
        for (const tid of grp.teacher_ids) {
          bySlot[slotKey].push({ entry: e, teacher_id: tid });
        }
      }
    }
  }

  for (const slotEntries of Object.values(bySlot)) {
    // 教員IDごとに担当コマを集計
    const byTeacher: Record<string, TimetableEntry[]> = {};
    for (const { entry, teacher_id } of slotEntries) {
      byTeacher[teacher_id] = byTeacher[teacher_id] ?? [];
      // 同じコマを重複登録しない
      if (!byTeacher[teacher_id].some((x) => x === entry)) {
        byTeacher[teacher_id].push(entry);
      }
    }

    for (const [tid, entries] of Object.entries(byTeacher)) {
      if (entries.length <= 1) continue;

      // 合同クラス・cell_group による正当な重複かチェック
      const subject = entries[0].subject;
      const allSameSubject = entries.every((e) => e.subject === subject);
      if (allSameSubject) {
        const cgId = entries[0].cell_group_id;
        if (cgId && entries.every((e) => e.cell_group_id === cgId)) continue;

        const classGroup = class_groups.find((g) =>
          entries.every(
            (e) => e.grade === g.grade && g.classes.includes(e.class_name),
          ),
        );
        if (classGroup && !(classGroup.split_subjects || []).includes(subject))
          continue;

        const crossGroup = cross_grade_groups.find(
          (g) =>
            g.subject === subject &&
            entries.every((e) =>
              g.participants.some(
                (p) => p.grade === e.grade && p.class_name === e.class_name,
              ),
            ),
        );
        if (crossGroup) continue;
      }

      const teacher = teachers.find((t) => t.id === tid);
      const teacher_name = teacher?.name ?? tid;
      for (const e of entries) {
        violations.push({
          teacher_name,
          teacher_id: tid,
          day: e.day_of_week,
          period: e.period,
          grade: e.grade,
          class_name: e.class_name,
        });
      }
    }
  }

  return violations;
}

/** 教員・グループが未割り当てのコマ */
export function checkUnassignedSlots(timetable: TimetableEntry[]): {
  grade: number;
  class_name: string;
  day: DayOfWeek;
  period: Period;
  subject: string;
}[] {
  return timetable
    .filter((e) => e.subject && !e.teacher_id && !e.teacher_group_id)
    .map((e) => ({
      grade: e.grade,
      class_name: e.class_name,
      day: e.day_of_week,
      period: e.period,
      subject: e.subject,
    }));
}

/** 教員の週総コマ数チェック */
export function checkTeacherWeeklyViolations(
  timetable: TimetableEntry[],
  teachers: Teacher[],
  teacher_constraints: Record<string, TeacherConstraintSettings>,
): TeacherWeeklyViolation[] {
  const violations: TeacherWeeklyViolation[] = [];
  for (const teacher of teachers) {
    const max_w = teacher_constraints[teacher.id]?.max_weekly;
    if (!max_w) continue;
    const count = timetable.filter((e) => e.teacher_id === teacher.id).length;
    if (count > max_w) {
      violations.push({ teacher: teacher.name, count, limit: max_w });
    }
  }
  return violations;
}
