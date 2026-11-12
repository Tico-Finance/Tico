"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function registerAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const geminiApiKey = String(formData.get("geminiApiKey") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  const requiredCode = process.env.REGISTRATION_CODE;
  if (requiredCode && code !== requiredCode) {
    return { error: "קוד ההרשמה שגוי" };
  }
  if (!email.includes("@") || email.length < 5) {
    return { error: "כתובת אימייל לא תקינה" };
  }
  if (password.length < 6) {
    return { error: "הסיסמה חייבת להיות לפחות 6 תווים" };
  }
  if (!geminiApiKey) {
    return { error: "יש להזין מפתח Gemini (חינמי) כדי שה-AI יעבוד" };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { error: "כתובת האימייל הזו כבר רשומה — אפשר להתחבר." };
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  await db.insert(users).values({
    email,
    passwordHash,
    name: name || null,
    geminiApiKey,
  });

  // Sign the new advisor straight in.
  try {
    await signIn("credentials", { email, password, redirectTo: "/admin/home" });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "נרשמת בהצלחה — אפשר להתחבר עכשיו." };
    }
    throw err; // NEXT_REDIRECT on success
  }
}
