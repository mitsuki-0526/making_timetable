import { useState } from "react";
import styles from "./ConstraintsModal.module.css";
import AltWeekTab from "./constraints-tabs/AltWeekTab";
import FacilityTab from "./constraints-tabs/FacilityTab";
import FixedSlotsTab from "./constraints-tabs/FixedSlotsTab";
import SubjectConstraintsTab from "./constraints-tabs/SubjectConstraintsTab";
import SubjectSequenceTab from "./constraints-tabs/SubjectSequenceTab";
import TeacherConstraintsTab from "./constraints-tabs/TeacherConstraintsTab";
import TimezoneTab from "./constraints-tabs/TimezoneTab";
import Modal, { ModalTabs } from "./Modal";

const icon = (name) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: "16px", verticalAlign: "middle", marginRight: "4px" }}
  >
    {name}
  </span>
);

const TABS = [
  { id: "fixed", label: <>{icon("lock")}固定コマ</> },
  { id: "timezone", label: <>{icon("schedule")}時間帯</> },
  { id: "teacher", label: <>{icon("person")}教員制約</> },
  { id: "subject", label: <>{icon("menu_book")}教科配置</> },
  { id: "facility", label: <>{icon("school")}施設制約</> },
  { id: "altweek", label: <>{icon("sync")}隔週授業</> },
  { id: "sequence", label: <>{icon("skip_next")}連続配置</> },
];

export default function ConstraintsModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("fixed");

  return (
    <Modal title="条件設定" onClose={onClose} bodyClassName={styles.modalBody}>
      <ModalTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "fixed" && <FixedSlotsTab />}
      {activeTab === "timezone" && <TimezoneTab />}
      {activeTab === "teacher" && <TeacherConstraintsTab />}
      {activeTab === "subject" && <SubjectConstraintsTab />}
      {activeTab === "facility" && <FacilityTab />}
      {activeTab === "altweek" && <AltWeekTab />}
      {activeTab === "sequence" && <SubjectSequenceTab />}
    </Modal>
  );
}
