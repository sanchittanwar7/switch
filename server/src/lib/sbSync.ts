import fs from "fs/promises";
import path from "path";
import { supabaseAdmin, STORAGE_BUCKET } from "./supabase";
import { resolvePath } from "../utils/paths";

function toStoragePath(userId: string, relativePath: string): string {
  return `${userId}/${relativePath}`;
}

/**
 * Mirrors every file under a Supabase Storage prefix into the local
 * per-user workspace dir, so server-side tools (pdflatex) that only
 * know how to read local disk can operate on cloud-stored projects.
 */
export async function syncProjectFromSupabase(userId: string, projectPath: string): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error("Supabase not configured");
  }

  const prefix = projectPath.endsWith("/") ? projectPath : `${projectPath}/`;
  await downloadDir(userId, prefix);
}

async function downloadDir(userId: string, prefix: string): Promise<void> {
  const fullPrefix = toStoragePath(userId, prefix);
  const { data, error } = await supabaseAdmin!.storage.from(STORAGE_BUCKET).list(fullPrefix);

  if (error) {
    throw new Error(error.message);
  }

  for (const entry of data || []) {
    const isFile = !!entry.metadata?.mimetype;
    const entryRelPath = `${prefix}${entry.name}`;

    if (isFile) {
      const storagePath = toStoragePath(userId, entryRelPath);
      const { data: fileData, error: downloadError } = await supabaseAdmin!.storage
        .from(STORAGE_BUCKET)
        .download(storagePath);

      if (downloadError) {
        throw new Error(downloadError.message);
      }

      const content = await fileData.text();
      const localPath = resolvePath(entryRelPath, userId);
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, content, "utf-8");
    } else {
      await downloadDir(userId, `${entryRelPath}/`);
    }
  }
}
