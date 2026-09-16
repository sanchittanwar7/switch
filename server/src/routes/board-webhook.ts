import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { boardListings, boardPayments } from "../db/schema";
import { getDodoClient, verifyDodoWebhook, type DodoWebhookEvent } from "../lib/dodo";

const router = Router();

const MIN_PAISE = Number(process.env.BOARD_MIN_PAISE) || 9900;

router.post("/dodo", async (req, res) => {
  try {
    const rawBody = req.body as Buffer;

    const headers: Record<string, string> = {
      "webhook-id": String(req.headers["webhook-id"] ?? ""),
      "webhook-timestamp": String(req.headers["webhook-timestamp"] ?? ""),
      "webhook-signature": String(req.headers["webhook-signature"] ?? ""),
    };

    let payload: DodoWebhookEvent;
    try {
      payload = verifyDodoWebhook(rawBody, headers);
    } catch {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    if (payload.type !== "payment.succeeded") {
      res.json({ status: "ignored" });
      return;
    }

    const payment = payload.data;
    const paymentId = payment.payment_id;
    const amountPaise = Number(payment.total_amount);
    let listingId =
      typeof payment.metadata?.listingId === "string" ? payment.metadata.listingId : "";

    if (!listingId) {
      try {
        const full = await getDodoClient().payments.retrieve(paymentId);
        listingId =
          typeof full.metadata?.listingId === "string" ? full.metadata.listingId : "";
      } catch (err) {
        console.warn(`[board-webhook] failed to retrieve payment ${paymentId}:`, err);
      }
    }

    if (!paymentId || !listingId) {
      console.warn("[board-webhook] unattributed payment (missing id or metadata.listingId)");
      res.json({ status: "unattributed" });
      return;
    }

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      console.warn(`[board-webhook] invalid amount: ${payment.total_amount}`);
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

    const qualifies = amountPaise >= MIN_PAISE;

    await db
      .insert(boardPayments)
      .values({
        listingId: listing.id,
        paymentId,
        amountPaise,
        status: qualifies ? "captured" : "flagged",
      })
      .onConflictDoNothing({ target: boardPayments.paymentId });

    if (!qualifies) {
      console.warn(
        `[board-webhook] sub-minimum payment flagged: ${paymentId} (${amountPaise} < ${MIN_PAISE})`,
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
