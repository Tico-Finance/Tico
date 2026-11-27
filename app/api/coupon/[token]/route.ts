import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { coupons } from "@/drizzle/schema";
import { renderCouponPdf } from "@/lib/lottery-report-pdf";

// הורדת הקופון בקישור שנשלח במייל. הטוקן אקראי וסודי, והקופון קיים רק אם נרשם במסד.

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f]{36}$/.test(token)) {
    return new NextResponse("הקישור אינו תקין", { status: 404 });
  }
  const [coupon] = await db.select().from(coupons).where(eq(coupons.token, token)).limit(1);
  if (!coupon) return new NextResponse("הקישור אינו תקין", { status: 404 });
  if (coupon.redeemedAt) return new NextResponse("הקופון כבר מומש", { status: 410 });
  if (coupon.expiresAt.getTime() < Date.now()) {
    return new NextResponse("תוקף הקופון פג", { status: 410 });
  }

  const pdf = await renderCouponPdf({
    name: coupon.name,
    coupon: {
      number: coupon.number,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      expiresAt: coupon.expiresAt,
    },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tico-coupon-${String(coupon.number).padStart(4, "0")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
