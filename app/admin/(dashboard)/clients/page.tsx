import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientEvents, clients, leads } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import ClientsApp from "./clients-app";
import { toClientEventRow, toClientRow, type LeadOption } from "./types";

export const metadata = { title: "לקוחות | Tico" };

export default async function ClientsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");

  const rows = await db.select().from(clients).where(eq(clients.userId, userId)).orderBy(clients.name);
  const events = await db
    .select()
    .from(clientEvents)
    .where(eq(clientEvents.userId, userId))
    .orderBy(desc(clientEvents.at))
    .limit(2000);

  // Leads that are not yet a client, to start a client file from.
  const linked = new Set(rows.map((r) => r.leadId).filter(Boolean));
  const leadRows = await db
    .select({ id: leads.id, name: leads.name, phone: leads.phone })
    .from(leads)
    .where(and(eq(leads.userId, userId), ne(leads.stage, "lost")))
    .orderBy(desc(leads.createdAt))
    .limit(200);
  const leadOptions: LeadOption[] = leadRows.filter((l) => !linked.has(l.id));

  return <ClientsApp initialRows={rows.map(toClientRow)} initialEvents={events.map(toClientEventRow)} leadOptions={leadOptions} />;
}
