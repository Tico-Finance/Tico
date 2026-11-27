import { Resend } from "resend";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { draftEmails, subscribers, emailSends } from "@/drizzle/schema";

let client: Resend | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is not set. Add it to your environment (see SETUP.md)."
      );
    }
    client = new Resend(apiKey);
  }
  return client;
}

function unsubscribeUrl(token: string) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
  return `${appUrl}/unsubscribe?token=${token}`;
}

function htmlFooter(token: string) {
  const businessName = process.env.BUSINESS_NAME || "";
  return `
    <hr style="margin-top:32px;border:none;border-top:1px solid #eee" />
    <p style="font-size:12px;color:#888;margin-top:12px">
      ${businessName ? `${businessName}<br/>` : ""}
      קיבלת מייל זה כי היית בעבר בקשר עם העסק.
      <a href="${unsubscribeUrl(token)}">להסרה מרשימת התפוצה</a>
    </p>`;
}

function textFooter(token: string) {
  const businessName = process.env.BUSINESS_NAME || "";
  return `\n\n---\n${businessName ? `${businessName}\n` : ""}להסרה מרשימת התפוצה: ${unsubscribeUrl(
    token
  )}`;
}

const CHUNK_SIZE = 100;

export async function sendApprovedDraftEmail(draftEmailId: string) {
  const draft = await db.query.draftEmails.findFirst({
    where: eq(draftEmails.id, draftEmailId),
  });
  if (!draft) throw new Error("Draft email not found");
  if (draft.status !== "approved") {
    throw new Error("Only approved draft emails can be sent");
  }

  const subject = draft.finalSubject || draft.aiSubject;
  const bodyHtml = draft.finalBodyHtml || draft.aiBodyHtml;
  const bodyText = draft.finalBodyText || draft.aiBodyText;
  if (!subject || !bodyHtml) {
    throw new Error("Draft email is missing subject or body");
  }

  const activeSubscribers = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.status, "active"));

  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. Add it to your environment (see SETUP.md)."
    );
  }

  if (activeSubscribers.length === 0) {
    await db
      .update(draftEmails)
      .set({ status: "sent", sentAt: new Date(), recipientsCount: 0 })
      .where(eq(draftEmails.id, draftEmailId));
    return { recipients: 0 };
  }

  const resend = getClient();
  let sentCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < activeSubscribers.length; i += CHUNK_SIZE) {
    const chunk = activeSubscribers.slice(i, i + CHUNK_SIZE);
    const payload = chunk.map((s) => ({
      from,
      to: s.email,
      subject,
      html: `${bodyHtml}${htmlFooter(s.unsubscribeToken)}`,
      text: bodyText ? `${bodyText}${textFooter(s.unsubscribeToken)}` : undefined,
    }));

    const { data, error } = await resend.batch.send(payload);

    if (error) {
      errors.push(error.message);
      await db.insert(emailSends).values(
        chunk.map((s) => ({
          draftEmailId,
          subscriberId: s.id,
          status: "failed" as const,
          error: error.message,
        }))
      );
      continue;
    }

    const results = data?.data ?? [];
    await db.insert(emailSends).values(
      chunk.map((s, j) => ({
        draftEmailId,
        subscriberId: s.id,
        status: "sent" as const,
        providerMessageId: results[j]?.id,
      }))
    );
    sentCount += chunk.length;
  }

  await db
    .update(draftEmails)
    .set({
      status: sentCount > 0 ? "sent" : "failed",
      sentAt: new Date(),
      recipientsCount: sentCount,
      sendError: errors.length > 0 ? errors.join("; ") : null,
    })
    .where(eq(draftEmails.id, draftEmailId));

  return { recipients: sentCount };
}

/** שליחת מייל בודד (לא דיוור) - למשל דוח עם קובץ מצורף. */
export async function sendSingleEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. Add it to your environment (see SETUP.md)."
    );
  }
  const { data, error } = await getClient().emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments,
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export function unsubscribeLink(token: string) {
  return unsubscribeUrl(token);
}
