import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/paths";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

router.get("/list", async (req, res) => {
  const userId = getUserId(req);
  const dir = typeof req.query.dir === "string" ? req.query.dir : "";
  const absPath = resolvePath(dir, userId);

  const entries = await fs.readdir(absPath, { withFileTypes: true });
  const result = entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" as const : "file" as const,
  }));

  res.json(result);
});

router.get("/read", async (req, res) => {
  const userId = getUserId(req);
  const file = typeof req.query.file === "string" ? req.query.file : "";
  if (!file) {
    res.status(400).json({ error: "Missing required query param: file" });
    return;
  }

  const absPath = resolvePath(file, userId);
  const content = await fs.readFile(absPath, "utf-8");
  res.json({ content });
});

router.put("/write", async (req, res) => {
  const userId = getUserId(req);
  const { path: filePath, content } = req.body;

  if (!filePath || content === undefined) {
    res.status(400).json({ error: "Missing required fields: path, content" });
    return;
  }

  const absPath = resolvePath(filePath, userId);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, String(content), "utf-8");
  res.json({ success: true });
});

router.delete("/delete", async (req, res) => {
  const userId = getUserId(req);
  const { path: filePath } = req.body;

  if (!filePath) {
    res.status(400).json({ error: "Missing required field: path" });
    return;
  }

  const absPath = resolvePath(filePath, userId);
  const stat = await fs.stat(absPath);

  if (stat.isDirectory()) {
    await fs.rmdir(absPath);
  } else {
    await fs.rm(absPath);
  }

  res.json({ success: true });
});

router.post("/mkdir", async (req, res) => {
  const userId = getUserId(req);
  const { path: filePath } = req.body;

  if (!filePath) {
    res.status(400).json({ error: "Missing required field: path" });
    return;
  }

  const absPath = resolvePath(filePath, userId);
  await fs.mkdir(absPath, { recursive: true });
  res.json({ success: true });
});

router.post("/rename", async (req, res) => {
  const userId = getUserId(req);
  const { oldPath, newPath } = req.body;

  if (!oldPath || !newPath) {
    res.status(400).json({ error: "Missing required fields: oldPath, newPath" });
    return;
  }

  const absOld = resolvePath(oldPath, userId);
  const absNew = resolvePath(newPath, userId);
  await fs.rename(absOld, absNew);
  res.json({ success: true });
});

export default router;
