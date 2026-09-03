CREATE TABLE "board_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"company" text,
	"resume_url" text,
	"linkedin_url" text,
	"x_url" text,
	"github_url" text,
	"years_experience" integer,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"locations" text[] DEFAULT '{}' NOT NULL,
	"jd_url" text,
	"salary_min" integer,
	"salary_max" integer,
	"currency" text DEFAULT 'INR' NOT NULL,
	"role" text,
	"years_experience_min" integer,
	"years_experience_max" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"user_id" uuid,
	"razorpay_payment_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" text DEFAULT 'captured' NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board_payments" ADD CONSTRAINT "board_payments_listing_id_board_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."board_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_payments" ADD CONSTRAINT "board_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_listings_content_hash_idx" ON "board_listings" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "board_listings_kind_idx" ON "board_listings" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "board_listings_status_idx" ON "board_listings" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "board_payments_razorpay_payment_id_idx" ON "board_payments" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE INDEX "board_payments_listing_id_idx" ON "board_payments" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "board_payments_captured_at_idx" ON "board_payments" USING btree ("captured_at");