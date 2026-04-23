import type { CSSProperties } from "react";

interface TimetableEntryContentProps {
  subject: string;
  teacherName?: string | null;
  altSubject?: string | null;
  altTeacherName?: string | null;
  selected?: boolean;
  dense?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function TimetableEntryContent({
  subject,
  teacherName,
  altSubject,
  altTeacherName,
  selected = false,
  dense = false,
  className,
  style,
}: TimetableEntryContentProps) {
  const subjectFontSize = dense ? "11px" : "14px";
  const teacherFontSize = dense ? "10px" : "11px";
  // Slightly larger fonts for better readability on grid cells
  const subjectFontSizeAdjusted = dense ? "12px" : "16px";
  const teacherFontSizeAdjusted = dense ? "11px" : "13px";
  const subjectWeight = selected ? 700 : 600;

  const subjectLineStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 0,
    fontSize: subjectFontSizeAdjusted,
    lineHeight: 1.1,
    color: "var(--ds-text)",
    fontWeight: subjectWeight,
    textAlign: "center",
  };

  const teacherLineStyle: CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: teacherFontSizeAdjusted,
    lineHeight: 1.2,
    color: "var(--ds-text-2)",
    fontWeight: 400,
    textAlign: "center",
    width: "100%",
  };

  const labelStyle: CSSProperties = {
    fontStyle: "italic",
    flexShrink: 0,
  };

  const subjectTextStyle: CSSProperties = {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "normal",
    display: "block",
    width: "100%",
  };

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: dense ? 1 : 2,
        ...style,
      }}
    >
      {!altSubject ? (
        <div style={{ ...subjectLineStyle, alignItems: "center" }}>
          <span style={subjectTextStyle}>{subject}</span>
        </div>
      ) : (
        <div style={subjectLineStyle}>
          <span style={labelStyle}>A:</span>
          <span style={subjectTextStyle}>{subject}</span>
        </div>
      )}
      <div style={teacherLineStyle}>{teacherName || "担当未設定"}</div>
      {altSubject && (
        <>
          <div style={subjectLineStyle}>
            <span style={labelStyle}>B:</span>
            <span style={subjectTextStyle}>{altSubject}</span>
          </div>
          <div style={teacherLineStyle}>
            {altTeacherName || "担当未設定"}
          </div>
        </>
      )}
    </div>
  );
}