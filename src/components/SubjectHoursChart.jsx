import { useState } from "react";
import { useTimetableStore } from "../store/useTimetableStore";
import Modal from "./Modal";
import styles from "./SubjectHoursChart.module.css";

// グラフの最大バー幅（px）
/**
 * 全教科 × 全クラス のコマ数（実績 / 目標）を表示するチャート。
 * - 学年タブで絞り込み
 * - 各クラスごとに教科別の実績/目標バーを表示
 */
export default function SubjectHoursChart({ onClose }) {
  const { structure, timetable } = useTimetableStore();
  const grades = structure.grades || [];

  const [selectedGrade] = useState(grades.length > 0 ? grades[0].grade : null);

  if (grades.length === 0) {
    return (
      <Modal
        title={
          <>
            <span
              className="material-symbols-outlined"
              style={{ verticalAlign: "middle" }}
            >
              bar_chart
            </span>{" "}
            コマ数グラフ
          </>
        }
        onClose={onClose}
      >
        <p className={styles.emptyMessage}>クラスが登録されていません。</p>
      </Modal>
    );
  }

  const gradeObj = grades.find((g) => g.grade === selectedGrade);
  if (!gradeObj) return null;

  // 対象学年の全クラス
  const allClasses = [
    ...(gradeObj.classes || []).map((c) => ({
      class_name: c,
      isSpecial: false,
    })),
    ...(gradeObj.special_classes || []).map((c) => ({
      class_name: c,
      isSpecial: true,
    })),
  ];

  // 当該学年で使われる全教科 (required_hours から収集)
  const classKeyNormal = `${selectedGrade}_通常`;
  const classKeySpecial = `${selectedGrade}_特支`;
  const subjectSet = new Set([
    ...Object.keys(structure.required_hours[classKeyNormal] || {}),
    ...Object.keys(structure.required_hours[classKeySpecial] || {}),
  ]);
  const subjects = [...subjectSet].sort();

  // 実績カウント (timetable から集計)
  // 隔週授業スロット（alt_subject あり）はA週・B週それぞれ1コマとしてカウント
  const countActual = (grade, class_name, subject) =>
    timetable.filter(
      (e) =>
        e.grade === grade &&
        e.class_name === class_name &&
        (e.subject === subject || e.alt_subject === subject),
    ).length;

  // 目標コマ数
  const getRequired = (class_name, subject) => {
    const isSpecial = class_name.includes("特支");
    const key = isSpecial ? classKeySpecial : classKeyNormal;
    return structure.required_hours[key]?.[subject] || 0;
  };

  return (
    <Modal
      title={
        <>
          <span
            className="material-symbols-outlined"
            style={{ verticalAlign: "middle" }}
          >
            bar_chart
          </span>{" "}
          コマ数グラフ
        </>
      }
      onClose={onClose}
      bodyClassName={styles.chartBody}
    >
      {/* 学年タブ */}
      {allClasses.length === 0 && (
        <p className={styles.emptyMessage}>
          この学年にクラスが登録されていません。
        </p>
      )}

      {allClasses.map(({ class_name, isSpecial }) => (
        <div key={class_name} className={styles.chartCard}>
          <h3 className={styles.chartHeader}>
            {isSpecial ? (
              <span
                className="material-symbols-outlined"
                style={{ color: "#F59E0B", verticalAlign: "middle" }}
              >
                star
              </span>
            ) : (
              <span
                className="material-symbols-outlined"
                style={{ color: "#3B82F6", verticalAlign: "middle" }}
              >
                school
              </span>
            )}
            <span>
              {selectedGrade}年 {class_name}
            </span>
            <span className={styles.chartHeaderMeta}>（特別支援）</span>
          </h3>

          <div className="table-wrapper">
            <table className={styles.chartTable}>
              <thead>
                <tr className={styles.tableHeadRow}>
                  <th className="table-header-cell">教科</th>
                  <th className="table-header-cell">コマ数</th>
                  <th className="table-header-cell-right">実績 / 目標</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => {
                  const required = getRequired(class_name, subject);
                  if (required === 0) return null;
                  const actual = countActual(
                    selectedGrade,
                    class_name,
                    subject,
                  );
                  const ratio =
                    required > 0 ? Math.min(actual / required, 1) : 0;
                  const over = actual > required;
                  const done = actual >= required;
                  const barColor = over
                    ? "#EF4444"
                    : done
                      ? "#22C55E"
                      : "#3B82F6";

                  return (
                    <tr key={subject} className={styles.tableRow}>
                      <td className={styles.subjectCell}>{subject}</td>
                      <td className={styles.barCell}>
                        <div className={styles.barHolder}>
                          {/* 目標バー（グレー背景） */}
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{
                                width: `${ratio * 100}%`,
                                background: barColor,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td
                        className={styles.resultCell}
                        style={{
                          color: over
                            ? "#EF4444"
                            : done
                              ? "#22C55E"
                              : "#374151",
                        }}
                      >
                        {actual} / {required}
                        {over && (
                          <span className={styles.badge}>
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: "14px",
                                verticalAlign: "middle",
                              }}
                            >
                              warning
                            </span>
                            超過
                          </span>
                        )}
                        {done && !over && (
                          <span
                            className={styles.badge}
                            style={{ color: "#22C55E" }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: "14px",
                                verticalAlign: "middle",
                              }}
                            >
                              check
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* 凡例 */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: "#3B82F6" }}
          />
          配置中
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: "#22C55E" }}
          />
          目標達成
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: "#EF4444" }}
          />
          目標超過
        </span>
        <span className={styles.legendSpacer}>
          リアルタイム集計（保存不要）
        </span>
      </div>
    </Modal>
  );
}
