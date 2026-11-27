import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { coupons, leads, subscribers, users } from "@/drizzle/schema";
import { calculateLottery } from "@/lib/lottery-calc";
import {
  COUPON_DISCOUNT_PERCENT,
  COUPON_VALID_DAYS,
  MARKETING_CONSENT_TEXT,
  REQUIRE_MARKETING_CONSENT,
  normalizeIsraeliPhone,
} from "@/lib/calculator-lead";
import { renderReportPdf } from "@/lib/lottery-report-pdf";
import { htmlFooter, sendSingleEmail, unsubscribeHeaders, unsubscribeLink } from "@/lib/resend";
import { generateUnsubscribeToken, isValidEmail } from "@/lib/subscribers";

// הורדת דוח PDF מהמחשבון הציבורי: שומר ליד, מנפיק קופון ממוספר, ושולח את הדוח
// במייל בלבד (כך שהמייל חייב להיות אמיתי). הדוח נבנה מחישוב שרת.

export const runtime = "nodejs";
export const maxDuration = 30;

const num = (max: number) => z.number().finite().min(0).max(max);

const bodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30),
  email: z.string().trim().toLowerCase().max(120),
  consent: z.boolean(),
  website: z.string().max(200).optional(), // honeypot - בני אדם לא ממלאים
  input: z.object({
    pricePerSqm: num(200_000),
    discountPercent: num(100),
    discountCap: num(10_000_000),
    referencePrice: num(200_000),
    balconySqm: num(200),
    storageSqm: num(100),
    parkingCount: z.number().int().min(0).max(5),
    grant: num(1_000_000),
    sizes: z
      .array(
        z.object({
          id: z.number().int(),
          label: z.string().max(40),
          mainSqm: num(400),
        })
      )
      .min(1)
      .max(8),
  }),
});

