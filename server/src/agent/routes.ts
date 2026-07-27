import { Router } from "express";
import { getSettings, getUserProviders, PROVIDER_BASE_URLS, type LLMProvider } from "../settings.js";
import { createSession, getSession, deleteSession, addMessage, listSessions, loadSessionById } from "./session-store.js";
import { runAgentStream } from "./orchestrator.js";

const router = Router();

router.post("/tailor", async (req, res) => {
  try {
    const { jobUrl, resumeProjectPath, message, apiKey, model, provider } = req.body;
    const userId = req.userId!;

    if (!resumeProjectPath) {
      res.status(400).json({ error: "resumeProjectPath is required" });
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

      const userMessage = message || (jobUrl ? `Tailor my resume for this job: ${jobUrl}` : "Help me improve my resume.");
      const { sessionId, sessionToken } = createSession(
        userId,
        resumeProjectPath,
        llmSettings,
        jobUrl || undefined,
        userMessage,
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

    const userMessage = message || (jobUrl ? `Tailor my resume for this job: ${jobUrl}` : "Help me improve my resume.");
    const { sessionId, sessionToken } = createSession(
      userId,
      resumeProjectPath,
      llmSettings,
      jobUrl || undefined,
      userMessage,
    );

    res.json({ sessionId, sessionToken });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.post("/sessions/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { message, token } = req.body;

    if (!token) {
      res.status(401).json({ error: "Missing session token" });
      return;
    }

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const session = await getSession(id, token);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    addMessage(id, "user", message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.body.token || (req.query.token as string | undefined);

    if (!token) {
      res.status(401).json({ error: "Missing session token" });
      return;
    }

    const session = await getSession(id, token);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    deleteSession(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const userId = req.userId!;
    const { resumeProjectPath } = req.query;

    if (!resumeProjectPath || typeof resumeProjectPath !== "string") {
      res.status(400).json({ error: "resumeProjectPath query param is required" });
      return;
    }

    const summaries = await listSessions(userId, resumeProjectPath);
    res.json(summaries);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const loaded = await loadSessionById(id);
    if (!loaded || loaded.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (Date.now() - loaded.lastActivityAt > 30 * 60 * 1000) {
      deleteSession(id);
      res.status(404).json({ error: "Session expired" });
      return;
    }

    res.json({
      id: loaded.id,
      resumeProjectPath: loaded.resumeProjectPath,
      jobUrl: loaded.jobUrl,
      messages: loaded.messages,
      createdAt: loaded.createdAt,
      lastActivityAt: loaded.lastActivityAt,
      sessionToken: loaded.sessionToken,
    });
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

    const session = await getSession(id, token);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    await runAgentStream(session, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
});
