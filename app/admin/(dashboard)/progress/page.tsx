import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadProgress } from "@/lib/progress-db";
import { todayIL } from "@/lib/partners";
import ProgressView from "./progress-view";

export const metadata = { title: "השבוע שלי | Tico" };

export default async function ProgressPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");
  const weeks = await loadProgress(userId, todayIL(), 8);
  return <ProgressView weeks={weeks} />;
}
