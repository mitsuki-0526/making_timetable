import { useEffect } from "react";
import { useTimetableStore } from "@/store/useTimetableStore";

interface TopbarProps {
  onSave?: () => void;
  fileName?: string;
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function SidebarToggleIcon({
  collapsed,
  side,
}: {
  collapsed: boolean;
  side: "left" | "right";
}) {
  const dividerX = side === "left" ? 9 : 15;
  const arrowPath =
    side === "left"
      ? collapsed
        ? "M13 9l3 3-3 3"
        : "M13 9l-3 3 3 3"
      : collapsed
        ? "M11 9l-3 3 3 3"
        : "M11 9l3 3-3 3";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 14, height: 14, flexShrink: 0 }}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d={`M${dividerX} 4v16`} />
      <path d={arrowPath} />
    </svg>
  );
}

export function Topbar({
  onSave,
  fileName,
  isLeftSidebarOpen,
  isRightSidebarOpen,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: TopbarProps) {
  const undo = useTimetableStore((s) => s.undo);
  const redo = useTimetableStore((s) => s.redo);
  const undoAvailable = useTimetableStore((s) => s.undoAvailable);
  const redoAvailable = useTimetableStore((s) => s.redoAvailable);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) {
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "s" && !event.shiftKey) {
        event.preventDefault();
        onSave?.();
        return;
      }

      if (key === "z" && !event.shiftKey) {
        if (!undoAvailable) {
          return;
        }

        event.preventDefault();
        undo();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        if (!redoAvailable) {
          return;
        }

        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, redo, redoAvailable, undo, undoAvailable]);

  return (
    <div className="la-topbar">
      <div className="la-brand">
        <span className="la-mark" />
        時間割エディタ
      </div>
      <div className="la-crumb">
        <span>時間割作成ツール</span>
        {fileName && (
          <>
            <span style={{ margin: "0 4px", opacity: 0.4 }}>/</span>
            <span style={{ fontWeight: 500 }}>{fileName}</span>
          </>
        )}
      </div>
      <div className="la-spacer" />
      <div className="ds-flex ds-center ds-gap-8 la-sidebar-toggles">
        <button
          type="button"
          className="ds-btn ds-btn-sm"
          onClick={onToggleLeftSidebar}
          title={
            isLeftSidebarOpen ? "左サイドバーを収納" : "左サイドバーを表示"
          }
        >
          <SidebarToggleIcon collapsed={!isLeftSidebarOpen} side="left" />
          {isLeftSidebarOpen ? "左を収納" : "左を表示"}
        </button>
        <button
          type="button"
          className="ds-btn ds-btn-sm"
          onClick={onToggleRightSidebar}
          title={
            isRightSidebarOpen ? "右サイドバーを収納" : "右サイドバーを表示"
          }
        >
          <SidebarToggleIcon collapsed={!isRightSidebarOpen} side="right" />
          {isRightSidebarOpen ? "右を収納" : "右を表示"}
        </button>
        <button
          type="button"
          className="ds-btn ds-btn-ghost la-history-btn"
          onClick={() => undo()}
          disabled={!undoAvailable}
          title="元に戻す (Ctrl/Cmd+Z)"
          aria-label="元に戻す"
        >
          ↶
        </button>
        <button
          type="button"
          className="ds-btn ds-btn-ghost la-history-btn"
          onClick={() => redo()}
          disabled={!redoAvailable}
          title="やり直す (Ctrl+Y / Ctrl/Cmd+Shift+Z)"
          aria-label="やり直す"
        >
          ↷
        </button>
        {onSave && (
          <button
            type="button"
            className="ds-btn ds-btn-sm"
            onClick={onSave}
            title="上書き保存 (Ctrl+S)"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 14, height: 14 }}
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            上書き保存
          </button>
        )}
      </div>
      <div className="la-status">
        <span className="la-dot" />
        準備完了
      </div>
    </div>
  );
}
