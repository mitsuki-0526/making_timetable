import { useState } from "react";
import Modal, { ModalTabs } from "./Modal";
import styles from "./SettingsModal.module.css";
import ClassesTab from "./settings-tabs/ClassesTab";
import ClassGroupsTab from "./settings-tabs/ClassGroupsTab";
import PairingsTab from "./settings-tabs/PairingsTab";
import SubjectsTab from "./settings-tabs/SubjectsTab";
import TeachersTab from "./settings-tabs/TeachersTab";

const SETTINGS_TABS = [
  { id: "subjects", label: "教科・連動ルール" },
  { id: "classes", label: "クラス編成" },
  { id: "teachers", label: "教員リスト" },
  { id: "classgroups", label: "合同クラス" },
  { id: "pairings", label: "抱き合わせ" },
];

const SettingsModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("subjects");

  return (
    <Modal
      title="マスタ設定"
      onClose={onClose}
      bodyClassName={styles.modalBody}
    >
      <ModalTabs
        tabs={SETTINGS_TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === "subjects" && <SubjectsTab />}
      {activeTab === "classes" && <ClassesTab />}
      {activeTab === "teachers" && <TeachersTab />}
      {activeTab === "classgroups" && <ClassGroupsTab />}
      {activeTab === "pairings" && <PairingsTab />}
    </Modal>
  );
};

export default SettingsModal;
