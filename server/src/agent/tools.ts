import { tool } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/paths";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export function createTools(userId: string) {
  return {
    read_file: tool({
      description: "Read a file from the resume project directory",
      inputSchema: z.object({
        path: z.string().describe("Relative path to the file to read"),
      }),
      execute: async ({ path: relativePath }) => {
        const absPath = resolvePath(relativePath, userId);
        return await fs.readFile(absPath, "utf-8");
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
        const absPath = resolvePath(relativePath, userId);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, content, "utf-8");
        return `File written: ${relativePath} (${content.length} chars)`;
      },
    }),
    list_dir: tool({
      description: "List files and directories at a given path",
      inputSchema: z.object({
        path: z.string().describe("Relative path to the directory to list"),
      }),
      execute: async ({ path: relativePath }) => {
        const absPath = resolvePath(relativePath, userId);
        const entries = await fs.readdir(absPath, { withFileTypes: true });
        return entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "dir" : "file",
        }));
      },
    }),
    web_fetch: tool({
      description: "Fetch a web page and return its main text content",
      inputSchema: z.object({
        url: z.string().describe("The URL to fetch"),
      }),
      execute: async ({ url }) => {
        const response = await fetch(url);
        if (!response.ok) {
          return `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
        }
        const html = await response.text();
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        return article?.textContent || "Could not extract meaningful content from this page.";
      },
    }),
  };
}