// הגבלת קצב בסיסית לפי IP (זיכרון מקומי - מספיקה נגד שימוש לרעה פשוט).
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // בלי תווים מבלבלים (O/0, I/1)
function randomCode(len = 4) {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "הפרטים שהוזנו אינם תקינים" }, { status: 400 });
  }
  const { name, email, consent, website, input } = parsed.data;

  // בוט: מחזירים הצלחה מדומה בלי לעשות כלום.
  if (website) return NextResponse.json({ ok: true });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "יותר מדי בקשות, נסו שוב בעוד כמה דקות" }, { status: 429 });
  }

  const phone = normalizeIsraeliPhone(parsed.data.phone);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "כתובת המייל אינה תקינה" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "מספר הטלפון אינו תקין" }, { status: 400 });
  }
  if (REQUIRE_MARKETING_CONSENT && !consent) {
    return NextResponse.json({ error: "יש לאשר קבלת דיוור כדי לקבל את הדוח" }, { status: 400 });
  }
  if (input.pricePerSqm <= 0) {
    return NextResponse.json({ error: "יש להזין מחיר למ״ר" }, { status: 400 });
  }

  const ownerEmail = process.env.LEADS_API_USER_EMAIL?.toLowerCase().trim();
  const [owner] = ownerEmail
    ? await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail)).limit(1)
    : [];
  if (!owner) {
    console.error("lottery-report: LEADS_API_USER_EMAIL is not set or unknown");
    return NextResponse.json({ error: "שגיאת שרת, נסו שוב מאוחר יותר" }, { status: 500 });
  }

  const rows = calculateLottery(input);
  const now = new Date();

  // 1. ליד
  const summary =
    `מחשבון הגרלות (${now.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}): ` +
    `מחיר למ״ר ${nf.format(input.pricePerSqm)} ₪, הנחה ${input.discountPercent}% עד ${nf.format(input.discountCap)} ₪, ` +
    `מענק ${nf.format(input.grant)} ₪. מחיר חוזה: ` +
    rows.map((r) => `${r.size.label} ${nf.format(r.contractPrice)} ₪ (הון עצמי ${nf.format(r.equity)} ₪)`).join(", ") +
    (consent ? ". אישר/ה דיוור." : ". לא אישר/ה דיוור.");
  const externalKey = `calculator:${email}`;

  const [existingLead] = await db
    .select({ id: leads.id, notes: leads.notes })
    .from(leads)
    .where(and(eq(leads.userId, owner.id), eq(leads.externalKey, externalKey)))
    .limit(1);

  let leadId: string;
  if (existingLead) {
    leadId = existingLead.id;
    await db
      .update(leads)
      .set({
        name,
        phone,
        notes: `${existingLead.notes ? existingLead.notes + "\n" : ""}${summary}`,
        marketingConsentAt: consent ? now : undefined,
        updatedAt: now,
      })
      .where(eq(leads.id, existingLead.id));
  } else {
    const [created] = await db
      .insert(leads)
      .values({
        userId: owner.id,
        name,
        phone,
        email,
        source: "site",
        medium: "calculator",
        topic: "מחשבון הגרלות דיור",
        type: "purchase",
        stage: "found",
        nextStep: "להתקשר ולהציע שיחה על הדירה",
        notes: summary,
        externalKey,
        marketingConsentAt: consent ? now : null,
      })
      .returning({ id: leads.id });
    leadId = created.id;
  }

  // 2. קופון (אחד לכל כתובת מייל; בקשה חוזרת שולחת את אותו הקופון)
  let [coupon] = await db.select().from(coupons).where(eq(coupons.email, email)).limit(1);
  if (!coupon) {
    [coupon] = await db
      .insert(coupons)
      .values({
        code: randomCode(),
        token: randomBytes(18).toString("hex"),
        leadId,
        email,
        name,
        discountPercent: COUPON_DISCOUNT_PERCENT,
        expiresAt: new Date(now.getTime() + COUPON_VALID_DAYS * 86_400_000),
      })
      .onConflictDoNothing({ target: coupons.email })
      .returning();
    if (!coupon) {
      [coupon] = await db.select().from(coupons).where(eq(coupons.email, email)).limit(1);
    }
  }

  // 3. רשימת תפוצה - רק עם הסכמה מפורשת
  let unsubscribeToken: string | null = null;
  if (consent) {
    const [sub] = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);
    if (!sub) {
      unsubscribeToken = generateUnsubscribeToken();
      await db.insert(subscribers).values({
        email,
        firstName: name.split(/\s+/)[0],
        lastName: name.split(/\s+/).slice(1).join(" ") || null,
        unsubscribeToken,
        source: "calculator",
        consentAt: now,
        consentText: MARKETING_CONSENT_TEXT,
      });
    } else {
      unsubscribeToken = sub.unsubscribeToken;
      if (sub.status === "unsubscribed" || !sub.consentAt) {
        // הסכמה חדשה ומפורשת - מחזירים לרשימה.
        await db
          .update(subscribers)
          .set({
            status: sub.status === "bounced" ? "bounced" : "active",
            unsubscribedAt: null,
            consentAt: now,
            consentText: MARKETING_CONSENT_TEXT,
          })
          .where(eq(subscribers.id, sub.id));
      }
    }
  }

  // 4. PDF + מייל
  const appUrl = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const couponUrl = `${appUrl}/api/coupon/${coupon.token}`;
  const couponInfo = {
    number: coupon.number,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    expiresAt: coupon.expiresAt,
  };

  try {
    const pdf = await renderReportPdf({ name, input, rows, coupon: couponInfo });
    const safeName = escapeHtml(name);
    const couponNumber = String(coupon.number).padStart(4, "0");
    const expires = coupon.expiresAt.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });

    const footer = unsubscribeToken
      ? htmlFooter(unsubscribeToken, "קיבלת מייל זה כי השארת פרטים וקיבלת את הדוח מהמחשבון באתר.")
      : "";

    const html = `
      <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;color:#26332b;line-height:1.7;max-width:560px">
        <p>היי ${safeName},</p>
        <p>מצורף הדוח שהכנו לפי הנתונים שהזנת במחשבון הגרלות הדיור: מחיר החוזה, ההון העצמי הנדרש והחזר חודשי משוער לכל גודל דירה.</p>
        <p style="background:#f3faf5;border:1px dashed #1f6b43;border-radius:8px;padding:12px">
          <strong>מתנה ממני:</strong> קופון ${coupon.discountPercent}% הנחה על שירות ליווי מלא.<br/>
          קופון מספר ${couponNumber} · בתוקף עד ${expires}<br/>
          <a href="${couponUrl}">להורדת הקופון (PDF)</a>
        </p>
        <p>רוצה לבדוק אם ההכנסה שלך מתאימה להחזר הזה? זה בדיוק מה שאני בודק בשיחה. אפשר לענות למייל הזה או לכתוב לי בוואטסאפ:
          <a href="https://wa.me/972507700322">050-7700322</a></p>
        <p>צ׳יקו<br/>TICO FINANCE · אדריכל המשכנתאות</p>
        ${footer}
      </div>`;
    const text =
      `היי ${name},\n\nמצורף הדוח שהכנו לפי הנתונים שהזנת במחשבון הגרלות הדיור.\n\n` +
      `מתנה: קופון ${coupon.discountPercent}% הנחה על שירות ליווי מלא. קופון מספר ${couponNumber}, בתוקף עד ${expires}.\n` +
      `להורדת הקופון: ${couponUrl}\n\nצ'יקו, TICO FINANCE\nוואטסאפ: 050-7700322` +
      (unsubscribeToken ? `\n\nלהסרה מרשימת התפוצה: ${unsubscribeLink(unsubscribeToken)}` : "");

    await sendSingleEmail({
      to: email,
      subject: "הדוח שלך מהמחשבון, ומחכה לך הפתעה",
      html,
      text,
      headers: unsubscribeToken ? unsubscribeHeaders(unsubscribeToken) : undefined,
      attachments: [{ filename: "tico-finance-report.pdf", content: pdf }],
    });
  } catch (err) {
    // הליד כבר נשמר, כך שהפרטים לא הולכים לאיבוד.
    console.error("lottery-report: failed to build or send the report", err);
    return NextResponse.json(
      { error: "לא הצלחנו לשלוח את המייל כרגע. הפרטים נשמרו ונחזור אליך." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
