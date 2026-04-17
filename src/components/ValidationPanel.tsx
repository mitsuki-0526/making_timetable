import { useMemo } from "react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ClassRow {
  type: "normal" | "special";
  grade: number;
  class_name: string;
  label: string;
  reqKey: string;
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

  const classList: ClassRow[] = useMemo(() => {
    const list: ClassRow[] = [];
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
            label: `${g.grade}年 ${c}`,
            reqKey: `${g.grade}_特支`,
          });
        }
      }
    }
    return list;
  }, [grades]);

  // クラスごとの教科列挙をまとめ、クラス×教科のマトリクスを作る
  const allSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const cls of classList) {
      const req = required_hours[cls.reqKey] || {};
      for (const s of Object.keys(req)) set.add(s);
    }
    return Array.from(set);
  }, [classList, required_hours]);

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

  // 違反ゼロ時は時数マトリクスを全幅で表示し、違反は 1 行の通知に畳む
  const gridCols =
    totalViolations > 0
      ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]"
      : "lg:grid-cols-1";

  return (
    <section className={`grid gap-4 ${gridCols}`}>
      {/* 時数マトリクス */}
      <div>
        <div className="flex items-baseline justify-between pb-2">
          <h2 className="text-[13px] font-semibold text-foreground">
            週間授業時数
          </h2>
          <div className="flex items-baseline gap-3">
            {totalViolations === 0 && (
              <span className="text-[11px] text-success">
                条件違反なし
              </span>
            )}
            <p className="text-[11px] text-muted-foreground">
              規定数と一致しない値を強調表示
            </p>
          </div>
        </div>
        <div className="overflow-auto border border-border-strong bg-background">
          <table className="w-full border-collapse table-fixed text-[12px]">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 border-b border-r-2 border-border-strong bg-surface px-2 py-1.5 text-left text-[11px] font-semibold text-muted-foreground"
                  style={{ width: 90 }}
                >
                  クラス
                </th>
                {allSubjects.map((subj) => (
                  <th
                    key={subj}
                    className="border-b border-l border-border bg-surface px-1.5 py-1.5 text-center text-[11px] font-semibold text-muted-foreground"
                  >
                    {subj}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classList.map((cls, rowIdx) => {
                const totals = getClassSubjectTotals(cls.grade, cls.class_name);
                const req = required_hours[cls.reqKey] || {};
                const isLast = rowIdx === classList.length - 1;
                return (
                  <tr key={`${cls.grade}-${cls.class_name}`}>
                    <th
                      className={`sticky left-0 z-10 bg-background border-r-2 border-border-strong px-2 py-1 text-left text-[12px] font-semibold whitespace-nowrap ${
                        !isLast ? "border-b border-border" : ""
                      }`}
                    >
                      <span className="text-foreground">{cls.label}</span>
                    </th>
                    {allSubjects.map((subj) => {
                      const required = req[subj];
                      const current = totals[subj] || 0;
                      const hasReq = required !== undefined;
                      const isDiff = hasReq && current !== required;
                      return (
                        <td
                          key={subj}
                          className={`border-l border-border px-1.5 py-1 text-center tabular-nums ${
                            !isLast ? "border-b border-border" : ""
                          } ${
                            isDiff
                              ? "bg-warning/10 font-semibold text-warning"
                              : hasReq
                                ? "text-muted-foreground"
                                : "text-muted-foreground/30"
                          }`}
                          title={
                            hasReq
                              ? `現在 ${current} / 規定 ${required}`
                              : "規定なし"
                          }
                        >
                          {hasReq ? (
                            <span className="inline-flex items-baseline gap-0.5">
                              <span>{current}</span>
                              <span className="text-muted-foreground/60">
                                /
                              </span>
                              <span>{required}</span>
                            </span>
                          ) : (
                            "－"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 違反サマリ — 違反がある場合のみ表示 */}
      {totalViolations > 0 && (
        <div>
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-[13px] font-semibold text-foreground">
              条件違反・警告
            </h2>
            <span className="text-[11px] tabular-nums font-semibold text-destructive">
              {totalViolations} 件
            </span>
          </div>
          <div className="border border-border-strong bg-background">
            <Accordion type="multiple" className="divide-y divide-border">
              {fixedViolations.length > 0 && (
                <ViolationItem
                  id="fixed"
                  title="固定コマ未反映"
                  count={fixedViolations.length}
                  level="error"
                >
                  {fixedViolations.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      <span className="font-semibold">
                        {v.grade}年{v.class_name}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {v.day_of_week} {v.period}限
                      </span>
                      ：「{v.label}」希望／現在「{v.actual || "空き"}」
                    </li>
                  ))}
                </ViolationItem>
              )}
              {teacherDailyViol.length > 0 && (
                <ViolationItem
                  id="teacher-daily"
                  title="教員の1日最大コマ数超過"
                  count={teacherDailyViol.length}
                  level="warn"
                >
                  {teacherDailyViol.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      <span className="font-semibold">{v.teacher}</span>
                      ：{v.day}曜 {v.count}コマ（上限 {v.limit}）
                    </li>
                  ))}
                </ViolationItem>
              )}
              {teacherWeeklyViol.length > 0 && (
                <ViolationItem
                  id="teacher-weekly"
                  title="教員の週最大コマ数超過"
                  count={teacherWeeklyViol.length}
                  level="warn"
                >
                  {teacherWeeklyViol.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      <span className="font-semibold">{v.teacher}</span>
                      ：週 {v.count}コマ（上限 {v.limit}）
                    </li>
                  ))}
                </ViolationItem>
              )}
              {teacherConsecViol.length > 0 && (
                <ViolationItem
                  id="teacher-consec"
                  title="教員の連続授業超過"
                  count={teacherConsecViol.length}
                  level="warn"
                >
                  {teacherConsecViol.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      <span className="font-semibold">{v.teacher}</span>
                      ：{v.day}曜 {v.count}連続（上限 {v.limit}）
                    </li>
                  ))}
                </ViolationItem>
              )}
              {consecutiveViolations.length > 0 && (
                <ViolationItem
                  id="consecutive"
                  title="連続授業日数の警告"
                  count={consecutiveViolations.length}
                  level="warn"
                >
                  {consecutiveViolations.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      <span className="font-semibold">
                        {v.grade}年{v.class_name}
                      </span>
                      ：「{v.subject}」{v.maxConsecutive}日連続（上限{" "}
                      {v.limit}）
                    </li>
                  ))}
                </ViolationItem>
              )}
              {periodViol.length > 0 && (
                <ViolationItem
                  id="period"
                  title="教科の時限配置違反"
                  count={periodViol.length}
                  level="warn"
                >
                  {periodViol.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      {v.grade}年{v.class_name} {v.day_of_week} {v.period}限：
                      {v.subject}
                    </li>
                  ))}
                </ViolationItem>
              )}
              {afternoonViol.length > 0 && (
                <ViolationItem
                  id="afternoon"
                  title="午後配置の制約違反"
                  count={afternoonViol.length}
                  level="warn"
                >
                  {afternoonViol.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      {v.grade}年{v.class_name} {v.day_of_week}：{v.subject}
                    </li>
                  ))}
                </ViolationItem>
              )}
              {doublePeriodViol.length > 0 && (
                <ViolationItem
                  id="double"
                  title="連続授業（2コマ抱き合わせ）違反"
                  count={doublePeriodViol.length}
                  level="warn"
                >
                  {doublePeriodViol.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      {v.grade}年{v.class_name} {v.day_of_week}：{v.subject}
                    </li>
                  ))}
                </ViolationItem>
              )}
              {facilityViol.length > 0 && (
                <ViolationItem
                  id="facility"
                  title="施設の重複使用"
                  count={facilityViol.length}
                  level="error"
                >
                  {facilityViol.map((v, i) => (
                    <li key={i} className="py-1 text-[12px]">
                      <span className="font-semibold">
                        {v.day_of_week} {v.period}限「{v.facility}」
                      </span>
                      ：利用上限 {v.limit} 超過
                    </li>
                  ))}
                </ViolationItem>
              )}
            </Accordion>
          </div>
        </div>
      )}
    </section>
  );
};

interface ViolationItemProps {
  id: string;
  title: string;
  count: number;
  level: "error" | "warn";
  children: React.ReactNode;
}

const ViolationItem = ({
  id,
  title,
  count,
  level,
  children,
}: ViolationItemProps) => {
  const color = level === "error" ? "text-destructive" : "text-warning";
  return (
    <AccordionItem value={id} className="border-0">
      <AccordionTrigger className="gap-2 px-3 py-2 text-[12px] hover:no-underline">
        <div className="flex flex-1 items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              level === "error" ? "bg-destructive" : "bg-warning"
            }`}
            aria-hidden
          />
          <span className={`font-semibold ${color}`}>{title}</span>
          <span className="ml-auto text-muted-foreground tabular-nums">
            {count}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-2">
        <ul className="list-none border-l border-border pl-3 text-foreground">
          {children}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
};

export default ValidationPanel;
