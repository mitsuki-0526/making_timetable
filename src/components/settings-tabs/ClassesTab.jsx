import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import sharedStyles from "../shared.module.css";
import tabStyles from "./ClassesTab.module.css";

const ClassesTab = () => {
  const { structure, addClass, removeClass } = useTimetableStore();
  const [newClassGrade, setNewClassGrade] = useState("1");
  const [newClassName, setNewClassName] = useState("");
  const [isNewClassSpecial, setIsNewClassSpecial] = useState(false);

  const handleAddClass = () => {
    if (newClassName.trim()) {
      addClass(
        parseInt(newClassGrade, 10),
        newClassName.trim(),
        isNewClassSpecial,
      );
      setNewClassName("");
    }
  };

  return (
    <section className={sharedStyles.settingsSection}>
      <h3>クラス編成の管理</h3>
      <div className={sharedStyles.infoPanel}>
        <p className="help-text help-text--no-top">
          新しいクラスを追加します。（既存のクラスを消すと、時間割上のそのクラスのコマも消去されます）
        </p>
        <div
          className={`${sharedStyles.addRuleRow} ${tabStyles.infoPanelCompact}`}
        >
          <select
            value={newClassGrade}
            onChange={(e) => setNewClassGrade(e.target.value)}
            className="input-base"
          >
            {structure.grades.map((g) => (
              <option key={g.grade} value={g.grade}>
                {g.grade}年
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="クラス名 (例: 3組, 特支2)"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            className="input-base"
          />
          <label className={tabStyles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isNewClassSpecial}
              onChange={(e) => setIsNewClassSpecial(e.target.checked)}
            />
            特支枠として追加
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={handleAddClass}
          >
            クラス追加
          </button>
        </div>
      </div>

      <div className={tabStyles.sectionGroup}>
        {structure.grades.map((g) => (
          <div key={g.grade} className={tabStyles.gradeCard}>
            <h4 className={tabStyles.gradeLabel}>{g.grade}年生</h4>
            <div className={tabStyles.badgeGroup}>
              {g.classes.map((c) => (
                <div key={`${g.grade}-${c}`} className={tabStyles.badge}>
                  <span>{c}</span>
                  <button
                    type="button"
                    className={tabStyles.badgeClose}
                    onClick={() => removeClass(g.grade, c, false)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {g.special_classes?.map((c) => (
                <div
                  key={`${g.grade}-${c}`}
                  className={`${tabStyles.badge} ${tabStyles["badge--special"]}`}
                >
                  <span>{c} (特支)</span>
                  <button
                    type="button"
                    className={tabStyles.badgeClose}
                    onClick={() => removeClass(g.grade, c, true)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ClassesTab;
