ALTER TABLE "board_payments" RENAME COLUMN "razorpay_payment_id" TO "payment_id";--> statement-breakpoint
DROP INDEX "board_payments_razorpay_payment_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "board_payments_payment_id_idx" ON "board_payments" USING btree ("payment_id");