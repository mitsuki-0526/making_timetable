import type { ViolationItem, ViolationSeverity } from "@/hooks/useViolations";

const SECTION_ORDER: ViolationSeverity[] = ["hard", "soft"];
const SECTION_META: Record<
  ViolationSeverity,
  { title: string; description: string; itemClassName: string }
> = {
  hard: {
    title: "要修正",
    description: "授業成立や必須条件に直接影響する競合です。",
    itemClassName: "ds-conflict-item-hard",
  },
  soft: {
    title: "妥協候補",
    description: "上限超過など、運用で判断できる警告です。",
    itemClassName: "ds-conflict-item-soft",
  },
};

interface ConflictListProps {
  items: ViolationItem[];
  onJump?: (item: ViolationItem) => void;
}

export function ConflictList({ items, onJump }: ConflictListProps) {
  if (items.length === 0) {
    return (
      <div
        className="ds-small ds-muted"
        style={{ textAlign: "center", padding: "32px 14px" }}
      >
        競合はありません
      </div>
    );
  }

  return (
    <div className="ds-stack" style={{ gap: 12 }}>
      {SECTION_ORDER.map((severity) => {
        const sectionItems = items.filter((item) => item.severity === severity);
        if (sectionItems.length === 0) return null;

        const meta = SECTION_META[severity];
        return (
          <section key={severity} className="ds-conflict-section">
            <div className="ds-conflict-section-header">
              <div>
                <div className="ds-conflict-section-title">{meta.title}</div>
                <div className="ds-conflict-section-description">
                  {meta.description}
                </div>
              </div>
              <span className={`ds-violation-pill ds-${severity}`}>
                {sectionItems.length}
              </span>
            </div>

            <div className="ds-stack" style={{ gap: 4 }}>
              {sectionItems.map((item) => (
                <button
                  key={[
                    severity,
                    item.message,
                    item.grade ?? "",
                    item.class_name ?? "",
                    item.day ?? "",
                    item.period ?? "",
                  ].join("|")}
                  type="button"
                  className={`ds-conflict-item ${meta.itemClassName}`}
                  onClick={() => onJump?.(item)}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.message}</div>
                    {item.grade != null &&
                      item.class_name &&
                      (item.day || item.period) && (
                        <div
                          className="ds-small"
                          style={{ opacity: 0.8, marginTop: 2 }}
                        >
                          {item.grade}-{item.class_name}
                          {item.day ? ` / ${item.day}` : ""}
                          {item.period ? ` ${item.period}限` : ""}
                        </div>
                      )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
