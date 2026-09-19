import { tool } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot, resolvePath } from "../utils/paths";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { tavily } from "@tavily/core";
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

const MAX_ROLES = 250;
const MAX_ATS_RESULT_CHARS = 200_000;
const ROLE_SOURCE_MEMORY_FILE = "company-role-sources.json";
const LEGACY_ROLE_SOURCE_MEMORY_FILE = "memory.md";
const ROLE_SOURCE_ROW = /^\|\s*(.*?)\s*\|\s*(https?:\/\/[^|]+?)\s*\|\s*$/i;

let roleSourceMemoryLock = Promise.resolve();

type RoleSourceMemory = Record<string, { company: string; url: string; updatedAt: string }>;

function normalizeCompanyName(company: string): string {
  return company.replace(/[|\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

function getRoleSourceMemoryPath(): string {
  return path.join(getWorkspaceRoot(), ROLE_SOURCE_MEMORY_FILE);
}

function getLegacyRoleSourceMemoryPath(): string {
  return path.join(getWorkspaceRoot(), LEGACY_ROLE_SOURCE_MEMORY_FILE);
}

function getCompanyKey(company: string): string {
  return normalizeCompanyName(company).toLocaleLowerCase();
}

async function withRoleSourceMemoryLock<T>(action: () => Promise<T>): Promise<T> {
  const previous = roleSourceMemoryLock;
  let release!: () => void;
  roleSourceMemoryLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await action();
  } finally {
    release();
  }
}

function parseRoleSourceMemory(content: string): RoleSourceMemory {
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Global company role-source memory must be a JSON object");
  }

  const memory: RoleSourceMemory = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("company" in entry) ||
      !("url" in entry) ||
      !("updatedAt" in entry) ||
      typeof entry.company !== "string" ||
      typeof entry.url !== "string" ||
      typeof entry.updatedAt !== "string"
    ) {
      throw new Error(`Invalid global company role-source memory entry: ${key}`);
    }
    memory[key] = entry;
  }
  return memory;
}

async function readRoleSourceMemory(): Promise<RoleSourceMemory> {
  try {
    return parseRoleSourceMemory(await fs.readFile(getRoleSourceMemoryPath(), "utf-8"));
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) {
      throw err;
    }

    try {
      const legacyContent = await fs.readFile(getLegacyRoleSourceMemoryPath(), "utf-8");
      const memory: RoleSourceMemory = {};
      for (const line of legacyContent.split("\n")) {
        const match = line.match(ROLE_SOURCE_ROW);
        if (!match) continue;
        const company = normalizeCompanyName(match[1]);
        if (!company) continue;
        memory[getCompanyKey(company)] = {
          company,
          url: match[2].trim(),
          updatedAt: new Date().toISOString(),
        };
      }
      await writeRoleSourceMemory(memory);
      await fs.unlink(getLegacyRoleSourceMemoryPath());
      return memory;
    } catch (legacyErr) {
      if (legacyErr instanceof Error && "code" in legacyErr && legacyErr.code === "ENOENT") {
        const memory: RoleSourceMemory = {};
        await writeRoleSourceMemory(memory);
        return memory;
      }
      throw legacyErr;
    }
  }
}

async function writeRoleSourceMemory(memory: RoleSourceMemory): Promise<void> {
  const memoryPath = getRoleSourceMemoryPath();
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  const tempPath = `${memoryPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(memory, null, 2)}\n`, "utf-8");
  await fs.rename(tempPath, memoryPath);
}

async function updateRoleSourceMemory(
  company: string,
  url?: string,
): Promise<{ action: "added" | "updated" | "removed" | "not_found"; company: string }> {
  const normalizedCompany = normalizeCompanyName(company);
  if (!normalizedCompany) {
    throw new Error("Company name is required");
  }

  return withRoleSourceMemoryLock(async () => {
    const memory = await readRoleSourceMemory();
    const key = getCompanyKey(normalizedCompany);

    if (!url) {
      if (!memory[key]) {
        return { action: "not_found", company: normalizedCompany };
      }
      delete memory[key];
      await writeRoleSourceMemory(memory);
      return { action: "removed", company: normalizedCompany };
    }

    const action = memory[key] ? "updated" : "added";
    memory[key] = { company: normalizedCompany, url, updatedAt: new Date().toISOString() };
    await writeRoleSourceMemory(memory);
    return { action, company: normalizedCompany };
  });
}

