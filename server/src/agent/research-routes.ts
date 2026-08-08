import { Router } from "express";
import { getSettings, getUserProviders, PROVIDER_BASE_URLS, type LLMProvider } from "../settings";
import {
  createResearchSession,
  getResearchSession,
  deleteResearchSession,
  addResearchMessage,
  listResearchSessions,
  loadResearchSessionByIdAndUserId,
  readResearchReport,
  getResearchReportStat,
  getResearchInstructions,
  setResearchInstructions,
} from "./research-session-store";
import { runResearchStream } from "./research-orchestrator";

const router = Router();

router.post("/sessions", async (req, res) => {
  try {
    const { message, provider, model } = req.body;
    const userId = req.userId!;

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const title = message.slice(0, 80);

    const settings = await getSettings(userId);

    let llmSettings;
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

      llmSettings = {
        provider: userProvider.provider,
        apiKey: userProvider.apiKey,
        baseUrl: PROVIDER_BASE_URLS[userProvider.provider] || "",
        model,
      };
    } else {
      llmSettings = settings.llm;

      if (!llmSettings.apiKey) {
        res.status(400).json({
          error: "No API key configured. Set one in Settings.",
        });
        return;
      }
    }

    const { sessionId, sessionToken } = createResearchSession(userId, title, llmSettings, message);

    res.json({ sessionId, sessionToken });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    const userId = req.userId!;
    const summaries = await listResearchSessions(userId);
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

    const session = await loadResearchSessionByIdAndUserId(id, userId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({
      id: session.id,
      title: session.title,
      messages: session.messages,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      sessionToken: session.sessionToken,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    await deleteResearchSession(userId, id);
    res.json({ success: true });
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

    const session = await getResearchSession(id, token, req.userId!);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    addResearchMessage(id, "user", message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/sessions/:id/report", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const content = await readResearchReport(userId, id);
    const stat = await getResearchReportStat(userId, id);

    res.json({
      content,
      lastModified: stat?.lastModified ?? null,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/instructions", async (req, res) => {
  try {
    const userId = req.userId!;
    const instructions = await getResearchInstructions(userId);
    res.json({ instructions });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.put("/instructions", async (req, res) => {
  try {
    const userId = req.userId!;
    const { instructions } = req.body;

    await setResearchInstructions(userId, instructions ?? null);

    res.json({ instructions: instructions ?? null });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;

export const researchStreamRouter = Router();

researchStreamRouter.get("/sessions/:id/stream", async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token as string | undefined;

    if (!token) {
      res.status(401).json({ error: "Missing session token" });
      return;
    }

    const session = await getResearchSession(id, token);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    await runResearchStream(session, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
});
