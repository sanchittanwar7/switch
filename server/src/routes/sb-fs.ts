import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { supabaseAdmin, STORAGE_BUCKET } from "../lib/supabase";
import { resolvePath } from "../utils/paths";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

function toStoragePath(userId: string, relativePath: string): string {
  return `${userId}/${relativePath}`;
}

function fromStoragePath(rawPath: string, userId: string): string {
  return rawPath.replace(`${userId}/`, "");
}

router.get("/list", async (req, res) => {
  const userId = getUserId(req);
  const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  const fullPrefix = prefix ? toStoragePath(userId, prefix) : `${userId}/`;
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .list(fullPrefix);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = (data || []).map((entry) => ({
    name: fromStoragePath(`${fullPrefix}${entry.name}`, userId),
    type: entry.metadata?.mimetype ? ("file" as const) : ("directory" as const),
  }));

  res.json(result);
});

router.get("/pull", async (req, res) => {
  const userId = getUserId(req);
  const file = typeof req.query.file === "string" ? req.query.file : "";

  if (!file) {
    res.status(400).json({ error: "Missing required query param: file" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  const storagePath = toStoragePath(userId, file);
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);

  if (error) {
    res.status(404).json({ error: error.message });
    return;
  }

  const content = await data.text();

  const localPath = resolvePath(file, userId);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, content, "utf-8");

  res.json({ content });
});

router.put("/push", async (req, res) => {
  const userId = getUserId(req);
  const { path: filePath, content } = req.body;

  if (!filePath || content === undefined) {
    res.status(400).json({ error: "Missing required fields: path, content" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  const storagePath = toStoragePath(userId, filePath);

  const localPath = resolvePath(filePath, userId);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, String(content), "utf-8");

  const blob = new Blob([String(content)], { type: "text/plain" });
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, { upsert: true, contentType: "text/plain" });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
});

router.delete("/delete", async (req, res) => {
  const userId = getUserId(req);
  const { path: filePath } = req.body;

  if (!filePath) {
    res.status(400).json({ error: "Missing required field: path" });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Supabase not configured" });
    return;
  }

  const storagePath = toStoragePath(userId, filePath);
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  try {
    const localPath = resolvePath(filePath, userId);
    await fs.rm(localPath, { force: true });
  } catch {}

  res.json({ success: true });
});

export default router;
