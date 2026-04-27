import type { StateCreator } from "zustand";
import { create } from "zustand";
import { snapshotTimetableEntriesTeacherTeams } from "@/lib/teamTeaching";
import type { TimetableFileData, TimetableStore } from "@/types";
import { createConstraintSlice } from "./slices/constraintSlice";
import { createSettingsSlice } from "./slices/settingsSlice";
import { createStructureSlice } from "./slices/structureSlice";
import { createTeacherSlice } from "./slices/teacherSlice";
import { createTimetableSlice } from "./slices/timetableSlice";

function sanitizeImportedStructure(
  incoming: TimetableFileData["structure"] | undefined,
) {
  if (!incoming) return incoming;

  const grades = incoming.grades.map((grade) => {
    const mergedClasses = Array.from(
      new Set([...(grade.classes ?? []), ...(grade.special_classes ?? [])]),
    );

    return {
      ...grade,
      classes: mergedClasses,
      special_classes: [],
    };
  });

  const requiredHours = { ...incoming.required_hours };
  for (const grade of grades) {
    const normalKey = `${grade.grade}_通常`;
    const specialKey = `${grade.grade}_特支`;
    const normalHours = { ...(requiredHours[normalKey] ?? {}) };
    const specialHours = requiredHours[specialKey] ?? {};

    for (const [subject, hours] of Object.entries(specialHours)) {
      if (normalHours[subject] == null) {
        normalHours[subject] = hours;
      }
    }

    requiredHours[normalKey] = normalHours;
    delete requiredHours[specialKey];
  }

  return {
    ...incoming,
    grades,
    required_hours: requiredHours,
  };
}

type LegacyTeacherGroup = {
  id: string;
  teacher_ids?: string[] | null;
};

type LegacyTimetableEntry = TimetableFileData["timetable"][number] & {
  teacher_group_id?: string | null;
  alt_teacher_group_id?: string | null;
};

function buildLegacyTeacherSnapshot(
  teacherId: string | null | undefined,
  teacherIds: string[] | null | undefined,
  teacherGroupId: string | null | undefined,
  groupMembersById: Map<string, string[]>,
) {
  const mergedTeacherIds = new Set<string>();
  if (teacherId) {
    mergedTeacherIds.add(teacherId);
  }
  for (const candidateId of teacherIds ?? []) {
    if (candidateId) {
      mergedTeacherIds.add(candidateId);
    }
  }
  for (const memberId of groupMembersById.get(teacherGroupId ?? "") ?? []) {
    if (memberId) {
      mergedTeacherIds.add(memberId);
    }
  }

  const resolvedTeacherIds = [...mergedTeacherIds];
  return {
    teacher_id:
      teacherId && mergedTeacherIds.has(teacherId)
        ? teacherId
        : (resolvedTeacherIds[0] ?? null),
    teacher_ids: resolvedTeacherIds.length > 0 ? resolvedTeacherIds : undefined,
  };
}

function sanitizeImportedTimetable(
  incoming: TimetableFileData["timetable"] | undefined,
  legacyTeacherGroups?: LegacyTeacherGroup[],
) {
  if (!incoming) return incoming;

  const groupMembersById = new Map(
    (legacyTeacherGroups ?? []).map((group) => [
      group.id,
      [...new Set((group.teacher_ids ?? []).filter(Boolean))],
    ]),
  );

  const expandedEntries = incoming.map((entry) => {
    const legacyEntry = entry as LegacyTimetableEntry;
    const primary = buildLegacyTeacherSnapshot(
      legacyEntry.teacher_id,
      legacyEntry.teacher_ids,
      legacyEntry.teacher_group_id,
      groupMembersById,
    );
    const alt = buildLegacyTeacherSnapshot(
      legacyEntry.alt_teacher_id ?? null,
      legacyEntry.alt_teacher_ids,
      legacyEntry.alt_teacher_group_id,
      groupMembersById,
    );

    return {
      ...legacyEntry,
      teacher_id: primary.teacher_id,
      teacher_ids: primary.teacher_ids,
      teacher_group_id: null,
      alt_teacher_id: alt.teacher_id,
      alt_teacher_ids: alt.teacher_ids,
      alt_teacher_group_id: null,
    };
  });

  return snapshotTimetableEntriesTeacherTeams(expandedEntries);
}

