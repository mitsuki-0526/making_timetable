import { DAYS, PERIODS } from "@/constants";
import { useTimetableStore } from "@/store/useTimetableStore";

export function StatusBar() {
  const { timetable, structure } = useTimetableStore();

  const totalSlots = structure.grades.reduce((sum, g) => {
    const classes = [...(g.classes || [])];
    return sum + classes.length * DAYS.length * PERIODS.length;
  }, 0);

  const filledSlots = timetable.filter((e) => e.subject || e.alt_subject).length;

  return (
    <div className="la-statusbar">
      <span>
        配置済み: <span className="ds-mono">{filledSlots}</span> /{" "}
        <span className="ds-mono">{totalSlots}</span> コマ
      </span>
    </div>
  );
}
