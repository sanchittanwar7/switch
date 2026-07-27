import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userSettings } from "../db/schema";
import {
  getUserProviders,
  addUserProvider,
  deleteUserProvider,
  setDefaultModel,
  LLM_PROVIDERS,
  PROVIDER_MODELS,
  PROVIDER_BASE_URLS,
  type LLMProvider,
} from "../settings";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

function maskApiKey(key: string): string {
  if (!key || key.length <= 6) return "";
  return key.slice(0, 3) + "..." + key.slice(-3);
}

router.get("/", async (req, res) => {
  const userId = getUserId(req);

  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!row) {
    res.json({ provider: "openai", apiKey: "", baseUrl: "", model: "" });
    return;
  }

  res.json({
    provider: row.provider,
    apiKey: maskApiKey(row.apiKey),
    baseUrl: row.baseUrl || "",
    model: row.model || "",
  });
});

router.put("/", async (req, res) => {
  const userId = getUserId(req);
  const { provider, apiKey, baseUrl, model } = req.body;

  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const effectiveApiKey =
    apiKey && !apiKey.includes("...") ? apiKey : existing?.apiKey || "";

  const values = {
    userId,
    provider: provider || "openai",
    apiKey: effectiveApiKey,
    baseUrl: baseUrl || null,
    model: model || null,
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(userSettings)
    .values(values)
    .onConflictDoUpdate({
      target: [userSettings.userId],
      set: values,
    })
    .returning();

  res.json({
    provider: row.provider,
    apiKey: maskApiKey(row.apiKey),
    baseUrl: row.baseUrl || "",
    model: row.model || "",
  });
});

router.get("/providers", async (req, res) => {
  const userId = getUserId(req);
  const providers = await getUserProviders(userId);

  const configured = providers.map((p) => ({
    id: p.id,
    provider: p.provider,
    apiKey: maskApiKey(p.apiKey),
    baseUrl: PROVIDER_BASE_URLS[p.provider] || "",
    models: PROVIDER_MODELS[p.provider] || [],
    defaultModel: p.defaultModel || PROVIDER_MODELS[p.provider]?.[0] || null,
  }));

  res.json(configured);
});

router.post("/providers", async (req, res) => {
  const userId = getUserId(req);
  const { provider, apiKey } = req.body;

  if (!provider || !LLM_PROVIDERS.includes(provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }

  if (!apiKey || apiKey.includes("...")) {
    res.status(400).json({ error: "API key is required" });
    return;
  }

  const created = await addUserProvider(userId, provider as LLMProvider, apiKey);

  res.json({
    id: created.id,
    provider: created.provider,
    apiKey: maskApiKey(created.apiKey),
    baseUrl: PROVIDER_BASE_URLS[created.provider] || "",
    models: PROVIDER_MODELS[created.provider] || [],
    defaultModel: created.defaultModel || PROVIDER_MODELS[created.provider]?.[0] || null,
  });
});

router.put("/providers/:id/default-model", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  const { model } = req.body;

  const updated = await setDefaultModel(userId, id, model || null);
  if (!updated) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  res.json({
    id: updated.id,
    provider: updated.provider,
    apiKey: maskApiKey(updated.apiKey),
    baseUrl: PROVIDER_BASE_URLS[updated.provider] || "",
    models: PROVIDER_MODELS[updated.provider] || [],
    defaultModel: updated.defaultModel || PROVIDER_MODELS[updated.provider]?.[0] || null,
  });
});

router.delete("/providers/:id", async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;

  const deleted = await deleteUserProvider(userId, id);
  if (!deleted) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  res.json({ success: true });
});

router.get("/models", async (req, res) => {
  const userId = getUserId(req);
  const providers = await getUserProviders(userId);

  const availableModels = providers.map((p) => ({
    provider: p.provider,
    providerId: p.id,
    models: PROVIDER_MODELS[p.provider] || [],
    defaultModel: p.defaultModel || PROVIDER_MODELS[p.provider]?.[0] || null,
  }));

  res.json(availableModels);
});

export default router;
