import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AltWeekTab from "./constraints-tabs/AltWeekTab";
import FacilityTab from "./constraints-tabs/FacilityTab";
import FixedSlotsTab from "./constraints-tabs/FixedSlotsTab";
import SubjectConstraintsTab from "./constraints-tabs/SubjectConstraintsTab";
import SubjectSequenceTab from "./constraints-tabs/SubjectSequenceTab";
import TeacherConstraintsTab from "./constraints-tabs/TeacherConstraintsTab";
import TimezoneTab from "./constraints-tabs/TimezoneTab";
import ClassGroupsTab from "./constraints-tabs/ClassGroupsTab";
import PairingsTab from "./constraints-tabs/PairingsTab";

interface ConstraintsModalProps {
  onClose: () => void;
}

const TABS = [
  { id: "fixed", label: "固定コマ" },
  { id: "timezone", label: "時間帯" },
  { id: "teacher", label: "教員制約" },
  { id: "subject", label: "教科配置" },
  { id: "classgroups", label: "合同クラス" },
  { id: "pairings", label: "抱き合わせ" },
  { id: "facility", label: "施設制約" },
  { id: "altweek", label: "隔週授業" },
  { id: "sequence", label: "連続配置" },
];

export default function ConstraintsModal({ onClose }: ConstraintsModalProps) {
  const [activeTab, setActiveTab] = useState("fixed");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-border-strong shrink-0 bg-background">
          <DialogTitle className="text-[15px] font-semibold">
            作成条件の設定
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="border-b border-border px-5 shrink-0 overflow-x-auto no-scrollbar bg-background">
            <TabsList className="h-10 bg-transparent gap-0 p-0 flex-nowrap w-max">
              {TABS.map((tab) => (
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

          <div className="flex-1 overflow-y-auto p-5">
            <TabsContent value="fixed" className="m-0 focus-visible:ring-0">
              <FixedSlotsTab />
            </TabsContent>
            <TabsContent value="timezone" className="m-0 focus-visible:ring-0">
              <TimezoneTab />
            </TabsContent>
            <TabsContent value="teacher" className="m-0 focus-visible:ring-0">
              <TeacherConstraintsTab />
            </TabsContent>
            <TabsContent value="subject" className="m-0 focus-visible:ring-0">
              <SubjectConstraintsTab />
            </TabsContent>
            <TabsContent value="classgroups" className="m-0 focus-visible:ring-0">
              <ClassGroupsTab />
            </TabsContent>
            <TabsContent value="pairings" className="m-0 focus-visible:ring-0">
              <PairingsTab />
            </TabsContent>
            <TabsContent value="facility" className="m-0 focus-visible:ring-0">
              <FacilityTab />
            </TabsContent>
            <TabsContent value="altweek" className="m-0 focus-visible:ring-0">
              <AltWeekTab />
            </TabsContent>
            <TabsContent value="sequence" className="m-0 focus-visible:ring-0">
              <SubjectSequenceTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
