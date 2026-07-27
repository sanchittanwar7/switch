import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/paths.js";

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
    await fs.rm(absPath, { recursive: true });
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

router.post("/copy", async (req, res) => {
  const userId = getUserId(req);
  const { sourcePath, destPath } = req.body;

  if (!sourcePath || !destPath) {
    res.status(400).json({ error: "Missing required fields: sourcePath, destPath" });
    return;
  }

  const absSrc = resolvePath(sourcePath, userId);
  const absDest = resolvePath(destPath, userId);
  await fs.cp(absSrc, absDest, { recursive: true });
  res.json({ success: true });
});

router.get("/resumes", async (req, res) => {
  const userId = getUserId(req);
  const resumesDir = resolvePath("resumes", userId);

  try {
    const entries = await fs.readdir(resumesDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    const result = await Promise.all(
      dirs.map(async (e) => {
        const fullPath = path.join(resumesDir, e.name);
        const stat = await fs.stat(fullPath);
        return { name: e.name, mtime: stat.mtime.toISOString() };
      }),
    );
    result.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
    res.json(result);
  } catch {
    res.json([]);
  }
});

export default router;
