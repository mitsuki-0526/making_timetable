import { useMemo } from "react";
import { DAYS, PERIODS } from "@/constants";
import { useTimetableStore } from "@/store/useTimetableStore";

interface TeacherWeekViewProps {
  teacherId: string;
}

type CellEntry = {
  class_name: string;
  grade: number;
  subject: string;
  isGroup?: boolean;
};

export function TeacherWeekView({ teacherId }: TeacherWeekViewProps) {
  const { timetable, teacher_groups } = useTimetableStore();

  // キーごとに複数クラスを格納する配列マップ
  const cellMap = useMemo(() => {
    const m: Record<string, CellEntry[]> = {};

    const push = (key: string, entry: CellEntry) => {
      if (!m[key]) m[key] = [];
      // 同一クラスの重複は追加しない
      const already = m[key].some(
        (c) => c.grade === entry.grade && c.class_name === entry.class_name,
      );
      if (!already) m[key].push(entry);
    };

    // あるグループIDに teacherId が含まれているか判定するヘルパー
    const inGroup = (groupId: string | null | undefined) => {
      if (!groupId) return false;
      const grp = teacher_groups.find((g) => g.id === groupId);
      return grp?.teacher_ids?.includes(teacherId) ?? false;
    };

    for (const e of timetable) {
      const key = `${e.day_of_week}-${e.period}`;

      // A週（通常）側
      if (e.teacher_id === teacherId && e.subject) {
        push(key, { class_name: e.class_name, grade: e.grade, subject: e.subject });
      }
      if (inGroup(e.teacher_group_id) && e.subject) {
        push(key, { class_name: e.class_name, grade: e.grade, subject: e.subject, isGroup: true });
      }

      // B週（隔週）側
      if (e.alt_teacher_id === teacherId && e.alt_subject) {
        push(key, { class_name: e.class_name, grade: e.grade, subject: e.alt_subject });
      }
      if (inGroup(e.alt_teacher_group_id) && e.alt_subject) {
        push(key, { class_name: e.class_name, grade: e.grade, subject: e.alt_subject, isGroup: true });
      }
    }
    return m;
  }, [timetable, teacherId, teacher_groups]);

  return (
    <div className="ds-tt-grid" style={{ alignItems: "stretch" }}>
      <div
        className="ds-tt-head"
        style={{ background: "var(--ds-surface-3)" }}
      />
      {DAYS.map((d) => (
        <div key={d} className="ds-tt-head">
          {d}
        </div>
      ))}
      {PERIODS.map((p) => (
        <div key={p} style={{ display: "contents" }}>
          <div className="ds-tt-rowhead">{p}</div>
          {DAYS.map((d) => {
            const cells = cellMap[`${d}-${p}`];
            if (!cells || cells.length === 0) {
              return <div key={d} className="ds-tt-cell ds-empty" />;
            }
            return (
              <div
                key={d}
                className="ds-tt-cell"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: cells.length > 1 ? 3 : 0,
                  padding: cells.length > 1 ? "3px 4px" : undefined,
                }}
              >
                {cells.map((cell, i) => (
                  <div
                    key={`${cell.grade}-${cell.class_name}-${i}`}
                    style={
                      cells.length > 1
                        ? {
                            background: "var(--ds-surface-2, var(--ds-surface))",
                            borderRadius: 3,
                            padding: "2px 4px",
                            fontSize: 11,
                          }
                        : undefined
                    }
                  >
                    <div className="ds-tt-subj" style={cells.length > 1 ? { fontSize: 10 } : undefined}>
                      {cell.grade}-{cell.class_name}
                      {cell.isGroup && (
                        <span
                          title="グループ授業"
                          style={{ marginLeft: 2, opacity: 0.6, fontSize: 9 }}
                        >
                          G
                        </span>
                      )}
                    </div>
                    <div className="ds-tt-sub">
                      <span>{cell.subject}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface TeacherListProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TeacherList({ selectedId, onSelect }: TeacherListProps) {
  const { timetable, teachers, teacher_groups } = useTimetableStore();

  const hourMap = useMemo(() => {
    // 教員ごとに「担当している時限」のキー集合を管理する
    // （同一時限に複数クラスを担当していても 1コマとしてカウント）
    const slotSets: Record<string, Set<string>> = {};

    const addSlot = (teacherId: string, slotKey: string) => {
      if (!slotSets[teacherId]) slotSets[teacherId] = new Set();
      slotSets[teacherId].add(slotKey);
    };

    const addGroupSlot = (groupId: string | null | undefined, slotKey: string) => {
      if (!groupId) return;
      const grp = teacher_groups.find((g) => g.id === groupId);
      for (const tid of grp?.teacher_ids ?? []) {
        addSlot(tid, slotKey);
      }
    };

    for (const e of timetable) {
      const key = `${e.day_of_week}-${e.period}`;
      // A週：直接割当
      if (e.teacher_id && e.subject) addSlot(e.teacher_id, key);
      // A週：グループ割当
      if (e.teacher_group_id && e.subject) addGroupSlot(e.teacher_group_id, key);
      // B週：直接割当
      if (e.alt_teacher_id && e.alt_subject) addSlot(e.alt_teacher_id, key);
      // B週：グループ割当
      if (e.alt_teacher_group_id && e.alt_subject) addGroupSlot(e.alt_teacher_group_id, key);
    }

    // Set のサイズ（ユニーク時限数）をコマ数として返す
    return Object.fromEntries(
      Object.entries(slotSets).map(([id, slots]) => [id, slots.size]),
    );
  }, [timetable, teacher_groups]);

  return (
    <div className="ds-stack" style={{ gap: 4 }}>
      {teachers.map((t) => {
        const hours = hourMap[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            className={`ds-teacher-btn${selectedId === t.id ? " ds-active" : ""}`}
            onClick={() => onSelect(t.id)}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.name}
              </div>
              <div className="ds-small ds-muted">{t.subjects.join("・")}</div>
            </div>
            <div className={`ds-chip${hours === 0 ? " ds-caution" : ""}`}>
              {hours}
            </div>
          </button>
        );
      })}
    </div>
  );
}
