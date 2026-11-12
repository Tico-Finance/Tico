import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  date,
  jsonb,
  pgEnum,
  unique,
  AnyPgColumn,
} from "drizzle-orm/pg-core";

// Registered advisors. Each has their own login and their own Gemini API key,
// so the AI briefs they generate run on their own (free) quota.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  geminiApiKey: text("gemini_api_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const topicStatusEnum = pgEnum("topic_status", [
  "pending",
  "used",
  "skipped",
]);

export const topicSourceEnum = pgEnum("topic_source", [
  "seed",
  "ai_suggested",
  "manual",
]);

export const postPlatformEnum = pgEnum("post_platform", [
  "facebook",
  "instagram",
  "both",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending_review",
  "approved",
  "rejected",
  "published",
  "sent",
  "failed",
]);

export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "active",
  "unsubscribed",
  "bounced",
]);

export const subscriberSourceEnum = pgEnum("subscriber_source", [
  "csv_import",
  "manual",
]);

export const emailSendStatusEnum = pgEnum("email_send_status", [
  "sent",
  "failed",
  "bounced",
]);

export const generationRunStatusEnum = pgEnum("generation_run_status", [
  "running",
  "success",
  "failed",
]);

export const templateTextZoneEnum = pgEnum("template_text_zone", [
  "bottom",
  "top",
  "left",
  "right",
]);

export const templateTextColorEnum = pgEnum("template_text_color", [
  "light",
  "dark",
]);

export const rtmBriefStatusEnum = pgEnum("rtm_brief_status", [
  "new",
  "approved",
  "dismissed",
]);

export const rtmRunStatusEnum = pgEnum("rtm_run_status", [
  "running",
  "success",
  "failed",
]);

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  source: topicSourceEnum("source").notNull().default("manual"),
  status: topicStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const draftPosts = pgTable("draft_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id").references(() => topics.id, {
    onDelete: "set null",
  }),
  platform: postPlatformEnum("platform").notNull().default("both"),
  aiCaptionFacebook: text("ai_caption_facebook"),
  aiCaptionInstagram: text("ai_caption_instagram"),
  finalCaptionFacebook: text("final_caption_facebook"),
  finalCaptionInstagram: text("final_caption_instagram"),
  hashtags: text("hashtags").array().notNull().default([]),
  overlayHook: text("overlay_hook"),
  overlayCta: text("overlay_cta"),
  overlayClosing: text("overlay_closing"),
  imageUrl: text("image_url"),
  // Carousel posts: every slide in order (imageUrl holds the first). Empty for single-image posts.
  imageUrls: text("image_urls").array().notNull().default([]),
  imageSource: text("image_source"),
  status: reviewStatusEnum("status").notNull().default("pending_review"),
  aiModel: text("ai_model"),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  disclaimerConfirmed: boolean("disclaimer_confirmed").notNull().default(false),
  noGuaranteeConfirmed: boolean("no_guarantee_confirmed")
    .notNull()
    .default(false),
  facebookPostId: text("facebook_post_id"),
  instagramPostId: text("instagram_post_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishError: text("publish_error"),
});

export const draftEmails = pgTable("draft_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id").references(() => topics.id, {
    onDelete: "set null",
  }),
  aiSubject: text("ai_subject"),
  finalSubject: text("final_subject"),
  aiBodyHtml: text("ai_body_html"),
  finalBodyHtml: text("final_body_html"),
  aiBodyText: text("ai_body_text"),
  finalBodyText: text("final_body_text"),
  status: reviewStatusEnum("status").notNull().default("pending_review"),
  aiModel: text("ai_model"),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  disclaimerConfirmed: boolean("disclaimer_confirmed").notNull().default(false),
  noGuaranteeConfirmed: boolean("no_guarantee_confirmed")
    .notNull()
    .default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientsCount: integer("recipients_count"),
  sendError: text("send_error"),
});

export const subscribers = pgTable("subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  status: subscriberStatusEnum("status").notNull().default("active"),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  source: subscriberSourceEnum("source").notNull().default("manual"),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
});

export const emailSends = pgTable("email_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  draftEmailId: uuid("draft_email_id")
    .notNull()
    .references(() => draftEmails.id, { onDelete: "cascade" }),
  subscriberId: uuid("subscriber_id")
    .notNull()
    .references(() => subscribers.id, { onDelete: "cascade" }),
  status: emailSendStatusEnum("status").notNull(),
  providerMessageId: text("provider_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  error: text("error"),
});

