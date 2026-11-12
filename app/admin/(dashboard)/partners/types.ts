import type { partners, partnerEvents } from "@/drizzle/schema";
import type { PartnerKind, PartnerStage } from "@/lib/partners";

export interface PartnerRow {
  id: string;
  kind: PartnerKind;
  name: string;
  org: string | null;
  instagram: string | null;
  phone: string | null;
  area: string | null;
  address: string | null;
  route: string | null;
  why: string | null;
  channel: string | null;
  details: Record<string, unknown>;
  priority: string | null;
  wave: string | null;
  hook: string | null;
  stage: PartnerStage;
  nextAction: string | null;
  nextAt: string | null;
  followDate: string | null;
  coupon: boolean;
  couponCode: string | null;
  notes: string;
  archived: boolean;
  archiveReason: string | null;
}

export interface PartnerEventRow {
  id: string;
  partnerId: string;
  kind: string;
  text: string;
  hook: string | null;
  at: string;
}

export function toPartnerRow(r: typeof partners.$inferSelect): PartnerRow {
  return {
    id: r.id,
    kind: r.kind as PartnerKind,
    name: r.name,
    org: r.org,
    instagram: r.instagram,
    phone: r.phone,
    area: r.area,
    address: r.address,
    route: r.route,
    why: r.why,
    channel: r.channel,
    details: r.details ?? {},
    priority: r.priority,
    wave: r.wave,
    hook: r.hook,
    stage: r.stage as PartnerStage,
    nextAction: r.nextAction,
    nextAt: r.nextAt,
    followDate: r.followDate,
    coupon: r.coupon,
    couponCode: r.couponCode,
    notes: r.notes,
    archived: r.archived,
    archiveReason: r.archiveReason,
  };
}

export function toEventRow(e: typeof partnerEvents.$inferSelect): PartnerEventRow {
  return { id: e.id, partnerId: e.partnerId, kind: e.kind, text: e.text, hook: e.hook, at: e.at.toISOString() };
}
