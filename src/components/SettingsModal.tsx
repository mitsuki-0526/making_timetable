import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClassesTab from "./settings-tabs/ClassesTab";
import SubjectsTab from "./settings-tabs/SubjectsTab";
import TeacherGroupsTab from "./settings-tabs/TeacherGroupsTab";
import TeachersTab from "./settings-tabs/TeachersTab";

interface SettingsModalProps {
  onClose: () => void;
}

const SETTINGS_TABS = [
  { id: "subjects", label: "教科・連動ルール" },
  { id: "classes", label: "クラス編成" },
  { id: "teachers", label: "教員リスト" },
  { id: "teacher-groups", label: "教員グループ" },
];

const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState("subjects");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ maxWidth: '1200px', width: '95vw', height: '80vh' }} className="max-w-[1400px] w-[95vw] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-border-strong shrink-0 bg-background">
          <DialogTitle className="text-[15px] font-semibold">
            基礎構成
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="border-b border-border px-5 shrink-0 overflow-x-auto no-scrollbar bg-background">
            <TabsList className="h-10 bg-transparent gap-0 p-0 flex-nowrap w-max">
              {SETTINGS_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 py-1.5 text-[12px] font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:bg-transparent whitespace-nowrap"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
            <TabsContent value="subjects" className="m-0 focus-visible:ring-0">
              <SubjectsTab />
            </TabsContent>
            <TabsContent value="classes" className="m-0 focus-visible:ring-0">
              <ClassesTab />
            </TabsContent>
            <TabsContent value="teachers" className="m-0 focus-visible:ring-0">
              <TeachersTab />
            </TabsContent>
            <TabsContent
              value="teacher-groups"
              className="m-0 focus-visible:ring-0"
            >
              <TeacherGroupsTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
