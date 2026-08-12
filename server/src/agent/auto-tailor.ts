import { Router } from "express";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { db } from "../db";
import { applications } from "../db/schema";
import { resolvePath } from "../utils/paths";
import {
  getSettings,
  getUserProviders,
  getDefaultResumeName,
  PROVIDER_BASE_URLS,
  PROVIDER_DEFAULTS,
} from "../settings";
import { createSession } from "./session-store";

const router = Router();

function sanitizeForPath(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

router.post("/auto-tailor", async (req, res) => {
  try {
    const { cardId, provider, model, apiKey } = req.body;
    const userId = req.userId!;

    if (!cardId) {
      res.status(400).json({ error: "cardId is required" });
      return;
    }

    // 1. Validate card
    const [card] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, cardId));

    if (!card || card.userId !== userId) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    if (!card.jobUrl) {
      res.status(400).json({ error: "This card has no job URL. Add one first." });
      return;
    }

    // 2. Get default resume name
    const defaultResumeName = await getDefaultResumeName(userId);
    if (!defaultResumeName) {
      res.status(400).json({ error: "No default resume set. Go to Resumes to pick one." });
      return;
    }

    // 3. Validate default resume exists on disk
    const defaultResumePath = resolvePath(`resumes/${defaultResumeName}`, userId);
    try {
      const stat = await fs.stat(defaultResumePath);
      if (!stat.isDirectory()) throw new Error("not a directory");
    } catch {
      res.status(400).json({ error: "Default resume not found. It may have been deleted." });
      return;
    }

    // 4. Generate tailored directory name
    const company = sanitizeForPath(card.company);
    const role = sanitizeForPath(card.role);
    const timestamp = Date.now();
    const tailoredDirName = `tailored-${company}-${role}-${timestamp}`;
    const tailoredResumePath = resolvePath(`resumes/${tailoredDirName}`, userId);

    // 5. Copy default resume to tailored directory
    try {
      await fs.cp(defaultResumePath, tailoredResumePath, { recursive: true });
    } catch (err) {
      res.status(500).json({
        error: `Failed to copy resume: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      return;
    }

    // Remove sessions directory copied from source resume
    try {
      await fs.rm(path.join(tailoredResumePath, "sessions"), { recursive: true, force: true });
    } catch {
      // ok if sessions dir doesn't exist
    }

    // 6. Build LLM settings
    if (provider && model) {
      const userProviders = await getUserProviders(userId);
      const userProvider = userProviders.find((p) => p.provider === provider);

      if (!userProvider) {
        res.status(400).json({ error: `Provider "${provider}" not configured. Add it in Settings.` });
        return;
      }

      if (!userProvider.apiKey) {
        res.status(400).json({ error: `No API key configured for "${provider}". Set one in Settings.` });
        return;
      }

      const llmSettings = {
        provider: userProvider.provider,
        apiKey: userProvider.apiKey,
        baseUrl: PROVIDER_BASE_URLS[userProvider.provider] || "",
        model,
      };

      // 7. Build initial message
      const initialMessage = `Tailor my resume for this job: ${card.jobUrl}. The company is ${card.company} and the role is ${card.role}.`;

      // 8. Create agent session
      const { sessionId, sessionToken } = createSession(
        userId,
        `resumes/${tailoredDirName}`,
        llmSettings,
        card.jobUrl,
        initialMessage,
      );

      res.json({ sessionId, sessionToken, tailoredResumePath: tailoredDirName, cardId });
      return;
    }

    // Fallback to default settings
    const settings = await getSettings(userId);
    let llmSettings = {
      ...settings.llm,
      ...(apiKey ? { apiKey } : {}),
      ...(model ? { model } : {}),
    };

    if (!llmSettings.apiKey) {
      const userProviders = await getUserProviders(userId);
      const providerWithKey = userProviders.find((p) => p.apiKey);
      if (providerWithKey) {
        llmSettings = {
          provider: providerWithKey.provider,
          apiKey: providerWithKey.apiKey,
          baseUrl: PROVIDER_BASE_URLS[providerWithKey.provider] || "",
          model: model || providerWithKey.defaultModel || PROVIDER_DEFAULTS[providerWithKey.provider].model,
        };
      }
    }

    if (!llmSettings.apiKey) {
      res.status(400).json({
        error: "No API key configured. Set one in Settings.",
      });
      return;
    }

    // 7. Build initial message
    const initialMessage = `Tailor my resume for this job: ${card.jobUrl}. The company is ${card.company} and the role is ${card.role}.`;

    // 8. Create agent session
    const { sessionId, sessionToken } = createSession(
      userId,
      `resumes/${tailoredDirName}`,
      llmSettings,
      card.jobUrl,
      initialMessage,
    );

    res.json({ sessionId, sessionToken, tailoredResumePath: tailoredDirName, cardId });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
});

export default router;
