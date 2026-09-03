import { createHmac, timingSafeEqual } from "node:crypto";

export type RazorpayMode = "test" | "live";

export function getRazorpayMode(): RazorpayMode {
  const env = process.env.RAZORPAY_MODE;
  if (env === "test" || env === "live") return env;
  return process.env.NODE_ENV === "development" ? "test" : "live";
}

export function getWebhookSecret(): string {
  const mode = getRazorpayMode();
  return (
    process.env[`RAZORPAY_WEBHOOK_SECRET_${mode.toUpperCase()}`] ??
    process.env.RAZORPAY_WEBHOOK_SECRET ??
    ""
  );
}

export function getKeyId(): string {
  const mode = getRazorpayMode();
  return (
    process.env[`RAZORPAY_KEY_ID_${mode.toUpperCase()}`] ??
    process.env.RAZORPAY_KEY_ID ??
    ""
  );
}

export function getKeySecret(): string {
  const mode = getRazorpayMode();
  return (
    process.env[`RAZORPAY_KEY_SECRET_${mode.toUpperCase()}`] ??
    process.env.RAZORPAY_KEY_SECRET ??
    ""
  );
}

export interface RazorpayOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
}

export async function createRazorpayOrder(params: {
  amountPaise: number;
  currency: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const keyId = getKeyId();
  const keySecret = getKeySecret();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay API keys not configured");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency,
      notes: params.notes,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order creation failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string; amount: number; currency: string };
  return { orderId: data.id, amountPaise: data.amount, currency: data.currency };
}

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret || rawBody === undefined || rawBody === null) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
