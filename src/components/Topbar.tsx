import { useEffect } from "react";
import { useTimetableStore } from "@/store/useTimetableStore";

interface TopbarProps {
  onSave?: () => void;
  fileName?: string;
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

export function Topbar({ onSave, fileName }: TopbarProps) {
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
      <div className="ds-flex ds-center ds-gap-8">
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
