import { buildTeacherAssignmentSnapshot } from "@/lib/teamTeaching";
import type { TtAssignment } from "@/types";

function uniqTeacherIds(teacherIds: string[]): string[] {
  return [...new Set(teacherIds.filter(Boolean))];
}

function uniqClassNames(classNames: string[]): string[] {
  return [
    ...new Set(
      classNames
        .filter((className): className is string => Boolean(className?.trim()))
        .map((className) => className.trim()),
    ),
  ];
}

export function getTtAssignmentSubjects(assignment: TtAssignment): string[] {
  return [
    ...new Set(
      (assignment.subjects?.length ? assignment.subjects : [assignment.subject])
        .filter((subject): subject is string => Boolean(subject?.trim()))
        .map((subject) => subject.trim()),
    ),
  ];
}

export function getTtAssignmentGrades(assignment: TtAssignment): number[] {
  return [
    ...new Set(
      (assignment.grades?.length
        ? assignment.grades
        : [assignment.grade]
      ).filter((grade): grade is number => grade != null),
    ),
  ];
}

export function getTtAssignmentTargetClasses(
  assignment: TtAssignment,
  grade: number,
): string[] {
  if (
    assignment.target_classes &&
    Object.keys(assignment.target_classes).length
  ) {
    return uniqClassNames(assignment.target_classes[grade] ?? []);
  }
  return uniqClassNames(assignment.class_names ?? []);
}

export function getTtAssignmentTargetClassMap(
  assignment: TtAssignment,
): Record<number, string[]> {
  if (
    assignment.target_classes &&
    Object.keys(assignment.target_classes).length
  ) {
    return Object.fromEntries(
      Object.entries(assignment.target_classes)
        .map(
          ([grade, classNames]) =>
            [Number(grade), uniqClassNames(classNames)] as const,
        )
        .filter(([, classNames]) => classNames.length > 0),
    );
  }

  const classNames = uniqClassNames(assignment.class_names ?? []);
  return Object.fromEntries(
    getTtAssignmentGrades(assignment).map((grade) => [grade, classNames]),
  );
}

export function findMatchingTtAssignment(
  ttAssignments: TtAssignment[],
  grade: number,
  className: string,
  subject: string | null | undefined,
): TtAssignment | null {
  if (!subject) return null;

  return (
    ttAssignments.find(
      (assignment) =>
        assignment.enabled &&
        getTtAssignmentGrades(assignment).includes(grade) &&
        getTtAssignmentSubjects(assignment).includes(subject) &&
        getTtAssignmentTargetClasses(assignment, grade).includes(className),
    ) ?? null
  );
}

export function buildTtAssignmentTeacherSnapshot(
  ttAssignments: TtAssignment[],
  grade: number,
  className: string,
  subject: string | null | undefined,
  preferredTeacherId?: string | null,
): {
  teacher_id: string | null;
  teacher_group_id: null;
  teacher_ids?: string[] | null;
} | null {
  const assignment = findMatchingTtAssignment(
    ttAssignments,
    grade,
    className,
    subject,
  );
  if (!assignment) return null;

  const teacherIds = uniqTeacherIds(assignment.teacher_ids);
  return {
    ...buildTeacherAssignmentSnapshot(
      preferredTeacherId ?? teacherIds[0] ?? null,
      teacherIds,
    ),
    teacher_group_id: null,
  };
}

export function haveSameTeacherSet(
  leftTeacherIds: string[],
  rightTeacherIds: string[],
): boolean {
  const left = uniqTeacherIds(leftTeacherIds).sort();
  const right = uniqTeacherIds(rightTeacherIds).sort();
  if (left.length !== right.length) return false;
  return left.every((teacherId, index) => teacherId === right[index]);
}
