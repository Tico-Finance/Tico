import { NextRequest } from "next/server";
import { runPushCron } from "@/lib/push-cron";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return runPushCron(req, "morning");
}
