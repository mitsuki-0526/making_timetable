import { useState } from "react";
import {
  Ruler,
  CalendarRange,
  Clock,
  UserCog,
  BookType,
  Building2,
  CalendarDays,
  ListOrdered,
} from "lucide-react";
import AltWeekTab from "./constraints-tabs/AltWeekTab";
import FacilityTab from "./constraints-tabs/FacilityTab";
import FixedSlotsTab from "./constraints-tabs/FixedSlotsTab";
import SubjectConstraintsTab from "./constraints-tabs/SubjectConstraintsTab";
import SubjectSequenceTab from "./constraints-tabs/SubjectSequenceTab";
import TeacherConstraintsTab from "./constraints-tabs/TeacherConstraintsTab";
import TimezoneTab from "./constraints-tabs/TimezoneTab";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ConstraintsModalProps {
  onClose: () => void;
}

const TABS = [
  { id: "fixed", label: "固定コマ", icon: CalendarRange },
  { id: "timezone", label: "時間帯", icon: Clock },
  { id: "teacher", label: "教員制約", icon: UserCog },
  { id: "subject", label: "教科配置", icon: BookType },
  { id: "facility", label: "施設制約", icon: Building2 },
  { id: "altweek", label: "隔週授業", icon: CalendarDays },
  { id: "sequence", label: "連続配置", icon: ListOrdered },
];

export default function ConstraintsModal({ onClose }: ConstraintsModalProps) {
  const [activeTab, setActiveTab] = useState("fixed");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 border-b shrink-0 bg-muted/30">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Ruler className="h-5 w-5 text-primary" />
            作成条件の設定
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="border-b bg-muted/10 px-6 shrink-0 overflow-x-auto no-scrollbar">
            <TabsList className="h-12 bg-transparent gap-2 p-0 flex-nowrap w-max">
              {TABS.map((tab) => (
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
