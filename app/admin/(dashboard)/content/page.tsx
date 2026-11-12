import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentItems } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";
import { leadCountsByCode } from "@/lib/content-db";
import ContentApp from "./content-app";
import { toContentRow } from "./types";

export const metadata = { title: "מעקב תוכן | Tico" };

export default async function ContentPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");

  const rows = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.userId, userId))
    .orderBy(desc(contentItems.createdAt));
  const leadCounts = await leadCountsByCode(userId, rows.map((r) => r.code));

  return <ContentApp initialRows={rows.map(toContentRow)} leadCounts={leadCounts} />;
}
