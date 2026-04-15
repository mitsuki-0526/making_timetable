import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  BadgeInfo,
  GraduationCap,
  User,
  BookOpen,
  AlertCircle,
  Clock,
  Construction,
  Repeat,
} from "lucide-react";
import {
  checkAfternoonDailyViolations,
  checkDoublePeriodViolations,
  checkFacilityViolations,
  checkFixedSlotViolations,
  checkSubjectPeriodViolations,
  checkTeacherConsecutiveViolations,
  checkTeacherDailyViolations,
  checkTeacherWeeklyViolations,
} from "../lib/validation";
import { useTimetableStore } from "../store/useTimetableStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ViolationBlockProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  variant?: "danger" | "warning" | "info";
  children: React.ReactNode;
}

const ValidationPanel = () => {
  const {
    structure,
    timetable,
    teachers,
    teacher_constraints,
    subject_placement,
    fixed_slots,
    facilities,
    subject_facility,
    settings,
    getClassSubjectTotals,
    getConsecutiveDaysViolations,
  } = useTimetableStore();

  const { grades, required_hours } = structure;
  const lunch_after_period = settings?.lunch_after_period ?? 4;

  const classList = useMemo(() => {
    const list: {
      type: "normal" | "special";
      grade: number;
      class_name: string;
      label: string;
      reqKey: string;
    }[] = [];
    for (const g of grades) {
      for (const c of g.classes) {
        list.push({
          type: "normal",
          grade: g.grade,
          class_name: c,
          label: `${g.grade}-${c}`,
          reqKey: `${g.grade}_通常`,
        });
      }
      if (g.special_classes) {
        for (const c of g.special_classes) {
          list.push({
            type: "special",
            grade: g.grade,
            class_name: c,
            label: `${g.grade}年特支 ${c}`,
            reqKey: `${g.grade}_特支`,
          });
        }
      }
    }
    return list;
  }, [grades]);

  const consecutiveViolations = getConsecutiveDaysViolations();
  const fixedViolations = useMemo(
    () => checkFixedSlotViolations(timetable, fixed_slots, structure),
    [timetable, fixed_slots, structure],
  );
  const teacherDailyViol = useMemo(
    () => checkTeacherDailyViolations(timetable, teachers, teacher_constraints),
    [timetable, teachers, teacher_constraints],
  );
  const teacherConsecViol = useMemo(
    () =>
      checkTeacherConsecutiveViolations(
        timetable,
        teachers,
        teacher_constraints,
      ),
    [timetable, teachers, teacher_constraints],
  );
  const periodViol = useMemo(
    () => checkSubjectPeriodViolations(timetable, subject_placement),
    [timetable, subject_placement],
  );
  const afternoonViol = useMemo(
    () =>
      checkAfternoonDailyViolations(
        timetable,
        subject_placement,
        lunch_after_period,
      ),
    [timetable, subject_placement, lunch_after_period],
  );
  const facilityViol = useMemo(
    () => checkFacilityViolations(timetable, facilities, subject_facility),
    [timetable, facilities, subject_facility],
  );
  const doublePeriodViol = useMemo(
    () => checkDoublePeriodViolations(timetable, subject_placement),
    [timetable, subject_placement],
  );
  const teacherWeeklyViol = useMemo(
    () =>
      checkTeacherWeeklyViolations(timetable, teachers, teacher_constraints),
    [timetable, teachers, teacher_constraints],
  );

  const totalViolations =
    fixedViolations.length +
    teacherDailyViol.length +
    teacherConsecViol.length +
    periodViol.length +
    afternoonViol.length +
    facilityViol.length +
    doublePeriodViol.length +
    teacherWeeklyViol.length +
    consecutiveViolations.length;

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            週間授業時数チェック
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            規定数と一致しない教科は黄色で表示されます
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {classList.map((cls) => {
              const totals = getClassSubjectTotals(cls.grade, cls.class_name);
              const required = required_hours[cls.reqKey] || {};
              const subjects = Object.keys(required);
              if (subjects.length === 0) return null;

              return (
                <Card
                  key={`${cls.grade}-${cls.class_name}`}
                  className={`overflow-hidden border-2 ${cls.type === "special" ? "border-amber-500/30" : "border-muted"}`}
                >
                  <CardHeader
                    className={`py-2 px-3 border-b ${cls.type === "special" ? "bg-amber-500/10" : "bg-muted/30"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1">
                        <GraduationCap
                          className={`h-3 w-3 ${cls.type === "special" ? "text-amber-500" : "text-primary"}`}
                        />
                        {cls.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {subjects.map((subj) => {
                        const current = totals[subj] || 0;
                        const req = required[subj];
                        const isWarning = current !== req;
                        return (
                          <Badge
                            key={subj}
                            variant={isWarning ? "outline" : "secondary"}
                            className={`px-2 py-0.5 text-[10px] font-mono border-2 ${
                              isWarning
                                ? "border-amber-400 text-amber-600 dark:bg-amber-400/10"
                                : "bg-primary/10 text-primary border-transparent hover:bg-primary/20"
                            }`}
                          >
                            {subj}: {current}/{req}
                          </Badge>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {totalViolations > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              条件設定の不一致・違反
              <Badge
                variant="destructive"
                className="ml-2 h-5 flex items-center justify-center font-mono"
              >
                {totalViolations}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {fixedViolations.length > 0 && (
                <ViolationAccordionItem
                  id="fixed"
                  icon={<AlertCircle className="h-4 w-4" />}
                  title="固定コマ未反映"
                  count={fixedViolations.length}
                  variant="danger"
                >
                  {fixedViolations.map((v, i) => (
                    <li
                      key={i}
                      className="text-sm bg-background/50 p-2 rounded border border-destructive/10 mb-1"
                    >
                      <span className="font-bold text-destructive">
                        {v.grade}年{v.class_name}
                      </span>{" "}
                      {v.day_of_week}曜{v.period}限: 「{v.label}
                      」を希望中、現在は「{v.actual || "空き"}」
                    </li>
                  ))}
                </ViolationAccordionItem>
              )}

              {teacherDailyViol.length > 0 && (
                <ViolationAccordionItem
                  id="teacher-daily"
                  icon={<User className="h-4 w-4" />}
                  title="教員の1日最大コマ数超過"
                  count={teacherDailyViol.length}
                  variant="warning"
                >
                  {teacherDailyViol.map((v, i) => (
                    <li
                      key={i}
                      className="text-sm bg-background/50 p-2 rounded border border-orange-500/10 mb-1"
                    >
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        {v.teacher}
                      </span>
                      : {v.day}曜 {v.count}コマ（上限: {v.limit}コマ）
                    </li>
                  ))}
                </ViolationAccordionItem>
              )}

              {teacherWeeklyViol.length > 0 && (
                <ViolationAccordionItem
                  id="teacher-weekly"
                  icon={<Clock className="h-4 w-4" />}
                  title="教員の週最大コマ数超過"
                  count={teacherWeeklyViol.length}
                  variant="warning"
                >
                  {teacherWeeklyViol.map((v, i) => (
                    <li
                      key={i}
                      className="text-sm bg-background/50 p-2 rounded border border-orange-500/10 mb-1"
                    >
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        {v.teacher}
                      </span>
                      : 週{v.count}コマ（上限: {v.limit}コマ）
                    </li>
                  ))}
                </ViolationAccordionItem>
              )}

              {consecutiveViolations.length > 0 && (
                <ViolationAccordionItem
                  id="consecutive"
                  icon={<Repeat className="h-4 w-4" />}
                  title="連続授業日数の警告"
                  count={consecutiveViolations.length}
                  variant="warning"
                >
                  {consecutiveViolations.map((v, i) => (
                    <li
                      key={i}
                      className="text-sm bg-background/50 p-2 rounded border border-amber-500/10 mb-1"
                    >
                      <span className="font-bold">
                        {v.grade}年{v.class_name}
                      </span>
                      : 「{v.subject}」が{v.maxConsecutive}日連続（上限{" "}
                      {v.limit}日）
                    </li>
                  ))}
                </ViolationAccordionItem>
              )}

              {facilityViol.length > 0 && (
                <ViolationAccordionItem
                  id="facility"
                  icon={<Construction className="h-4 w-4" />}
                  title="教室・施設のバッティング"
                  count={facilityViol.length}
                  variant="danger"
                >
                  {facilityViol.map((v, i) => (
                    <li
                      key={i}
                      className="text-sm bg-background/50 p-2 rounded border border-destructive/10 mb-1"
                    >
                      <span className="font-bold text-destructive">
                        {v.day_of_week}曜{v.period}限「{v.facility}」
                      </span>
                      : 利用制限({v.limit})を超えています
                    </li>
                  ))}
                </ViolationAccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ViolationAccordionItem = ({
  id,
  icon,
  title,
  count,
  variant = "info",
  children,
}: ViolationBlockProps & { id: string }) => {
  const textColorClass =
    variant === "danger"
      ? "text-destructive"
      : variant === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-blue-500";
  const bgColorClass =
    variant === "danger"
      ? "bg-destructive/10"
      : variant === "warning"
        ? "bg-amber-500/10"
        : "bg-blue-500/10";

  return (
    <AccordionItem value={id} className="border-b-0 mb-2">
      <AccordionTrigger
        className={`hover:no-underline py-2 px-3 rounded-md group transition-all ${bgColorClass}`}
      >
        <div className="flex items-center gap-2">
          <span className={textColorClass}>{icon}</span>
          <span className={`text-sm font-bold ${textColorClass}`}>{title}</span>
          <Badge
            variant={variant === "danger" ? "destructive" : "secondary"}
            className="ml-2 h-5 px-1.5 text-[10px]"
          >
            {count}件
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-2 pb-1 px-4">
        <ul className="list-none space-y-1">{children}</ul>
      </AccordionContent>
    </AccordionItem>
  );
};
export default ValidationPanel;
