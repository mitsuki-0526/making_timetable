import { createPortal } from "react-dom";
import type { Teacher } from "@/types";
import styles from "./CellDropdown.module.css";

interface ContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  cellGroupId: string | null;
  teacherCandidates: Teacher[];
  hasAlt: boolean;
  hasGroup: boolean;
  subForm: string | null;
  onClose: () => void;
  onGroupCells?: () => void;
  onUngroupCells: (id: string) => void;
  onSetSubForm: (form: "alt" | "group" | "teacher" | null) => void;
  onClear: () => void;
}

export const ContextMenu = ({
  x,
  y,
  selectedCount,
  cellGroupId,
  teacherCandidates,
  hasAlt,
  subForm,
  onClose,
  onGroupCells,
  onUngroupCells,
  onSetSubForm,
  onClear,
}: ContextMenuProps) => {
  return createPortal(
    <div
      role="menu"
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
      className={styles.contextMenu}
      style={{ top: y, left: x }}
    >
      {selectedCount >= 2 && (
        <div
          role="menuitem"
          tabIndex={0}
          onMouseDown={(e) => {
            e.stopPropagation();
            onGroupCells?.();
            onClose();
          }}
          className={`${styles.contextMenuItem} ${styles.contextMenuGroupAction}`}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px", marginRight: "4px" }}
          >
            link
          </span>
          {selectedCount}セルをグループ化
        </div>
      )}
      {cellGroupId && (
        <div
          role="menuitem"
          tabIndex={0}
          onMouseDown={(e) => {
            e.stopPropagation();
            onUngroupCells(cellGroupId);
            onClose();
          }}
          className={styles.contextMenuItem}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px", marginRight: "4px" }}
          >
            link_off
          </span>
          グループ解除
        </div>
      )}
      {(selectedCount >= 2 || cellGroupId) && (
        <div className={styles.contextMenuDivider} />
      )}

      {teacherCandidates.length > 0 && (
        <div
          role="menuitem"
          tabIndex={0}
          onMouseDown={(e) => {
            e.stopPropagation();
            onSetSubForm("teacher");
            onClose();
          }}
          className={styles.contextMenuItem}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "14px", marginRight: "4px" }}
          >
            person
          </span>
          担当を変更{" "}
          {teacherCandidates.length > 1
            ? `（${teacherCandidates.length}名）`
            : ""}
        </div>
      )}

      <div
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => {
          e.stopPropagation();
          onSetSubForm("alt");
          onClose();
        }}
        className={`${styles.contextMenuItem} ${subForm === "alt" ? styles.contextMenuSelected : ""}`}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "14px", marginRight: "4px" }}
        >
          calendar_today
        </span>
        {hasAlt ? "隔週設定を変更" : "隔週設定"}
      </div>

      <div
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => {
          e.stopPropagation();
          onSetSubForm("group");
          onClose();
        }}
        className={styles.contextMenuItem}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "14px", marginRight: "4px" }}
        >
          group
        </span>
        グループ担当設定
      </div>

      <div className={styles.contextMenuDivider} />
      <div
        role="menuitem"
        tabIndex={0}
        onMouseDown={(e) => {
          e.stopPropagation();
          onClear();
          onClose();
        }}
        className={`${styles.contextMenuItem} ${styles.contextMenuDanger}`}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "14px", marginRight: "4px" }}
        >
          delete
        </span>
        教科をクリア
      </div>
    </div>,
    document.body,
  );
};
