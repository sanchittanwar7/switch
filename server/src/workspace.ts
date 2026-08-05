import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "./utils/paths";
import { runMigrations } from "./db/migrate";
import { seedColumns } from "./db/seed";
import { sql } from "drizzle-orm";
import { db } from "./db";

export async function ensureUserWorkspace(userId: string): Promise<void> {
  const root = getWorkspaceRoot(userId);
  await fs.mkdir(path.join(root, "resumes"), { recursive: true });
}

async function ensureInterviewsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "interviews" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "application_id" uuid NOT NULL,
      "type" text NOT NULL,
      "status" text DEFAULT 'scheduled' NOT NULL,
      "scheduled_at" timestamp with time zone,
      "question_title" text,
      "feedback" text,
      "question_detail" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'interviews_application_id_applications_id_fk'
      ) THEN
        ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk"
        FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `);
}

async function ensureShareQuestionsColumn(): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_settings' AND column_name = 'share_questions'
      ) THEN
        ALTER TABLE "user_settings" ADD COLUMN "share_questions" boolean DEFAULT false NOT NULL;
      END IF;
    END $$;
  `);
}

async function ensureSharedColumn(): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'interviews' AND column_name = 'shared'
      ) THEN
        ALTER TABLE "interviews" ADD COLUMN "shared" boolean DEFAULT false NOT NULL;
      END IF;
    END $$;
  `);
}

export async function initializeDatabase(): Promise<void> {
  try {
    await runMigrations();
  } catch (err) {
    console.error("Migration skipped (tables may already exist):", (err as any)?.message);
  }
  await seedColumns();
  await ensureInterviewsTable();
  await ensureShareQuestionsColumn();
  await ensureSharedColumn();
}
