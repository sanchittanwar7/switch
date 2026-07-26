import { Router } from "express";
import { getSettings, getUserProviders, PROVIDER_BASE_URLS, type LLMProvider } from "../settings";
import { createSession, getSession, deleteSession } from "./session-store";
import { runAgentStream } from "./orchestrator";

const router = Router();

router.post("/tailor", async (req, res) => {
  try {
    const { jobUrl, resumeProjectPath, apiKey, model, provider } = req.body;
    const userId = req.userId!;

    if (!jobUrl || !resumeProjectPath) {
      res.status(400).json({ error: "jobUrl and resumeProjectPath are required" });
      return;
    }

    const settings = await getSettings(userId);

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

      const { sessionId, sessionToken } = createSession(
        userId,
        jobUrl,
        resumeProjectPath,
        llmSettings,
      );

      res.json({ sessionId, sessionToken });
      return;
    }

    const llmSettings = {
      ...settings.llm,
      ...(apiKey ? { apiKey } : {}),
      ...(model ? { model } : {}),
    };

    if (!llmSettings.apiKey) {
      res.status(400).json({
        error: "No API key configured. Set one in Settings.",
      });
      return;
    }

    const { sessionId, sessionToken } = createSession(
      userId,
      jobUrl,
      resumeProjectPath,
      llmSettings,
    );

    res.json({ sessionId, sessionToken });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;

export const streamRouter = Router();

streamRouter.get("/sessions/:id/stream", async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token as string | undefined;

    if (!token) {
      res.status(401).json({ error: "Missing session token" });
      return;
    }

    const session = getSession(id, token);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    await runAgentStream(session, res);
    deleteSession(id);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
});