export const generationRuns = pgTable("generation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  topicsGenerated: integer("topics_generated").notNull().default(0),
  postsGenerated: integer("posts_generated").notNull().default(0),
  emailsGenerated: integer("emails_generated").notNull().default(0),
  status: generationRunStatusEnum("status").notNull().default("running"),
  error: text("error"),
});

export const imageTemplates = pgTable("image_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  imageUrl: text("image_url").notNull(),
  textZone: templateTextZoneEnum("text_zone").notNull().default("bottom"),
  textColor: templateTextColorEnum("text_color").notNull().default("light"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rtmRuns = pgTable("rtm_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  itemsFound: integer("items_found").notNull().default(0),
  briefsGenerated: integer("briefs_generated").notNull().default(0),
  status: rtmRunStatusEnum("status").notNull().default("running"),
  feedErrors: text("feed_errors").array().notNull().default([]),
  error: text("error"),
});

export const rtmNewsItems = pgTable(
  "rtm_news_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => rtmRuns.id, { onDelete: "set null" }),
    // Publisher name (free text), e.g. "Ynet", "גלובס", "כלכליסט", "TheMarker".
    // Not an enum, because Google News search returns items from many sources.
    source: text("source").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    summary: text("summary"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    matchedKeywords: text("matched_keywords").array().notNull().default([]),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // The same article URL can be scanned by different advisors, so uniqueness is
  // per-user, not global.
  (t) => [unique("rtm_news_items_user_url_unique").on(t.userId, t.url)]
);

export const rtmBriefs = pgTable("rtm_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  newsItemId: uuid("news_item_id")
    .notNull()
    .unique()
    .references(() => rtmNewsItems.id, { onDelete: "cascade" }),
  rank: integer("rank").notNull().default(1),
  whatHappened: text("what_happened").notNull(),
  meaningForMortgageHolders: text("meaning_for_mortgage_holders").notNull(),
  closingQuestion: text("closing_question").notNull(),
  status: rtmBriefStatusEnum("status").notNull().default("new"),
  aiModel: text("ai_model"),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Tikia: Document intake + Smart NPV integration ──

export const docSourceEnum = pgEnum("doc_source", [
  "manual",
  "smart_npv",
  "whatsapp",
]);

export const docStatusEnum = pgEnum("doc_status", [
  "received",
  "analyzing",
  "identified",
  "pushed",
  "push_failed",
  "rejected",
]);

export const caseStatusEnum = pgEnum("case_status", [
  "active",
  "complete",
  "archived",
]);

export const tikiaCases = pgTable(
  "tikia_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),
    smartNpvClientId: text("smart_npv_client_id"),
    caseType: text("case_type"),
    requiredDocTypes: text("required_doc_types").array().notNull().default([]),
    status: caseStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("tikia_cases_user_phone_unique").on(t.userId, t.clientPhone),
  ]
);

export const tikiaDocuments = pgTable("tikia_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references((): AnyPgColumn => tikiaCases.id, { onDelete: "cascade" }),
  source: docSourceEnum("source").notNull().default("manual"),
  status: docStatusEnum("status").notNull().default("received"),
  docType: text("doc_type"),
  docTypeLabel: text("doc_type_label"),
  extractedData: text("extracted_data"),
  fileUrl: text("file_url"),
  smartNpvDocId: text("smart_npv_doc_id"),
  errorMessage: text("error_message"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Instagram Chatbot ──

export const chatbotTriggerActionEnum = pgEnum("chatbot_trigger_action", [
  "send_dm",
  "reply_comment",
  "both",
]);

export const chatbotTriggers = pgTable("chatbot_triggers", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyword: text("keyword").notNull().unique(),
  replyTemplate: text("reply_template").notNull(),
  action: chatbotTriggerActionEnum("action").notNull().default("send_dm"),
  active: boolean("active").notNull().default(true),
  timesTriggered: integer("times_triggered").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatbotConversationStatusEnum = pgEnum(
  "chatbot_conversation_status",
  ["active", "resolved", "escalated"]
);

export const chatbotConversations = pgTable("chatbot_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  igUserId: text("ig_user_id").notNull(),
  igUsername: text("ig_username"),
  status: chatbotConversationStatusEnum("status")
    .notNull()
    .default("active"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatbotMessageDirectionEnum = pgEnum(
  "chatbot_message_direction",
  ["inbound", "outbound"]
);

export const chatbotMessageSourceEnum = pgEnum("chatbot_message_source", [
  "comment",
  "dm",
  "story_reply",
]);

export const chatbotMessages = pgTable("chatbot_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => chatbotConversations.id, { onDelete: "cascade" }),
  direction: chatbotMessageDirectionEnum("direction").notNull(),
  source: chatbotMessageSourceEnum("source").notNull().default("dm"),
  text: text("text").notNull(),
  triggerId: uuid("trigger_id").references(() => chatbotTriggers.id, {
    onDelete: "set null",
  }),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  igMessageId: text("ig_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatbotSettings = pgTable("chatbot_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  aiSmartRepliesEnabled: boolean("ai_smart_replies_enabled")
    .notNull()
    .default(true),
  storyAutoReplyEnabled: boolean("story_auto_reply_enabled")
    .notNull()
    .default(true),
  storyAutoReplyTemplate: text("story_auto_reply_template")
    .notNull()
    .default("תודה על התגובה! 🙏 אשמח לעזור - שלח/י לי הודעה ואחזור אליך בהקדם"),
  commentToDmEnabled: boolean("comment_to_dm_enabled")
    .notNull()
    .default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tikiaScanRuns = pgTable("tikia_scan_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  casesScanned: integer("cases_scanned").notNull().default(0),
  newDocsDetected: integer("new_docs_detected").notNull().default(0),
  status: rtmRunStatusEnum("status").notNull().default("running"),
  error: text("error"),
});

// Business plan module: one settings document per advisor, plus logged entries
// (daily reports, marketing actions, monthly actual expenses).
export const planEntryKindEnum = pgEnum("plan_entry_kind", [
  "day",
  "action",
  "expense",
]);

export const planSettings = pgTable("plan_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const planEntries = pgTable(
  "plan_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: planEntryKindEnum("kind").notNull(),
    // day: YYYY-MM-DD, expense: YYYY-MM, action: client generated id
    key: text("key").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("plan_entries_user_kind_key_unique").on(t.userId, t.kind, t.key)]
);

// Leads: every person who might become a client, from any source (groups, site,
// lectures, partners, referrals). The funnel stage and the next step live here.
export const leadStageEnum = pgEnum("lead_stage", [
  "found",
  "replied",
  "conversation",
  "meeting",
  "client",
  "lost",
]);

export const leadTypeEnum = pgEnum("lead_type", [
  "upgrader",
  "investor",
  "refinance",
  "purchase",
  "lecture",
  "other",
]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Where it came from: facebook, instagram, site, lecture, partner, referral...
    source: text("source").notNull().default("manual"),
    medium: text("medium"),
    campaign: text("campaign"),
    groupName: text("group_name"),
    postUrl: text("post_url"),
    name: text("name").notNull(),
    phone: text("phone"),
    topic: text("topic"),
    type: leadTypeEnum("type").notNull().default("other"),
    stage: leadStageEnum("stage").notNull().default("found"),
    nextStep: text("next_step"),
    nextAt: timestamp("next_at", { withTimezone: true }),
    // Estimated fee if it closes (₪).
    value: integer("value"),
    notes: text("notes").notNull().default(""),
    // Lets a scanner re-send the same find without creating duplicates.
    externalKey: text("external_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("leads_user_external_key_unique").on(t.userId, t.externalKey)]
);

// Canva connection (OAuth tokens) per advisor, used by the content library.
export const canvaConnections = pgTable("canva_connections", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Partners (brokers, sales offices, brokerages) ──
// Stage and kind are plain text on purpose (validated in lib/partners.ts) so the
// workflow can evolve without ALTER TYPE migrations.

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // broker | sales | office
    kind: text("kind").notNull().default("broker"),
    name: text("name").notNull(),
    org: text("org"),
    instagram: text("instagram"),
    phone: text("phone"),
    area: text("area"),
    address: text("address"),
    // Visit route grouping for offices (e.g. "מסלול הרצל").
    route: text("route"),
    why: text("why"),
    channel: text("channel"),
    // Kind-specific extras for sales offices / projects (developer, marketer, units, priceFrom...).
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    priority: text("priority"),
    // 1 | 2 | quiet | last | tbd
    wave: text("wave"),
    // Opening-message hook being tested (h_q, h_card, s_desk...).
    hook: text("hook"),
    stage: text("stage").notNull().default("cold"),
    nextAction: text("next_action"),
    nextAt: date("next_at", { mode: "string" }),
    followDate: date("follow_date", { mode: "string" }),
    coupon: boolean("coupon").notNull().default(false),
    couponCode: text("coupon_code"),
    notes: text("notes").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    archiveReason: text("archive_reason"),
    // Lets an importer or scanner re-send the same find without creating duplicates.
    externalKey: text("external_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("partners_user_external_key_unique").on(t.userId, t.externalKey)]
);

export const partnerEvents = pgTable("partner_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id")
    .notNull()
    .references((): AnyPgColumn => partners.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // follow, sentMsg, sentReminder, replied, visit, note, ...
  kind: text("kind").notNull(),
  text: text("text").notNull().default(""),
  // The hook the partner had when this happened, so reply rates can be measured per hook.
  hook: text("hook"),
  // Snapshot of the partner before this action, so the action can be undone.
  prev: jsonb("prev").$type<Record<string, unknown> | null>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Clients (journey through a work process) ──
// No financial details are stored here. The case itself lives in Smart NPV.

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  // One of the process keys in lib/clients.ts.
  process: text("process").notNull().default("second_hand_tabu"),
  stageIndex: integer("stage_index").notNull().default(0),
  stageStartedAt: date("stage_started_at", { mode: "string" }),
  stageDueAt: date("stage_due_at", { mode: "string" }),
  // active | completed | archived
  status: text("status").notNull().default("active"),
  // Key of the update message waiting to be sent to the client (enter:docs, done, milestone:rate_ok...).
  pendingMessage: text("pending_message"),
  leadId: uuid("lead_id").references((): AnyPgColumn => leads.id, { onDelete: "set null" }),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clientEvents = pgTable("client_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references((): AnyPgColumn => clients.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // created, stage_done, milestone, update_sent, process_changed, stage_set, note
  kind: text("kind").notNull(),
  text: text("text").notNull().default(""),
  stageKey: text("stage_key"),
  // Snapshot of the client before this action, so the action can be undone.
  prev: jsonb("prev").$type<Record<string, unknown> | null>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Content tracking ──

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Short code used as utm_campaign in links, so leads can be attributed to this piece.
    code: text("code").notNull(),
    title: text("title").notNull(),
    // instagram | facebook | tiktok | youtube | podcast | other
    platform: text("platform").notNull().default("instagram"),
    // post | reel | story | carousel | video | podcast | other
    format: text("format").notNull().default("post"),
    topic: text("topic"),
    // idea | planned | published
    status: text("status").notNull().default("idea"),
    plannedAt: date("planned_at", { mode: "string" }),
    publishedAt: date("published_at", { mode: "string" }),
    url: text("url"),
    caption: text("caption").notNull().default(""),
    notes: text("notes").notNull().default(""),
    draftPostId: uuid("draft_post_id").references((): AnyPgColumn => draftPosts.id, { onDelete: "set null" }),
    // views, reach, likes, comments, shares, saves, followers
    metrics: jsonb("metrics").$type<Record<string, number>>().notNull().default({}),
    metricsAt: timestamp("metrics_at", { withTimezone: true }),
    // Public Blob URLs of the performance screenshots.
    screenshots: text("screenshots").array().notNull().default([]),
    insights: text("insights"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("content_items_user_code_unique").on(t.userId, t.code),
    unique("content_items_user_draft_unique").on(t.userId, t.draftPostId),
  ]
);

// ── Manual tasks (the Eisenhower day) ──

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueAt: date("due_at", { mode: "string" }),
  important: boolean("important").notNull().default(false),
  estMinutes: integer("est_minutes").notNull().default(15),
  // revenue | growth | exposure | admin
  goal: text("goal").notNull().default("admin"),
  // 1..4: forces the quadrant regardless of date and importance.
  quadrantOverride: integer("quadrant_override"),
  // How many times the task was pushed to another day.
  postponed: integer("postponed").notNull().default(0),
  // open | done | dropped
  status: text("status").notNull().default("open"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Push notifications ──

// The server's VAPID key pair (one row). Generated on first use, so no environment secret is needed.
export const pushKeys = pgTable("push_keys", {
  id: text("id").primaryKey().default("vapid"),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  // When each kind of notification was last sent, so a retry never sends it twice in a day.
  lastMorningAt: timestamp("last_morning_at", { withTimezone: true }),
  lastNudgeAt: timestamp("last_nudge_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