export const useTimetableStore = create<TimetableStore>()((...a) => {
  type StoreCreatorArgs = Parameters<
    StateCreator<TimetableStore, [], [], TimetableStore>
  >;

  const [originalSet, get, api] = a as StoreCreatorArgs;

  const MAX_HISTORY = 100;
  const past: TimetableFileData[] = [];
  const future: TimetableFileData[] = [];
  let isRestoring = false;
  let isInitializing = true;

  const getHistoryFlags = () => ({
    undoAvailable: past.length > 0,
    redoAvailable: future.length > 0,
  });

  const getSnapshot = (): TimetableFileData => {
    const s = get();
    return {
      teachers: s.teachers,
      tt_assignments: s.tt_assignments,
      class_groups: s.class_groups,
      structure: s.structure,
      timetable: s.timetable,
      subject_constraints: s.subject_constraints,
      subject_pairings: s.subject_pairings,
      cell_groups: s.cell_groups,
      fixed_slots: s.fixed_slots,
      teacher_constraints: s.teacher_constraints,
      subject_placement: s.subject_placement,
      facilities: s.facilities,
      subject_facility: s.subject_facility,
      alt_week_pairs: s.alt_week_pairs,
      subject_sequences: s.subject_sequences,
      cross_grade_groups: s.cross_grade_groups,
      settings: s.settings,
    };
  };

  const wrappedSet: typeof originalSet = (partial, replace) => {
    if (!isRestoring && !isInitializing) {
      try {
        const snap = getSnapshot();
        past.push(snap);
        if (past.length > MAX_HISTORY) past.shift();
        future.length = 0;
      } catch {
        // ignore snapshot errors
      }
    }

    if (typeof partial === "function") {
      if (replace === true) {
        return originalSet(
          (state: TimetableStore) => ({
            ...state,
            ...partial(state),
            ...getHistoryFlags(),
          }),
          true,
        );
      }

      return originalSet((state: TimetableStore) => ({
        ...partial(state),
        ...getHistoryFlags(),
      }));
    }

    if (replace === true) {
      return originalSet(
        {
          ...get(),
          ...partial,
          ...getHistoryFlags(),
        },
        true,
      );
    }

    return originalSet({
      ...partial,
      ...getHistoryFlags(),
    });
  };

  const slices = {
    ...createTimetableSlice(wrappedSet, get, api),
    ...createTeacherSlice(wrappedSet, get, api),
    ...createStructureSlice(wrappedSet, get, api),
    ...createConstraintSlice(wrappedSet, get, api),
    ...createSettingsSlice(wrappedSet, get, api),
  };

  // 初期化フェーズ終了
  isInitializing = false;

  const restoreSnapshot = (snap: TimetableFileData) => {
    originalSet((state) => ({
      teachers: snap.teachers,
      tt_assignments: snap.tt_assignments,
      class_groups: snap.class_groups,
      structure: snap.structure,
      timetable: snap.timetable,
      subject_constraints: snap.subject_constraints,
      subject_pairings: snap.subject_pairings,
      cell_groups: snap.cell_groups,
      fixed_slots: snap.fixed_slots,
      teacher_constraints: snap.teacher_constraints,
      subject_placement: snap.subject_placement,
      facilities: snap.facilities,
      subject_facility: snap.subject_facility,
      alt_week_pairs: snap.alt_week_pairs,
      subject_sequences: snap.subject_sequences,
      cross_grade_groups: snap.cross_grade_groups,
      settings: {
        ...state.settings,
        ...snap.settings,
      },
      ...getHistoryFlags(),
    }));
  };

  const undo = () => {
    if (past.length === 0) return;
    const snap = past.pop();
    if (!snap) return;
    try {
      const current = getSnapshot();
      future.push(current);
    } catch {
      // ignore
    }
    isRestoring = true;
    restoreSnapshot(snap);
    isRestoring = false;
  };

  const redo = () => {
    if (future.length === 0) return;
    const snap = future.pop();
    if (!snap) return;
    try {
      const current = getSnapshot();
      past.push(current);
    } catch {
      // ignore
    }
    isRestoring = true;
    restoreSnapshot(snap);
    isRestoring = false;
  };

  const canUndo = () => get().undoAvailable;
  const canRedo = () => get().redoAvailable;
  const clearHistory = () => {
    past.length = 0;
    future.length = 0;
    originalSet(() => getHistoryFlags());
  };

  const importState = (newState: Partial<TimetableFileData>) => {
    const sanitizedStructure = sanitizeImportedStructure(newState.structure);
    const sanitizedTimetable = sanitizeImportedTimetable(
      newState.timetable,
      newState.teacher_groups,
    );
    wrappedSet((state) => ({
      teachers: newState.teachers ?? state.teachers,
      tt_assignments: newState.tt_assignments ?? state.tt_assignments,
      class_groups: newState.class_groups ?? state.class_groups,
      structure: sanitizedStructure ?? state.structure,
      timetable: sanitizedTimetable ?? state.timetable,
      subject_constraints:
        newState.subject_constraints ?? state.subject_constraints,
      subject_pairings: newState.subject_pairings ?? state.subject_pairings,
      cell_groups: newState.cell_groups ?? state.cell_groups,
      fixed_slots: newState.fixed_slots ?? state.fixed_slots,
      teacher_constraints:
        newState.teacher_constraints ?? state.teacher_constraints,
      subject_placement: newState.subject_placement ?? state.subject_placement,
      facilities: newState.facilities ?? state.facilities,
      subject_facility: newState.subject_facility ?? state.subject_facility,
      alt_week_pairs: newState.alt_week_pairs ?? state.alt_week_pairs,
      cross_grade_groups:
        newState.cross_grade_groups ?? state.cross_grade_groups,
      subject_sequences: newState.subject_sequences ?? state.subject_sequences,
      settings: newState.settings
        ? {
            ...get().settings,
            ...newState.settings,
          }
        : get().settings,
    }));
  };

  return {
    ...slices,
    ...getHistoryFlags(),
    importState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } as unknown as TimetableStore;
});
