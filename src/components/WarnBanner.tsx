interface WarnBannerProps {
  hardCount: number;
  softCount: number;
  onShowConflicts?: () => void;
}

export function WarnBanner({
  hardCount,
  softCount,
  onShowConflicts,
}: WarnBannerProps) {
  const violationCount = hardCount + softCount;

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

  const hasHardViolations = hardCount > 0;

  return (
    <div
      className={`ds-warn-banner ${hasHardViolations ? "ds-warn" : "ds-soft"}`}
    >
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
      <div className="ds-warn-banner-copy">
        <div className="ds-warn-banner-summary-row">
          {hardCount > 0 && (
            <span className="ds-banner-pill ds-banner-pill-hard">
              要修正 {hardCount}件
            </span>
          )}
          {softCount > 0 && (
            <span className="ds-banner-pill ds-banner-pill-soft">
              妥協候補 {softCount}件
            </span>
          )}
        </div>
        {hasHardViolations ? (
          <>
            <span>要修正を先に解消してください</span>
            {softCount > 0 && (
              <span className="ds-warn-banner-note">
                妥協候補は運用で許容するか、あとから判断できます
              </span>
            )}
          </>
        ) : (
          <>
            <span>重大な競合はありません。妥協候補を確認してください</span>
            <span className="ds-warn-banner-note">
              上限超過や連続配置など、運用判断で許容するか確認してください
            </span>
          </>
        )}
      </div>
      {onShowConflicts && (
        <button type="button" className="ds-link" onClick={onShowConflicts}>
          一覧を表示
        </button>
      )}
    </div>
  );
}
