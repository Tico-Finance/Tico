import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { todayIL } from "@/lib/partners";
import { weekStartOf } from "@/lib/progress";
import { listRoutines, loadRoutineLogs } from "@/lib/routines-db";
import RoutinesApp from "./routines-app";

export const metadata = { title: "הרגלים קבועים | Tico" };

export default async function RoutinesPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");
  const today = todayIL();
  const weekStart = weekStartOf(today);
  const [routines, logs] = await Promise.all([listRoutines(userId), loadRoutineLogs(userId, weekStart)]);
  return <RoutinesApp routines={routines} logs={logs} weekStart={weekStart} today={today} />;
}
