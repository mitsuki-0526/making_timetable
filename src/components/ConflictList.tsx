import type { DayOfWeek, Period } from "@/types";

interface ConflictItem {
  message: string;
  grade?: number;
  class_name?: string;
  day?: DayOfWeek;
  period?: Period;
}

interface ConflictListProps {
  items: ConflictItem[];
  onJump?: (item: ConflictItem) => void;
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
    <div className="ds-stack" style={{ gap: 4 }}>
      {items.map((item) => (
        <button
          key={item.message}
          type="button"
          className="ds-conflict-item"
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
            style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <div style={{ fontWeight: 600 }}>{item.message}</div>
            {item.grade && item.class_name && item.day && item.period && (
              <div className="ds-small" style={{ opacity: 0.8, marginTop: 2 }}>
                {item.grade}-{item.class_name} / {item.day} {item.period}限
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
