import { create } from "zustand";
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

export const useTimetableStore = create<TimetableStore>()((...a) => {
  const [originalSet, get, api] = a as [any, any, any];

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
      teacher_groups: s.teacher_groups,
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

  const wrappedSet: typeof originalSet = (partial: any, replace?: boolean) => {
    if (!isRestoring && !isInitializing) {
      try {
        const snap = getSnapshot();
        past.push(snap);
        if (past.length > MAX_HISTORY) past.shift();
        future.length = 0;
      } catch (err) {
        // ignore snapshot errors
      }
    }

    if (typeof partial === "function") {
      return originalSet((state: TimetableStore) => ({
        ...partial(state),
        ...getHistoryFlags(),
      }), replace);
    }

    return originalSet(
      {
        ...partial,
        ...getHistoryFlags(),
      },
      replace,
    );
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

  const undo = () => {
    if (past.length === 0) return;
    const snap = past.pop()!;
    try {
      const current = getSnapshot();
      future.push(current);
    } catch (e) {
      // ignore
    }
    isRestoring = true;
    originalSet(() => ({ ...snap, ...getHistoryFlags() }));
    isRestoring = false;
  };

  const redo = () => {
    if (future.length === 0) return;
    const snap = future.pop()!;
    try {
      const current = getSnapshot();
      past.push(current);
    } catch (e) {
      // ignore
    }
    isRestoring = true;
    originalSet(() => ({ ...snap, ...getHistoryFlags() }));
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
    wrappedSet((state: any) => ({
      teachers: newState.teachers ?? state.teachers,
      teacher_groups: newState.teacher_groups ?? state.teacher_groups,
      class_groups: newState.class_groups ?? state.class_groups,
      structure: sanitizedStructure ?? state.structure,
      timetable: newState.timetable ?? state.timetable,
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
