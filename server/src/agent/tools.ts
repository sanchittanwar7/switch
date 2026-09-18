import { tool } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { resolvePath } from "../utils/paths";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { db } from "../db";
import { applications } from "../db/schema";
import { eq, and, asc } from "drizzle-orm";
import { isTypeSafeConfigured, describeTypeSafeError } from "../lib/typesafe";
import { loadCandidateProfile, isProfileEmpty } from "./profile-loader";
import {
  scoreRolesForCandidate,
  buildTopRoles,
  summarizeTopRoles,
  type OpenRole,
} from "./relevance-scorer";

export function createTools(userId: string, workspaceSubPath?: string) {
  const resolve = (relativePath: string) =>
    resolvePath(workspaceSubPath ? path.join(workspaceSubPath, relativePath) : relativePath, userId);

  return {
    read_files: tool({
      description: "Read one or more files from the workspace directory. Returns content for each file.",
      inputSchema: z.object({
        paths: z.array(z.string()).describe("Relative paths to the files to read"),
      }),
      execute: async ({ paths: relativePaths }) => {
        const results: Record<string, string> = {};
        for (const relativePath of relativePaths) {
          try {
            const absPath = resolve(relativePath);
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
        "Write content to a file in the workspace directory. Creates parent directories if they don't exist.",
      inputSchema: z.object({
        path: z.string().describe("Relative path where the file should be written"),
        content: z.string().describe("Content to write to the file"),
      }),
      execute: async ({ path: relativePath, content }) => {
        try {
          const absPath = resolve(relativePath);
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
          const absPath = resolve(relativePath);
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
      description:
        "Fetch a URL and return its content. HTML pages are reduced to their main article text; " +
        "JSON APIs (e.g. Greenhouse/Lever/Ashby/SmartRecruiters job boards) are returned as raw JSON.",
      inputSchema: z.object({
        url: z.string().describe("The URL to fetch"),
      }),
      execute: async ({ url }) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            return `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
          }
          const contentType = response.headers.get("content-type") ?? "";
          const body = await response.text();
          if (contentType.includes("application/json") || contentType.includes("+json")) {
            return body;
          }
          const dom = new JSDOM(body, { url });
          const reader = new Readability(dom.window.document);
          const article = reader.parse();
          return article?.textContent || "Could not extract meaningful content from this page.";
        } catch (err) {
          return `Error fetching ${url}: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
    add_job_to_wishlist: tool({
      description:
        "Add a job to the user's wishlist on the jobs board. Use when the user provides job details with company, role, and optionally job URL and tags.",
      inputSchema: z.object({
        company: z.string().describe("Company name"),
        role: z.string().describe("Job role/title"),
        jobUrl: z.string().optional().describe("Job posting URL"),
        tags: z.array(z.string()).optional().describe("Tags for the wishlist card"),
      }),
      execute: async ({ company, role, jobUrl, tags }) => {
        try {
          const [maxPos] = await db
            .select({ max: applications.position })
            .from(applications)
            .where(and(eq(applications.columnId, "wishlist"), eq(applications.userId, userId)))
            .orderBy(asc(applications.position));

          const nextPosition = (maxPos?.max ?? -1) + 1;

          const [created] = await db
            .insert(applications)
            .values({
              userId,
              company,
              role,
              jobUrl: jobUrl?.trim() || null,
              tags: Array.isArray(tags) ? tags : [],
              columnId: "wishlist",
              position: nextPosition,
            })
            .returning();

          return `Job added to wishlist: ${company} - ${role} (id: ${created.id})`;
        } catch (err) {
          return `Error adding job to wishlist: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
    rank_open_roles: tool({
      description:
        "Rank the company's open roles by how relevant the user's profile is to each role. " +
        "Pass every role you found (with its JD text) and get back the top 5 ranked by relevance, " +
        "formatted as a Markdown list. Use this after collecting the company's open roles from its " +
        "ATS JSON API (or from search results if no ATS resolves).",
      inputSchema: z.object({
        jobs: z
          .array(
            z.object({
              title: z.string().describe("Role title"),
              location: z.string().optional().describe("Role location, e.g. 'Remote'"),
              url: z.string().optional().describe("Link to the job posting"),
              description: z.string().describe("The job description text"),
            }),
          )
          .min(1)
          .max(25)
          .describe("Open roles with their job descriptions"),
      }),
      execute: async ({ jobs }) => {
        if (!isTypeSafeConfigured()) {
          return "TypeSafe AI is not configured. Set TYPESAFE_API_KEY in server/.env.";
        }

        const profile = await loadCandidateProfile(userId);
        if (isProfileEmpty(profile)) {
          return "Your profile is empty. Add location, work experience, skills, and projects in Profile first.";
        }

        try {
          const roles: OpenRole[] = jobs.map((j, i) => ({
            id: `job_${i}`,
            title: j.title,
            location: j.location,
            url: j.url,
            description: j.description,
          }));
          const ranked = await scoreRolesForCandidate(profile, roles);
          const top = buildTopRoles(ranked, 5);
          return summarizeTopRoles(top);
        } catch (err) {
          return `Could not rank roles: ${describeTypeSafeError(err)}`;
        }
      },
    }),
  };
}
