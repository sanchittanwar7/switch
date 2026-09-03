import { pgTable, text, uuid, timestamp, integer, bigint, uniqueIndex, index, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userSettings = pgTable("user_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("openai"),
  apiKey: text("api_key").notNull().default(""),
  baseUrl: text("base_url"),
  model: text("model"),
  storageMode: text("storage_mode").notNull().default("local"),
  shareQuestions: boolean("share_questions").notNull().default(false),
  researchInstructions: text("research_instructions"),
  defaultResumeName: text("default_resume_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdUnique: uniqueIndex("user_settings_user_id_idx").on(table.userId),
}));

export const userProviders = pgTable("user_providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  apiKey: text("api_key").notNull().default(""),
  defaultModel: text("default_model"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userProviderUnique: uniqueIndex("user_providers_user_provider_idx").on(table.userId, table.provider),
}));

export const columns = pgTable("columns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
});

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  jobUrl: text("job_url"),
  resumePath: text("resume_path"),
  tags: text("tags").array(),
  columnId: text("column_id")
    .notNull()
    .references(() => columns.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  status: text("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  questionTitle: text("question_title"),
  feedback: text("feedback"),
  questionDetail: text("question_detail"),
  shared: boolean("shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  company: text("company"),
  role: text("role"),
  roundName: text("round_name"),
  resumePath: text("resume_path"),
  jobUrl: text("job_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("events_user_id_idx").on(table.userId),
  startTimeIdx: index("events_start_time_idx").on(table.startTime),
}));

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  city: text("city"),
  country: text("country"),
  isRemote: boolean("is_remote").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdUnique: uniqueIndex("user_profiles_user_id_idx").on(table.userId),
}));

export const workExperiences = pgTable("work_experiences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  teamName: text("team_name"),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  skills: text("skills").array().notNull().default([]),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("work_experiences_user_id_idx").on(table.userId),
}));

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  github: text("github"),
  url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
}));

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  expertise: text("expertise").notNull().default("beginner"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("skills_user_id_idx").on(table.userId),
}));

export const boardListings = pgTable("board_listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentHash: text("content_hash").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending_payment"),
  name: text("name"),
  company: text("company"),
  resumeUrl: text("resume_url"),
  linkedinUrl: text("linkedin_url"),
  xUrl: text("x_url"),
  githubUrl: text("github_url"),
  yearsExperience: integer("years_experience"),
  skills: text("skills").array().notNull().default([]),
  locations: text("locations").array().notNull().default([]),
  jdUrl: text("jd_url"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  currency: text("currency").notNull().default("INR"),
  role: text("role"),
  yearsExperienceMin: integer("years_experience_min"),
  yearsExperienceMax: integer("years_experience_max"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  contentHashUnique: uniqueIndex("board_listings_content_hash_idx").on(table.contentHash),
  kindIdx: index("board_listings_kind_idx").on(table.kind),
  statusIdx: index("board_listings_status_idx").on(table.status),
}));

export const boardPayments = pgTable("board_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => boardListings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  razorpayPaymentId: text("razorpay_payment_id").notNull(),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  status: text("status").notNull().default("captured"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  razorpayPaymentIdUnique: uniqueIndex("board_payments_razorpay_payment_id_idx").on(
    table.razorpayPaymentId,
  ),
  listingIdIdx: index("board_payments_listing_id_idx").on(table.listingId),
  capturedAtIdx: index("board_payments_captured_at_idx").on(table.capturedAt),
}));
