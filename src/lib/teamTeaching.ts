import type { Teacher, TeacherGroup, TimetableEntry } from "@/types";

export type EntryTeacherKind = "primary" | "alt";

function uniq(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function getGroupMemberIds(
  teacherGroupId: string | null | undefined,
  teacherGroups: TeacherGroup[],
): string[] {
  if (!teacherGroupId) return [];
  return (
    teacherGroups.find((group) => group.id === teacherGroupId)?.teacher_ids ?? []
  );
}

export function getEntryTeacherIds(
  entry: TimetableEntry,
  teacherGroups: TeacherGroup[],
  kind: EntryTeacherKind = "primary",
): string[] {
  const teacherId = kind === "primary" ? entry.teacher_id : entry.alt_teacher_id;
  const teacherIds = kind === "primary" ? entry.teacher_ids : entry.alt_teacher_ids;
  const teacherGroupId =
    kind === "primary" ? entry.teacher_group_id : entry.alt_teacher_group_id;

  return uniq([
    teacherId,
    ...(teacherIds ?? []),
    ...getGroupMemberIds(teacherGroupId, teacherGroups),
  ]);
}

export function entryIncludesTeacher(
  entry: TimetableEntry,
  teacherId: string,
  teacherGroups: TeacherGroup[],
  kind?: EntryTeacherKind,
): boolean {
  if (kind) {
    return getEntryTeacherIds(entry, teacherGroups, kind).includes(teacherId);
  }

  return (
    getEntryTeacherIds(entry, teacherGroups, "primary").includes(teacherId) ||
    getEntryTeacherIds(entry, teacherGroups, "alt").includes(teacherId)
  );
}

export function buildTeacherAssignmentSnapshot(
  teacherId: string | null | undefined,
  teacherGroupId: string | null | undefined,
  teacherIds: string[] | null | undefined,
  teacherGroups: TeacherGroup[],
): {
  teacher_id: string | null;
  teacher_group_id: string | null;
  teacher_ids?: string[] | null;
} {
  const teamIds = uniq([
    teacherId,
    ...(teacherIds ?? []),
    ...getGroupMemberIds(teacherGroupId, teacherGroups),
  ]);
  const representative =
    teacherId && teamIds.includes(teacherId) ? teacherId : (teamIds[0] ?? null);

  return {
    teacher_id: representative,
    teacher_group_id: teacherGroupId ?? null,
    teacher_ids: teamIds.length > 0 ? teamIds : undefined,
  };
}

export function snapshotTimetableEntryTeacherTeams(
  entry: TimetableEntry,
  teacherGroups: TeacherGroup[],
): TimetableEntry {
  const primary = buildTeacherAssignmentSnapshot(
    entry.teacher_id,
    entry.teacher_group_id,
    entry.teacher_ids,
    teacherGroups,
  );
  const alt = buildTeacherAssignmentSnapshot(
    entry.alt_teacher_id,
    entry.alt_teacher_group_id,
    entry.alt_teacher_ids,
    teacherGroups,
  );

  return {
    ...entry,
    teacher_id: primary.teacher_id,
    teacher_group_id: primary.teacher_group_id,
    teacher_ids: primary.teacher_ids,
    alt_teacher_id: alt.teacher_id,
    alt_teacher_group_id: alt.teacher_group_id,
    alt_teacher_ids: alt.teacher_ids,
  };
}

export function snapshotTimetableEntriesTeacherTeams(
  entries: TimetableEntry[],
  teacherGroups: TeacherGroup[],
): TimetableEntry[] {
  return entries.map((entry) =>
    snapshotTimetableEntryTeacherTeams(entry, teacherGroups),
  );
}

export function getTeacherNamesByIds(
  teacherIds: string[],
  teachers: Teacher[],
): string[] {
  return teacherIds.map(
    (teacherId) => teachers.find((teacher) => teacher.id === teacherId)?.name ?? teacherId,
  );
}

export function formatTeacherTeamLabel(
  teacherIds: string[],
  teachers: Teacher[],
  compact = false,
): string {
  const names = getTeacherNamesByIds(teacherIds, teachers);
  if (!compact || names.length <= 2) {
    return names.join("・");
  }
  return `${names.slice(0, 2).join("・")} 他${names.length - 2}名`;
}

export function getEntryTeacherLabel(
  entry: TimetableEntry,
  teachers: Teacher[],
  teacherGroups: TeacherGroup[],
  kind: EntryTeacherKind = "primary",
  compact = false,
): string | null {
  const ids = getEntryTeacherIds(entry, teacherGroups, kind);
  if (ids.length > 0) {
    return formatTeacherTeamLabel(ids, teachers, compact);
  }

  const teacherGroupId =
    kind === "primary" ? entry.teacher_group_id : entry.alt_teacher_group_id;
  if (!teacherGroupId) return null;
  return (
    teacherGroups.find((group) => group.id === teacherGroupId)?.name ??
    teacherGroupId
  );
}