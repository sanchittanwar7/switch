import express from "express";
import cors from "cors";
import { initializeDatabase } from "./workspace";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import fsRoutes from "./routes/fs";
import kanbanRoutes from "./routes/kanban";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/fs", authMiddleware, fsRoutes);
app.use("/api/kanban", authMiddleware, kanbanRoutes);

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
