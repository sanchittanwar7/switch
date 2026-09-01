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