function getAtsJsonApi(sourceUrl: string): { provider: string; url: string } | null {
  const source = new URL(sourceUrl);
  const host = source.hostname.toLowerCase();
  const pathParts = source.pathname.split("/").filter(Boolean);

  if (host === "jobs.ashbyhq.com" && pathParts[0]) {
    return {
      provider: "Ashby",
      url: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(pathParts[0])}`,
    };
  }

  if (host === "boards.greenhouse.io" && pathParts[0]) {
    return {
      provider: "Greenhouse",
      url: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(pathParts[0])}/jobs`,
    };
  }

  if (host === "jobs.lever.co" && pathParts[0]) {
    return {
      provider: "Lever",
      url: `https://api.lever.co/v0/postings/${encodeURIComponent(pathParts[0])}?mode=json`,
    };
  }

  if (host === "jobs.smartrecruiters.com" && pathParts[0]) {
    return {
      provider: "SmartRecruiters",
      url: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(pathParts[0])}/postings`,
    };
  }

  if (host.endsWith(".myworkdayjobs.com") && pathParts[1]) {
    const company = host.split(".")[0];
    return {
      provider: "Workday",
      url: `https://${source.hostname}/wday/cxs/${encodeURIComponent(company)}/${encodeURIComponent(pathParts[1])}/jobs`,
    };
  }

  return null;
}

