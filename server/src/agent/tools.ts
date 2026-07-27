import { tool } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/paths.js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export function createTools(userId: string) {
  return {
    read_files: tool({
      description: "Read one or more files from the resume project directory. Returns content for each file.",
      inputSchema: z.object({
        paths: z.array(z.string()).describe("Relative paths to the files to read"),
      }),
      execute: async ({ paths: relativePaths }) => {
        const results: Record<string, string> = {};
        for (const relativePath of relativePaths) {
          try {
            const absPath = resolvePath(relativePath, userId);
            results[relativePath] = await fs.readFile(absPath, "utf-8");
          } catch (err) {
            results[relativePath] = `Error reading ${relativePath}: ${err instanceof Error ? err.message : "Unknown error"}`;
          }
        }
        return results;
      },
    }),
    write_file: tool({
      description:
        "Write content to a file in the resume project directory. Creates parent directories if they don't exist.",
      inputSchema: z.object({
        path: z.string().describe("Relative path where the file should be written"),
        content: z.string().describe("Content to write to the file"),
      }),
      execute: async ({ path: relativePath, content }) => {
        try {
          const absPath = resolvePath(relativePath, userId);
          await fs.mkdir(path.dirname(absPath), { recursive: true });
          await fs.writeFile(absPath, content, "utf-8");
          return `File written: ${relativePath} (${content.length} chars)`;
        } catch (err) {
          return `Error writing ${relativePath}: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
    list_dir: tool({
      description: "List files and directories at a given path",
      inputSchema: z.object({
        path: z.string().describe("Relative path to the directory to list"),
      }),
      execute: async ({ path: relativePath }) => {
        try {
          const absPath = resolvePath(relativePath, userId);
          const entries = await fs.readdir(absPath, { withFileTypes: true });
          return entries.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? "dir" : "file",
          }));
        } catch (err) {
          return `Error listing ${relativePath}: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
    web_fetch: tool({
      description: "Fetch a web page and return its main text content",
      inputSchema: z.object({
        url: z.string().describe("The URL to fetch"),
      }),
      execute: async ({ url }) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            return `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
          }
          const html = await response.text();
          const dom = new JSDOM(html, { url });
          const reader = new Readability(dom.window.document);
          const article = reader.parse();
          return article?.textContent || "Could not extract meaningful content from this page.";
        } catch (err) {
          return `Error fetching ${url}: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
  };
}
