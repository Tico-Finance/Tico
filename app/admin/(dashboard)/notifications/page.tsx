import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getVapid, listSubscriptions } from "@/lib/push";
import NotificationsClient from "./notifications-client";

export const metadata = { title: "התראות | Tico" };

export default async function NotificationsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/admin/login");
  const [vapid, subs] = await Promise.all([getVapid(), listSubscriptions(userId)]);
  return (
    <NotificationsClient
      publicKey={vapid.publicKey}
      devices={subs.map((s) => ({ endpoint: s.endpoint, userAgent: s.userAgent ?? "", createdAt: s.createdAt.toISOString() }))}
    />
  );
}
