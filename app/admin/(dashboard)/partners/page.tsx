import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerEvents, partners } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import PartnersApp from "./partners-app";
import { toEventRow, toPartnerRow } from "./types";

export const metadata = { title: "שותפים | Tico" };

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");

  const rows = await db.select().from(partners).where(eq(partners.userId, userId)).orderBy(partners.name);
  const events = await db
    .select()
    .from(partnerEvents)
    .where(eq(partnerEvents.userId, userId))
    .orderBy(desc(partnerEvents.at))
    .limit(3000);

  return <PartnersApp initialOpenId={open ?? null} initialRows={rows.map(toPartnerRow)} initialEvents={events.map(toEventRow)} />;
}
