import { useState } from "react";
import { useTimetableStore } from "../../store/useTimetableStore";
import sharedStyles from "../shared.module.css";
import tabStyles from "./SubjectsTab.module.css";

const SubjectsTab = () => {
  const {
    structure,
    settings,
    subject_constraints,
    addSubject,
    removeSubject,
    updateRequiredHours,
    updateSubjectConstraint,
    addMappingRule,
    removeMappingRule,
  } = useTimetableStore();

  const [newSubj, setNewSubj] = useState("");
  const [mapGrade, setMapGrade] = useState("1");
  const [mapFrom, setMapFrom] = useState("");
  const [mapTo, setMapTo] = useState("");

  const hwKeys = [];
  structure.grades.forEach((g) => {
    hwKeys.push(`${g.grade}_通常`);
    if (g.special_classes && g.special_classes.length > 0) {
      hwKeys.push(`${g.grade}_特支`);
    }
  });

  const subjectList = Array.from(
    new Set(
      Object.values(structure.required_hours).flatMap((gradeObj) =>
        Object.keys(gradeObj),
      ),
    ),
  );

  const handleAddSubject = () => {
    if (newSubj.trim()) {
      addSubject(newSubj.trim());
      setNewSubj("");
    }
  };

  const handleHourChange = (key, subj, val) => {
    updateRequiredHours(key, subj, val);
  };

  const handleMaxConsecutiveChange = (subj, val) => {
    const parsed = val === "" ? null : parseInt(val, 10);
    updateSubjectConstraint(subj, Number.isNaN(parsed) ? null : parsed);
  };

  const handleAddRule = () => {
    if (mapGrade && mapFrom.trim() && mapTo.trim()) {
      addMappingRule(
        parseInt(mapGrade, 10) || mapGrade,
        mapFrom.trim(),
        mapTo.trim(),
      );
      setMapFrom("");
      setMapTo("");
    }
  };

  return (
    <>
      <section className={sharedStyles.settingsSection}>
        <h3>1. 教科の追加と規定時数・連続日数上限の設定</h3>
        <div className={tabStyles.addSubjectRow}>
          <input
            type="text"
            placeholder="新しい教科を入力"
            value={newSubj}
            onChange={(e) => setNewSubj(e.target.value)}
            className="input-base"
          />
          <button
            type="button"
            className="btn-primary"
            onClick={handleAddSubject}
          >
            追加
          </button>
        </div>

        <div className={tabStyles.hoursTableWrapper}>
          <table className={tabStyles.hoursTable}>
            <thead>
              <tr>
                <th className={tabStyles.tableActionCell}>操作</th>
                <th>教科</th>
                {hwKeys.map((k) => (
                  <th key={k}>
                    {k.replace("_通常", "年").replace("_特支", "特支")}
                  </th>
                ))}
                <th title="この日数以上連続して同じ教科が配置された場合に警告します。空欄は制限なし。">
                  連続上限日数
                </th>
              </tr>
            </thead>
            <tbody>
              {subjectList.map((subj) => (
                <tr key={subj}>
                  <td className={tabStyles.tableActionCell}>
                    <button
                      type="button"
                      className={`btn-danger ${tabStyles.tableSmallButton}`}
                      onClick={() => removeSubject(subj)}
                    >
                      削除
                    </button>
                  </td>
                  <td className={tabStyles.tableSubjectName}>{subj}</td>
                  {hwKeys.map((k) => (
                    <td key={k}>
                      <input
                        type="number"
                        min="0"
                        className="input-small"
                        value={structure.required_hours[k]?.[subj] || 0}
                        onChange={(e) =>
                          handleHourChange(k, subj, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      placeholder="−"
                      className="input-small"
                      value={
                        subject_constraints?.[subj]?.max_consecutive_days ?? ""
                      }
                      onChange={(e) =>
                        handleMaxConsecutiveChange(subj, e.target.value)
                      }
                      title="連続して配置できる最大日数（この日数に達したら警告）"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sharedStyles.settingsSection}>
        <h3>2. 特別支援学級の教科連動ルール</h3>
        <p className="help-text">
          通常学級で左側の教科が設定された際、特別支援学級では右側の教科に自動で差し替えます。
        </p>

        <ul className={sharedStyles.rulesList}>
          {Object.keys(settings.mappingRules).map((g) => {
            const rules = settings.mappingRules[g];
            return Object.entries(rules).map(([fromS, toS]) => (
              <li key={`${g}-${fromS}`} className={sharedStyles.ruleItem}>
                <span>
                  <strong>{g}年</strong>のルール: 通常 <strong>{fromS}</strong>{" "}
                  ➡ 特支 <strong>{toS}</strong>
                </span>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeMappingRule(g, fromS)}
                >
                  削除
                </button>
              </li>
            ));
          })}
        </ul>

        <div className={sharedStyles.addRuleRow}>
          <select
            value={mapGrade}
            onChange={(e) => setMapGrade(e.target.value)}
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
            placeholder="通常学級の教科"
            value={mapFrom}
            onChange={(e) => setMapFrom(e.target.value)}
            className="input-base"
          />
          <span>➡</span>
          <input
            type="text"
            placeholder="特支の教科"
            value={mapTo}
            onChange={(e) => setMapTo(e.target.value)}
            className="input-base"
          />
          <button type="button" className="btn-primary" onClick={handleAddRule}>
            ルール登録
          </button>
        </div>
      </section>
    </>
  );
};

export default SubjectsTab;
