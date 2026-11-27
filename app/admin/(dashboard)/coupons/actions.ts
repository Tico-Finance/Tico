"use server";

import { eq, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { coupons } from "@/drizzle/schema";
import { currentUserId } from "@/lib/auth";

export async function redeemCouponAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(coupons)
    .set({ redeemedAt: new Date() })
    .where(and(eq(coupons.id, id), isNull(coupons.redeemedAt)));
  revalidatePath("/admin/coupons");
}
