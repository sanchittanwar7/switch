import DodoPayments from "dodopayments";

export type DodoEnvironment = "test_mode" | "live_mode";

export type DodoWebhookEvent = ReturnType<DodoPayments["webhooks"]["unwrap"]>;

export function getDodoEnvironment(): DodoEnvironment {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export function getDodoApiKey(): string {
  return process.env.DODO_PAYMENTS_API_KEY ?? "";
}

export function getDodoWebhookKey(): string {
  return process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "";
}

export function getDodoProductId(): string {
  return process.env.DODO_PRODUCT_ID ?? "";
}

export function getClientBaseUrl(): string {
  return (process.env.CLIENT_BASE_URL ?? "http://localhost:5173").replace(/\/+$/, "");
}

let client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!client) {
    client = new DodoPayments({
      bearerToken: getDodoApiKey(),
      environment: getDodoEnvironment(),
      webhookKey: getDodoWebhookKey() || null,
    });
  }
  return client;
}

export interface DodoCheckout {
  checkoutUrl: string;
  sessionId: string;
  amountPaise: number;
  currency: string;
}

export async function createDodoCheckout(params: {
  listingId: string;
  amountPaise: number;
}): Promise<DodoCheckout> {
  const productId = getDodoProductId();
  if (!productId) {
    throw new Error("DODO_PRODUCT_ID is not configured");
  }

  const base = getClientBaseUrl();
  const session = await getDodoClient().checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1, amount: params.amountPaise }],
    metadata: { listingId: params.listingId },
    return_url: `${base}/bidding`,
    cancel_url: `${base}/bidding`,
    customization: { theme: "dark" },
    feature_flags: { redirect_immediately: true },
  });

  if (!session.checkout_url) {
    throw new Error("Dodo checkout session returned no checkout_url");
  }

  return {
    checkoutUrl: session.checkout_url,
    sessionId: session.session_id,
    amountPaise: params.amountPaise,
    currency: "INR",
  };
}

export function verifyDodoWebhook(
  rawBody: Buffer | string,
  headers: Record<string, string>,
): DodoWebhookEvent {
  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  return getDodoClient().webhooks.unwrap(body, { headers });
}
