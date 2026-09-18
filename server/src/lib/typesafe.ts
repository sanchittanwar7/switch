import {
  TypeSafeClient,
  APIError,
  APIConnectionError,
  APITimeoutError,
  TypeSafeError,
} from "@typesafe-ai/sdk";

let client: TypeSafeClient | null = null;

/**
 * Configuration is missing. Distinct from API/transport errors so callers can
 * show a targeted "set your key" message rather than a generic failure.
 */
export class TypeSafeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypeSafeConfigError";
  }
}

export function isTypeSafeConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export function getTypeSafeClient(): TypeSafeClient {
  if (!client) {
    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      throw new TypeSafeConfigError("TYPESAFE_API_KEY is not configured");
    }
    client = new TypeSafeClient({ apiKey });
  }
  return client;
}

/**
 * Normalize any error thrown during a systemOne call into a short,
 * human-readable string suitable for surfacing to the agent.
 */
export function describeTypeSafeError(err: unknown): string {
  if (err instanceof TypeSafeConfigError) {
    return "TypeSafe AI is not configured. Set TYPESAFE_API_KEY in server/.env.";
  }
  if (err instanceof APIError) {
    return `TypeSafe API error (${err.status}): ${err.message}`;
  }
  if (err instanceof APIConnectionError) {
    return "Could not reach TypeSafe AI. Check network connectivity and retry.";
  }
  if (err instanceof APITimeoutError) {
    return "TypeSafe AI request timed out. Try again or reduce the number of roles.";
  }
  if (err instanceof TypeSafeError) {
    return `TypeSafe AI error: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Unknown TypeSafe AI error";
}
