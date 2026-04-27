import type { Teacher, TimetableEntry } from "@/types";

export type EntryTeacherKind = "primary" | "alt";

function uniq(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export function getEntryTeacherIds(
  entry: TimetableEntry,
  kind: EntryTeacherKind = "primary",
): string[] {
  const teacherId =
    kind === "primary" ? entry.teacher_id : entry.alt_teacher_id;
  const teacherIds =
    kind === "primary" ? entry.teacher_ids : entry.alt_teacher_ids;

  return uniq([teacherId, ...(teacherIds ?? [])]);
}

export function entryIncludesTeacher(
  entry: TimetableEntry,
  teacherId: string,
  kind?: EntryTeacherKind,
): boolean {
  if (kind) {
    return getEntryTeacherIds(entry, kind).includes(teacherId);
  }

  return (
    getEntryTeacherIds(entry, "primary").includes(teacherId) ||
    getEntryTeacherIds(entry, "alt").includes(teacherId)
  );
}

export function buildTeacherAssignmentSnapshot(
  teacherId: string | null | undefined,
  teacherIds: string[] | null | undefined,
): {
  teacher_id: string | null;
  teacher_group_id: string | null;
  teacher_ids?: string[] | null;
} {
  const teamIds = uniq([teacherId, ...(teacherIds ?? [])]);
  const representative =
    teacherId && teamIds.includes(teacherId) ? teacherId : (teamIds[0] ?? null);

  return {
    teacher_id: representative,
    teacher_group_id: null,
    teacher_ids: teamIds.length > 0 ? teamIds : undefined,
  };
}

export function snapshotTimetableEntryTeacherTeams(
  entry: TimetableEntry,
): TimetableEntry {
  const primary = buildTeacherAssignmentSnapshot(
    entry.teacher_id,
    entry.teacher_ids,
  );
  const alt = buildTeacherAssignmentSnapshot(
    entry.alt_teacher_id,
    entry.alt_teacher_ids,
  );

  return {
    ...entry,
    teacher_id: primary.teacher_id,
    teacher_group_id: null,
    teacher_ids: primary.teacher_ids,
    alt_teacher_id: alt.teacher_id,
    alt_teacher_group_id: null,
    alt_teacher_ids: alt.teacher_ids,
  };
}

export function snapshotTimetableEntriesTeacherTeams(
  entries: TimetableEntry[],
): TimetableEntry[] {
  return entries.map((entry) => snapshotTimetableEntryTeacherTeams(entry));
}

export function getTeacherNamesByIds(
  teacherIds: string[],
  teachers: Teacher[],
): string[] {
  return teacherIds.map(
    (teacherId) =>
      teachers.find((teacher) => teacher.id === teacherId)?.name ?? teacherId,
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
  kind: EntryTeacherKind = "primary",
  compact = false,
): string | null {
  const ids = getEntryTeacherIds(entry, kind);
  if (ids.length > 0) {
    return formatTeacherTeamLabel(ids, teachers, compact);
  }

  return null;
}
