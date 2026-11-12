import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadProgress } from "@/lib/progress-db";
import { todayIL } from "@/lib/partners";
import { activePlan, listPlanYears } from "@/lib/plan-db";
import { weekGoalRows, weeklyTargets } from "@/lib/business-plan/targets";
import ProgressView from "./progress-view";

export const metadata = { title: "השבוע שלי | Tico" };

export default async function ProgressPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");
  const today = todayIL();
  const [weeks, planRows] = await Promise.all([loadProgress(userId, today, 8), listPlanYears(userId)]);
  const plan = activePlan(planRows, Number(today.slice(0, 4)));
  const goals = plan?.settings ? weekGoalRows(weeklyTargets(plan.settings, plan.year, today), weeks[weeks.length - 1]) : [];
  return <ProgressView weeks={weeks} goals={goals} planYear={plan?.year ?? null} />;
}
