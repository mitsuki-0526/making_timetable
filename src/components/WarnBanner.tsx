interface WarnBannerProps {
  violationCount: number;
  onShowConflicts?: () => void;
}

export function WarnBanner({
  violationCount,
  onShowConflicts,
}: WarnBannerProps) {
  if (violationCount === 0) {
    return (
      <div className="ds-warn-banner ds-ok">
        <svg
          aria-hidden="true"
          className="ds-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 14, height: 14, flexShrink: 0 }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>競合・エラーはありません</span>
      </div>
    );
  }

  return (
    <div className="ds-warn-banner ds-warn">
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
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>
        <strong>{violationCount}件</strong>の競合があります
      </span>
      {onShowConflicts && (
        <button type="button" className="ds-link" onClick={onShowConflicts}>
          一覧を表示
        </button>
      )}
    </div>
  );
}
