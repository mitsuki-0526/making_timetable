import { useEffect, useState } from "react";
import { useTimetableStore } from "@/store/useTimetableStore";
import type { DayOfWeek, Period, Teacher } from "@/types";

interface UseCellDropdownProps {
  day_of_week: DayOfWeek;
  period: Period;
  grade: number;
  class_name: string;
  selectedCount: number;
  onGroupCells?: () => void;
}

export const useCellDropdown = ({
  day_of_week,
  period,
  grade,
  class_name,
  selectedCount,
  onGroupCells,
}: UseCellDropdownProps) => {
  const {
    getAvailableTeachers,
    setTimetableEntry,
    setTimetableTeacher,
    setAltEntry,
    setEntryGroup,
    getEntry,
    teachers,
    teacher_groups,
    cell_groups,
    ungroupCells,
    getDailySubjectCount,
    structure,
  } = useTimetableStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [subForm, setSubForm] = useState<"alt" | "group" | "teacher" | null>(
    null,
  );
  const [formPos, setFormPos] = useState({ x: 0, y: 0 });
  const [groupWarnings, setGroupWarnings] = useState<{
    conflicts: string[];
    groupName: string;
    day: DayOfWeek;
    period: Period;
  } | null>(null);

  const currentEntry = getEntry(day_of_week, period, grade, class_name);
  const availableTeachers = getAvailableTeachers(
    day_of_week,
    period,
    grade,
    class_name,
  );
  const isSpecial = class_name.includes("特支") || grade === 0; // 0 represents special in some contexts, but check logic

  const teacherCandidates = currentEntry?.subject
    ? availableTeachers.filter(
        (t) =>
          t.subjects.includes(currentEntry.subject) ||
          t.subjects.includes("特別支援"),
      )
    : [];

  const reqKey = isSpecial ? `${grade}_特支` : `${grade}_通常`;
  const gradeSubjects = structure.required_hours[reqKey]
    ? Object.keys(structure.required_hours[reqKey])
    : [];

  const dailyCount = currentEntry?.subject
    ? getDailySubjectCount(day_of_week, grade, class_name, currentEntry.subject)
    : 0;

  const cellGroupId = currentEntry?.cell_group_id || null;
  const groupColorIdx = cellGroupId
    ? (cell_groups || []).findIndex((g) => g.id === cellGroupId)
    : -1;

  const hasAlt = !!currentEntry?.alt_subject;
  const hasGroup = !!currentEntry?.teacher_group_id;
  const assignedGroup = hasGroup
    ? (teacher_groups || []).find(
        (g) => g.id === currentEntry?.teacher_group_id,
      )
    : null;

  useEffect(() => {
    if (!contextMenu && !subForm) return;
    const close = () => {
      setContextMenu(null);
      setSubForm(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [contextMenu, subForm]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!currentEntry?.subject && (selectedCount || 0) < 2) return;
    e.preventDefault();
    const MENU_W = 190;
    const MENU_H = 150;
    const FORM_W = 220;
    const FORM_H = 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mx = e.clientX + MENU_W > vw ? e.clientX - MENU_W : e.clientX;
    const my = e.clientY + MENU_H > vh ? e.clientY - MENU_H : e.clientY;
    const fx = e.clientX + FORM_W > vw ? e.clientX - FORM_W : e.clientX;
    const fy = e.clientY + FORM_H > vh ? e.clientY - FORM_H : e.clientY;
    setContextMenu({ x: mx, y: my });
    setFormPos({ x: fx, y: fy });
    setSubForm(null);
  };

  const handleSubjectChange = (subject: string | null) => {
    if (!subject) {
      setTimetableEntry(day_of_week, period, grade, class_name, null, null);
      setSubForm(null);
      return;
    }
    const suitableTeachers = availableTeachers.filter(
      (t) =>
        t.subjects.includes(subject) ||
        (isSpecial && t.subjects.includes("特別支援")),
    );
    const autoTeachers = suitableTeachers.filter(
      (t) => !t.subjects.includes("特別支援"),
    );
    const teacherId = autoTeachers.length > 0 ? autoTeachers[0].id : null;
    setTimetableEntry(
      day_of_week,
      period,
      grade,
      class_name,
      teacherId,
      subject,
    );

    if (autoTeachers.length > 1) {
      setSubForm("teacher");
    } else {
      setSubForm(null);
    }
  };

  const handleAltSubjectChange = (altSubject: string | null) => {
    if (!altSubject) {
      setAltEntry(day_of_week, period, grade, class_name, null, null);
      return;
    }
    const altCandidates = teachers.filter((t) => {
      if (
        t.unavailable_times.some(
          (u) => u.day_of_week === day_of_week && u.period === period,
        )
      )
        return false;
      if (t.id === currentEntry?.teacher_id) return false;
      return (
        t.subjects.includes(altSubject) ||
        (isSpecial && t.subjects.includes("特別支援"))
      );
    });
    const altTeacherId = altCandidates.length > 0 ? altCandidates[0].id : null;
    setAltEntry(
      day_of_week,
      period,
      grade,
      class_name,
      altSubject,
      altTeacherId,
    );
  };

  const handleGroupChange = (groupId: string | null) => {
    setEntryGroup(day_of_week, period, grade, class_name, groupId);

    if (groupId) {
      const grp = (teacher_groups || []).find((g) => g.id === groupId);
      if (grp) {
        const conflicts = grp.teacher_ids
          .map((tid) => teachers.find((t) => t.id === tid))
          .filter((t): t is Teacher => !!t)
          .filter((t) =>
            t.unavailable_times?.some(
              (u) => u.day_of_week === day_of_week && u.period === period,
            ),
          )
          .map((t) => t.name.split("(")[0].trim());
        if (conflicts.length > 0) {
          setGroupWarnings({
            conflicts,
            groupName: grp.name,
            day: day_of_week,
            period,
          });
        }
      }
    }
  };

  return {
    currentEntry,
    contextMenu,
    subForm,
    formPos,
    groupWarnings,
    teacherCandidates,
    gradeSubjects,
    dailyCount,
    cellGroupId,
    groupColorIdx,
    hasAlt,
    hasGroup,
    assignedGroup,
    teachers,
    teacher_groups,
    setSubForm,
    setContextMenu,
    setGroupWarnings,
    handleContextMenu,
    handleSubjectChange,
    handleAltSubjectChange,
    handleGroupChange,
    setTimetableTeacher,
    setAltEntry,
    ungroupCells,
    setTimetableEntry,
  };
};