export function createTools(userId: string, workspaceSubPath?: string) {
  const resolve = (relativePath: string) =>
    resolvePath(workspaceSubPath ? path.join(workspaceSubPath, relativePath) : relativePath, userId);

  return {
    read_company_role_sources: tool({
      description:
        "Read shared global company-role-sources.json containing reliable company careers and ATS URLs. " +
        "Use after web discovery to corroborate or refresh a verified official role source; entries are available to every user.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return JSON.stringify(await withRoleSourceMemoryLock(readRoleSourceMemory), null, 2);
        } catch (err) {
          return `Error reading global company role-source memory: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
    save_company_role_source: tool({
      description:
        "Save a verified, reliable official careers or ATS URL for a company in shared global company-role-sources.json. " +
        "Replaces any existing URL for that company, so use after finding a new source or refreshing a stale one.",
      inputSchema: z.object({
        company: z.string().describe("Company name"),
        url: z
          .string()
          .url()
          .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "URL must use HTTP(S)")
          .describe("Verified official careers page or ATS endpoint URL"),
      }),
      execute: async ({ company, url }) => {
        try {
          const result = await updateRoleSourceMemory(company, url);
          return `Global company role-source memory ${result.action}: ${result.company} -> ${url}`;
        } catch (err) {
          return `Error saving global company role-source memory: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
    remove_company_role_source: tool({
      description:
        "Remove a stale or invalid company careers or ATS URL from shared global company-role-sources.json. " +
        "Call as soon as a cached URL is stale; save a replacement separately if you find one.",
      inputSchema: z.object({
        company: z.string().describe("Company name"),
      }),
      execute: async ({ company }) => {
        try {
          const result = await updateRoleSourceMemory(company);
          return `Global company role-source memory ${result.action}: ${result.company}`;
        } catch (err) {
          return `Error removing global company role-source memory: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
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
        "JSON APIs are returned as raw JSON. Do not use this for a recognized hosted ATS board; use fetch_ats_jobs instead.",
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
    fetch_ats_jobs: tool({
      description:
        "Fetch raw job JSON from a recognized hosted ATS using a board URL discovered through web_search or supplied by the user. " +
        "Derives a documented API endpoint from that exact URL; it never guesses an ATS vendor, company slug, or board name. " +
        "Use instead of web_fetch for Ashby, Greenhouse, Lever, SmartRecruiters, and Workday board URLs.",
      inputSchema: z.object({
        sourceUrl: z.string().url().describe("Discovered hosted ATS board or job URL"),
      }),
      execute: async ({ sourceUrl }) => {
        try {
          const api = getAtsJsonApi(sourceUrl);
          if (!api) {
            return "Unsupported ATS URL. Fetch the discovered page directly and follow its official job links.";
          }

          const response = await fetch(api.url);
          if (!response.ok) {
            return `Failed to fetch ${api.provider} JSON API: HTTP ${response.status} ${response.statusText}`;
          }

          const body = await response.text();
          if (body.length > MAX_ATS_RESULT_CHARS) {
            return `Too many open roles to process automatically: the ${api.provider} response is ${body.length.toLocaleString()} characters, exceeding the ${MAX_ATS_RESULT_CHARS.toLocaleString()}-character limit. Please share hand-picked job URLs or job-description content, and I will fetch and rank those roles against your profile.`;
          }

          return `${api.provider} JSON API: ${api.url}\n\n${body}`;
        } catch (err) {
          return `Error fetching ATS jobs: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    }),
    web_search: tool({
      description:
        "Search the web with Tavily and return the top results (title, URL, snippet). " +
        "Use focused, high-coverage queries to discover sources, then fetch relevant result URLs before reporting facts.",
      inputSchema: z.object({
        query: z.string().max(400).describe("The search query"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Max results to return (default 10)"),
      }),
      execute: async ({ query, maxResults = 10 }) => {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          return "Web search is unavailable. Set TAVILY_API_KEY in server/.env.";
        }

        try {
          const response = await tavily({ apiKey }).search(query, {
            maxResults,
            searchDepth: "basic",
          });
          if (response.results.length === 0) {
            return "No search results found.";
          }
          return response.results
            .map(
              (r, i) =>
                `${i + 1}. ${r.title}\n   ${r.url}${r.content ? `\n   ${r.content}` : ""}`,
            )
            .join("\n\n");
        } catch (err) {
          return `Error searching: ${err instanceof Error ? err.message : "Unknown error"}`;
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
    get_candidate_profile: tool({
      description:
        "Return the user's structured candidate profile: location preferences, work experience, skills, and projects. " +
        "Call before searching for open roles so the search query targets the user's relevant roles and locations.",
      inputSchema: z.object({}),
      execute: async () => JSON.stringify(await loadCandidateProfile(userId), null, 2),
    }),
    rank_open_roles: tool({
      description:
        "Rank the company's open roles by how relevant the user's profile is to each role. " +
        "Pass every role you found (with its JD text) and get back the top 5 ranked by relevance, " +
        "formatted as a Markdown list. Roles outside the user's preferred location are heavily down-ranked. " +
        "Pass at most 250 roles; if the company has more than 250 open roles, do NOT call this with all " +
        "of them — instead tell the user there are too many and ask for the URLs of the roles they care about. " +
        "Use this after collecting the company's open roles from its " +
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
          .describe("Open roles with their job descriptions"),
      }),
      execute: async ({ jobs }) => {
        if (!isTypeSafeConfigured()) {
          return "TypeSafe AI is not configured. Set TYPESAFE_API_KEY in server/.env.";
        }

        if (jobs.length > MAX_ROLES) {
          return `There are ${jobs.length} open roles, which is more than I can rank at once (max ${MAX_ROLES}). Please pick the roles you care about and send me their job posting URLs, and I'll fetch and rank just those.`;
        }

        const profile = await loadCandidateProfile(userId);
        if (isProfileEmpty(profile)) {
          return "Your profile is empty. Add location, work experience, skills, and projects in Profile first.";
        }

        const roles: OpenRole[] = jobs.map((j, i) => ({
          id: `job_${i}`,
          title: j.title,
          location: j.location,
          url: j.url,
          description: j.description,
        }));

        try {
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
