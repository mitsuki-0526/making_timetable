import { useTheme } from "next-themes";

interface TopbarProps {
  onSave?: () => void;
}

function MoonIcon() {
  return (
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
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
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  );
}

export function Topbar({ onSave }: TopbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="la-topbar">
      <div className="la-brand">
        <span className="la-mark" />
        時間割エディタ
      </div>
      <div className="la-crumb">
        <span>時間割作成ツール</span>
      </div>
      <div className="la-spacer" />
      <div className="ds-flex ds-center ds-gap-8">
        <button
          type="button"
          className="ds-btn ds-btn-sm ds-btn-ghost"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title={isDark ? "ライトモードに切替" : "ダークモードに切替"}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        {onSave && (
          <button type="button" className="ds-btn ds-btn-sm" onClick={onSave}>
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
            保存
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
