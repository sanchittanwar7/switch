import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { boardListings, boardPayments } from "../db/schema";
import { verifyWebhookSignature, getWebhookSecret } from "../lib/razorpay";

const router = Router();

const MIN_PAISE = Number(process.env.BOARD_MIN_PAISE) || 9900;

router.post("/razorpay", async (req, res) => {
  try {
    const rawBody = req.body as Buffer;
    const signature = req.headers["x-razorpay-signature"];
    const signatureStr = Array.isArray(signature) ? signature[0] : signature;

    if (!verifyWebhookSignature(rawBody, signatureStr, getWebhookSecret())) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    if (payload?.event !== "payment.captured") {
      res.json({ status: "ignored" });
      return;
    }

    const entity = payload?.payload?.payment?.entity;
    const razorpayPaymentId = entity?.id;
    const amountPaise = Number(entity?.amount);
    const listingId = entity?.notes?.listingId;

    if (!razorpayPaymentId || typeof listingId !== "string" || !listingId) {
      console.warn("[board-webhook] unattributed payment (missing id or notes.listingId)");
      res.json({ status: "unattributed" });
      return;
    }

    const [listing] = await db
      .select()
      .from(boardListings)
      .where(eq(boardListings.id, listingId));

    if (!listing) {
      console.warn(`[board-webhook] unknown listing id: ${listingId}`);
      res.json({ status: "unattributed" });
      return;
    }

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      console.warn(`[board-webhook] invalid amount: ${entity?.amount}`);
      res.json({ status: "unattributed" });
      return;
    }

    const qualifies = amountPaise >= MIN_PAISE;

    await db
      .insert(boardPayments)
      .values({
        listingId: listing.id,
        razorpayPaymentId,
        amountPaise,
        status: qualifies ? "captured" : "flagged",
      })
      .onConflictDoNothing({ target: boardPayments.razorpayPaymentId });

    if (!qualifies) {
      console.warn(
        `[board-webhook] sub-minimum payment flagged: ${razorpayPaymentId} (${amountPaise} < ${MIN_PAISE})`,
      );
      res.json({ status: "flagged" });
      return;
    }

    if (listing.status === "pending_payment") {
      await db
        .update(boardListings)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(boardListings.id, listing.id));
    }

    res.json({ status: "captured" });
  } catch (err) {
    console.error("[board-webhook] error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
