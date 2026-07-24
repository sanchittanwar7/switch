import { Router } from "express";
import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/paths";

const router = Router();

function getUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): string {
  return (req as any).userId!;
}

async function findMainTex(projectDir: string): Promise<string | null> {
  const entries = await fs.readdir(projectDir, { withFileTypes: true });
  const texFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".tex"))
    .map((e) => e.name);

  if (texFiles.length === 0) return null;
  if (texFiles.includes("main.tex")) return "main.tex";

  for (const f of texFiles) {
    const content = await fs.readFile(path.join(projectDir, f), "utf-8");
    if (/\\documentclass/.test(content)) return f;
  }

  return texFiles[0];
}

interface LaTeXError {
  line: number;
  message: string;
}

function parseLogErrors(logText: string): LaTeXError[] {
  const errors: LaTeXError[] = [];
  const errorRegex = /^!(.*)$\n^(l\.(\d+)\s.*)$/gm;
  let match;

  while ((match = errorRegex.exec(logText)) !== null) {
    const message = match[1].trim();
    const line = parseInt(match[3], 10);
    errors.push({ line, message });
  }

  return errors;
}

function runPdflatex(projectDir: string, mainFile: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile("pdflatex", [
      "-interaction=nonstopmode",
      "-output-directory=" + projectDir,
      mainFile,
    ], { cwd: projectDir, timeout: 30000 }, (error, stdout, stderr) => {
      if (error && !stdout.includes("output written")) {
        const logPath = path.join(projectDir, mainFile.replace(/\.tex$/, ".log"));
        fs.readFile(logPath, "utf-8")
          .then((logContent) => {
            const parsed = parseLogErrors(logContent);
            reject({ message: error.message, stdout, errors: parsed });
          })
          .catch(() => reject({ message: error.message, stdout, errors: [] }));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

router.post("/compile", async (req, res) => {
  const userId = getUserId(req);
  const { projectPath } = req.body as { projectPath?: string };

  if (!projectPath) {
    res.status(400).json({ error: "Missing required field: projectPath" });
    return;
  }

  const absProjectDir = resolvePath(projectPath, userId);

  let stat;
  try {
    stat = await fs.stat(absProjectDir);
  } catch {
    res.status(404).json({ error: "Project directory not found" });
    return;
  }

  if (!stat.isDirectory()) {
    res.status(400).json({ error: "projectPath must be a directory" });
    return;
  }

  const mainFile = await findMainTex(absProjectDir);
  if (!mainFile) {
    res.status(400).json({ error: "No .tex file found in project directory" });
    return;
  }

  const pdfName = mainFile.replace(/\.tex$/, ".pdf");
  const pdfPath = path.join(projectPath, pdfName);

  try {
    await runPdflatex(absProjectDir, mainFile);
    await runPdflatex(absProjectDir, mainFile);

    const logPath = path.join(absProjectDir, mainFile.replace(/\.tex$/, ".log"));
    let logContent = "";
    try {
      logContent = await fs.readFile(logPath, "utf-8");
    } catch {
    }

    const errors = parseLogErrors(logContent);
    const hasFatal = /Fatal error/i.test(logContent);

    if (hasFatal || errors.length > 0) {
      res.json({ success: false, pdfPath, errors });
      return;
    }

    const pdfExists = await fs.stat(resolvePath(pdfPath, userId)).catch(() => null);
    res.json({
      success: pdfExists !== null,
      pdfPath,
      errors: [],
    });
  } catch (err: any) {
    const errors = err.errors || [];
    res.json({ success: false, pdfPath, errors });
  }
});

router.get("/download", async (req, res) => {
  const userId = getUserId(req);
  const filePath = typeof req.query.path === "string" ? req.query.path : "";

  if (!filePath) {
    res.status(400).json({ error: "Missing required query param: path" });
    return;
  }

  const absPath = resolvePath(filePath, userId);

  if (!absPath.endsWith(".pdf")) {
    res.status(400).json({ error: "Only PDF files can be downloaded" });
    return;
  }

  let stat;
  try {
    stat = await fs.stat(absPath);
  } catch {
    res.status(404).json({ error: "PDF file not found" });
    return;
  }

  const basename = path.basename(absPath);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${basename}"`);
  res.sendFile(absPath);
});

export default router;
