import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userSettings } from "../db/schema";

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
    res.json({ provider: "openai", apiKey: "", baseUrl: "", model: "", storageMode: "local" });
    return;
  }

  res.json({
    provider: row.provider,
    apiKey: maskApiKey(row.apiKey),
    baseUrl: row.baseUrl || "",
    model: row.model || "",
    storageMode: row.storageMode || "local",
  });
});

router.put("/", async (req, res) => {
  const userId = getUserId(req);
  const { provider, apiKey, baseUrl, model, storageMode } = req.body;

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
    storageMode: storageMode || "local",
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
    storageMode: row.storageMode || "local",
  });
});

export default router;
