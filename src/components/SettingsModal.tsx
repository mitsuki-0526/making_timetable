import { useState } from "react";
import {
  Settings,
  BookOpen,
  Users,
  GraduationCap,
  LayoutGrid,
  Link2,
  Layers,
} from "lucide-react";
import ClassesTab from "./settings-tabs/ClassesTab";
import ClassGroupsTab from "./settings-tabs/ClassGroupsTab";
import PairingsTab from "./settings-tabs/PairingsTab";
import SubjectsTab from "./settings-tabs/SubjectsTab";
import TeachersTab from "./settings-tabs/TeachersTab";
import TeacherGroupsTab from "./settings-tabs/TeacherGroupsTab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsModalProps {
  onClose: () => void;
}

const SETTINGS_TABS = [
  { id: "subjects", label: "教科・連動ルール", icon: BookOpen },
  { id: "classes", label: "クラス編成", icon: GraduationCap },
  { id: "teachers", label: "教員リスト", icon: Users },
  { id: "teacher-groups", label: "教員グループ", icon: Layers },
  { id: "classgroups", label: "合同クラス", icon: LayoutGrid },
  { id: "pairings", label: "抱き合わせ", icon: Link2 },
];

const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState("subjects");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 border-b shrink-0 bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Settings className="h-5 w-5 text-primary" />
            マスタ設定
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="border-b bg-muted/10 px-6 shrink-0 overflow-x-auto">
            <TabsList className="h-12 bg-transparent gap-2 p-0 flex-nowrap w-max">
              {SETTINGS_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-medium text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none whitespace-nowrap"
                >
                  <tab.icon className="mr-2 h-4 w-4 shrink-0" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="subjects" className="m-0 focus-visible:ring-0">
              <SubjectsTab />
            </TabsContent>
            <TabsContent value="classes" className="m-0 focus-visible:ring-0">
              <ClassesTab />
            </TabsContent>
            <TabsContent value="teachers" className="m-0 focus-visible:ring-0">
              <TeachersTab />
            </TabsContent>
            <TabsContent value="teacher-groups" className="m-0 focus-visible:ring-0">
              <TeacherGroupsTab />
            </TabsContent>
            <TabsContent
              value="classgroups"
              className="m-0 focus-visible:ring-0"
            >
              <ClassGroupsTab />
            </TabsContent>
            <TabsContent value="pairings" className="m-0 focus-visible:ring-0">
              <PairingsTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
