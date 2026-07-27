import express from "express";
import cors from "cors";
import { initializeDatabase } from "./workspace";
import { authMiddleware } from "./middleware/auth";
import { resolvePath } from "./utils/paths";
import fs from "fs/promises";
import authRoutes from "./routes/auth";
import fsRoutes from "./routes/fs";
import kanbanRoutes from "./routes/kanban";
import latexRoutes from "./routes/latex";
import agentRoutes, { streamRouter } from "./agent/routes";
import settingsRoutes from "./routes/settings";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/fs", authMiddleware, fsRoutes);
app.use("/api/kanban", authMiddleware, kanbanRoutes);
app.use("/api/latex", authMiddleware, latexRoutes);
app.use("/api/agent", streamRouter);
app.use("/api/agent", authMiddleware, agentRoutes);
app.use("/api/settings", authMiddleware, settingsRoutes);

app.use("/pdfs", authMiddleware, async (req, res) => {
  const userId = (req as any).userId!;
  const relativePath = req.path.replace(/^\//, "");
  const absPath = resolvePath(relativePath, userId);

  if (!absPath.endsWith(".pdf")) {
    res.status(400).json({ error: "Only PDF files can be served" });
    return;
  }

  try {
    await fs.stat(absPath);
  } catch {
    res.status(404).json({ error: "PDF file not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.sendFile(absPath, { dotfiles: "allow" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});

async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
