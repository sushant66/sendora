import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Base schema — authentication (Auth.js canonical tables) + feature tables.
 *
 * Feature tables are added in their respective phases:
 *   - RecruiterContact ............ User Story 1
 *   - ConnectedEmailAccount, EmailTemplate, SendBatch, SendRecord ... User Story 2
 * See specs/001-recruiter-outreach/data-model.md.
 */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

/**
 * RecruiterContact (User Story 1) — a recruiter the job seeker intends to reach.
 * Owned by exactly one user; deduped per user on the normalized email (FR-003/005/022).
 */
export const recruiterContacts = pgTable(
  "recruiter_contact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    company: text("company"),
    role: text("role"),
    source: text("source").notNull(),
    // Soft-delete (feature 002, US4, FR-022/FR-023): a non-null deletedAt hides the row from
    // every read; deletedBatch groups the rows removed by one delete action (the unit of undo).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBatch: text("deleted_batch"),
    // Millisecond precision so the keyset cursor (a JS Date → ISO string) round-trips
    // losslessly; without it, a bulk import (one transaction timestamp) breaks pagination.
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Partial unique index: a soft-deleted email no longer blocks re-adding the same address.
    uniqueIndex("recruiter_contact_user_email_idx")
      .on(t.userId, t.emailNormalized)
      .where(sql`${t.deletedAt} IS NULL`),
    index("recruiter_contact_user_idx").on(t.userId),
    index("recruiter_contact_deleted_batch_idx").on(t.deletedBatch),
  ],
);

export type RecruiterContactRow = typeof recruiterContacts.$inferSelect;

/**
 * SenderProfile (feature 002, User Story 1) — one row per user (1:1 with `user`), created
 * lazily on first save. Backs the sender (`my_*`) merge fields and the authoritative in-app
 * display name (FR-001). Every value field is nullable; an empty profile is a full set of
 * nulls. A user reads/writes only their own row (FR-006/FR-024).
 */
export const senderProfiles = pgTable(
  "sender_profile",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    title: text("title"),
    pitch: text("pitch"),
    skills: text("skills"),
    link: text("link"),
    location: text("location"),
    workPreference: text("work_preference"), // remote | hybrid | onsite | open
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sender_profile_user_idx").on(t.userId)],
);
export type SenderProfileRow = typeof senderProfiles.$inferSelect;

/**
 * ConnectedEmailAccount (User Story 2) — authorization to send from an external provider
 * (FR-019/a/b/c). Gmail is the only `provider` in v1. Tokens are encrypted at rest and
 * never returned to the client.
 */
export const connectedEmailAccounts = pgTable(
  "connected_email_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "gmail" in v1
    emailAddress: text("email_address").notNull(),
    accessToken: text("access_token"), // encrypted; short-lived
    refreshToken: text("refresh_token").notNull(), // encrypted at rest
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes").array().notNull().default([]),
    status: text("status").notNull().default("active"), // active | expired | revoked
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("connected_account_user_provider_email_idx").on(t.userId, t.provider, t.emailAddress)],
);
export type ConnectedEmailAccountRow = typeof connectedEmailAccounts.$inferSelect;

/**
 * EmailTemplate (User Story 2 starter library + User Story 3 custom). System templates
 * (`kind='system'`, `user_id` null) are read-only and shared; custom templates are owned.
 */
export const emailTemplates = pgTable(
  "email_template",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // null for system
    kind: text("kind").notNull(), // system | custom
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull(),
    mergeFields: text("merge_fields").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_template_user_idx").on(t.userId)],
);
export type EmailTemplateRow = typeof emailTemplates.$inferSelect;

/**
 * SendBatch (User Story 2/4) — groups the SendRecords from one send action so results
 * report in aggregate (FR-018). A single send is a batch of size 1.
 */
export const sendBatches = pgTable(
  "send_batch",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectedAccountId: text("connected_account_id")
      .notNull()
      .references(() => connectedEmailAccounts.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => emailTemplates.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // single | bulk
    total: integer("total").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    status: text("status").notNull().default("in_progress"), // in_progress | completed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("send_batch_user_idx").on(t.userId)],
);
export type SendBatchRow = typeof sendBatches.$inferSelect;

/**
 * SendRecord (User Story 2/4/5) — one email sent (or attempted) to one recruiter. Content
 * is snapshotted at send time; editing a template later never alters history (US5).
 * `contact_id` is nullable so deleting a contact preserves its immutable history rows.
 */
export const sendRecords = pgTable(
  "send_record",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => sendBatches.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => recruiterContacts.id, { onDelete: "set null" }),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html").notNull(),
    bodyText: text("body_text").notNull(),
    status: text("status").notNull().default("pending"), // pending | sent | failed
    failureReason: text("failure_reason"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // Millisecond precision so the history keyset cursor round-trips losslessly (a bulk
    // send shares one transaction timestamp across all its records).
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("send_record_user_idx").on(t.userId),
    index("send_record_user_contact_idx").on(t.userId, t.contactId),
    index("send_record_batch_idx").on(t.batchId),
  ],
);
export type SendRecordRow = typeof sendRecords.$inferSelect;
