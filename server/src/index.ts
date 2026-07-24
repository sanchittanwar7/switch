import express from "express";
import cors from "cors";
import { ensureWorkspace, initializeDatabase } from "./workspace";
import fsRoutes from "./routes/fs";
import kanbanRoutes from "./routes/kanban";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/fs", fsRoutes);
app.use("/api/kanban", kanbanRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal server error" });
});

async function start() {
  await ensureWorkspace();
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
