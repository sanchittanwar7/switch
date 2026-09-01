import { Router } from "express";
import {
  and,
  eq,
  gte,
  ilike,
  asc,
  desc,
  sql,
  arrayOverlaps,
  type SQL,
} from "drizzle-orm";
import { db } from "../db";
import { boardListings, boardPayments } from "../db/schema";
import { contentHash } from "../lib/board-url";

const router = Router();

type Kind = "candidate" | "recruiter";
type Window = "all" | "today";

const KINDS: Kind[] = ["candidate", "recruiter"];
const WINDOWS: Window[] = ["all", "today"];

function todayUtcStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isHttpUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function cleanInteger(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function toListingDto(row: typeof boardListings.$inferSelect, bidPaise: number, rank: number) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    rank,
    bidPaise,
    company: row.company,
    resumeUrl: row.resumeUrl,
    linkedinUrl: row.linkedinUrl,
    xUrl: row.xUrl,
    githubUrl: row.githubUrl,
    yearsExperience: row.yearsExperience,
    locations: row.locations,
    skills: row.skills,
    jdUrl: row.jdUrl,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    currency: row.currency,
    role: row.role,
    yearsExperienceMin: row.yearsExperienceMin,
    yearsExperienceMax: row.yearsExperienceMax,
    createdAt: row.createdAt.toISOString(),
  };
}

function bidExpr(window: Window) {
  return sql<number>`coalesce(sum(${boardPayments.amountPaise}), 0)`.mapWith(Number);
}

function paymentJoin(window: Window): SQL | undefined {
  const base = and(
    eq(boardPayments.listingId, boardListings.id),
    eq(boardPayments.status, "captured"),
  );
  if (window === "today") {
    return and(base, gte(boardPayments.capturedAt, todayUtcStart()));
  }
  return base;
}

// ─── GET /listings ───────────────────────────────────────────────────────────

router.get("/listings", async (req, res) => {
  try {
    const { kind, window: rawWindow, skills, location, yearsExperience, role } = req.query;

    if (typeof kind !== "string" || !KINDS.includes(kind as Kind)) {
      res.status(400).json({ error: "kind must be 'candidate' or 'recruiter'" });
      return;
    }

    const window: Window =
      typeof rawWindow === "string" && WINDOWS.includes(rawWindow as Window)
        ? (rawWindow as Window)
        : "all";

    const conditions: SQL[] = [
      eq(boardListings.kind, kind),
      eq(boardListings.status, "active"),
    ];

    if (typeof skills === "string" && skills.trim()) {
      const skillsArr = skills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (skillsArr.length > 0) {
        conditions.push(arrayOverlaps(boardListings.skills, skillsArr));
      }
    }

    if (typeof location === "string" && location.trim()) {
      const q = location.trim().toLowerCase();
      conditions.push(
        sql`exists (select 1 from unnest(${boardListings.locations}) as x where lower(x) like ${`%${q}%`})`,
      );
    }

    if (kind === "candidate" && typeof yearsExperience === "string" && yearsExperience.trim()) {
      const minYears = cleanInteger(yearsExperience);
      if (minYears !== null && minYears >= 0) {
        conditions.push(gte(boardListings.yearsExperience, minYears));
      }
    }

    if (kind === "recruiter" && typeof role === "string" && role.trim()) {
      conditions.push(ilike(boardListings.role, `%${role.trim()}%`));
    }

    const bid = bidExpr(window);

    const rows = await db
      .select({
        listing: boardListings,
        bid,
      })
      .from(boardListings)
      .leftJoin(boardPayments, paymentJoin(window))
      .where(and(...conditions))
      .groupBy(boardListings.id)
      .orderBy(desc(bid), asc(boardListings.createdAt));

    const listings = rows.map((r, i) => toListingDto(r.listing, r.bid, i + 1));

    res.json({ kind, window, listings });
  } catch (err) {
    console.error("GET /api/board/listings:", err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

// ─── POST /listings ──────────────────────────────────────────────────────────

router.post("/listings", async (req, res) => {
  try {
    const body = req.body ?? {};
    const kind = body.kind;

    if (kind !== "candidate" && kind !== "recruiter") {
      res.status(400).json({ error: "kind must be 'candidate' or 'recruiter'" });
      return;
    }

    const skills = cleanStringArray(body.skills)
      .slice(0, 5)
      .map((s) => s.toLowerCase());
    const locations = cleanStringArray(body.locations);

    let identityUrl: string | null = null;

    const values: Partial<typeof boardListings.$inferInsert> = {
      kind,
      status: "pending_payment",
      skills,
      locations,
    };

    if (kind === "candidate") {
      const linkedinUrl = cleanString(body.linkedinUrl);
      if (!linkedinUrl || !isHttpUrl(linkedinUrl)) {
        res.status(400).json({ error: "linkedin_url is required and must be a valid http(s) URL" });
        return;
      }
      identityUrl = linkedinUrl;

      const company = cleanString(body.company);
      const resumeUrl = cleanString(body.resumeUrl);
      const xUrl = cleanString(body.xUrl);
      const githubUrl = cleanString(body.githubUrl);
      const yearsExperience = cleanInteger(body.yearsExperience);

      if (resumeUrl && !isHttpUrl(resumeUrl)) {
        res.status(400).json({ error: "resume_url must be a valid http(s) URL" });
        return;
      }
      if (xUrl && !isHttpUrl(xUrl)) {
        res.status(400).json({ error: "x_url must be a valid http(s) URL" });
        return;
      }
      if (githubUrl && !isHttpUrl(githubUrl)) {
        res.status(400).json({ error: "github_url must be a valid http(s) URL" });
        return;
      }
      if (yearsExperience !== null && yearsExperience < 0) {
        res.status(400).json({ error: "years_experience must be a non-negative integer" });
        return;
      }

      values.linkedinUrl = linkedinUrl;
      values.company = company;
      values.resumeUrl = resumeUrl;
      values.xUrl = xUrl;
      values.githubUrl = githubUrl;
      values.yearsExperience = yearsExperience;
    } else {
      const jdUrl = cleanString(body.jdUrl);
      if (!jdUrl || !isHttpUrl(jdUrl)) {
        res.status(400).json({ error: "jd_url is required and must be a valid http(s) URL" });
        return;
      }
      identityUrl = jdUrl;

      const company = cleanString(body.company);
      const role = cleanString(body.role);
      const currency = cleanString(body.currency) ?? "INR";
      const salaryMin = cleanInteger(body.salaryMin);
      const salaryMax = cleanInteger(body.salaryMax);
      const yearsExperienceMin = cleanInteger(body.yearsExperienceMin);
      const yearsExperienceMax = cleanInteger(body.yearsExperienceMax);

      if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
        res.status(400).json({ error: "salary_min must be <= salary_max" });
        return;
      }
      if (
        yearsExperienceMin !== null &&
        yearsExperienceMax !== null &&
        yearsExperienceMin > yearsExperienceMax
      ) {
        res.status(400).json({ error: "years_experience_min must be <= years_experience_max" });
        return;
      }

      values.jdUrl = jdUrl;
      values.company = company;
      values.role = role;
      values.currency = currency;
      values.salaryMin = salaryMin;
      values.salaryMax = salaryMax;
      values.yearsExperienceMin = yearsExperienceMin;
      values.yearsExperienceMax = yearsExperienceMax;
    }

    const hash = contentHash(identityUrl!);
    if (!hash) {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    const [existing] = await db
      .select()
      .from(boardListings)
      .where(eq(boardListings.contentHash, hash));

    if (existing) {
      const { bidPaise, rank } = await getListingRank(existing.id, kind);
      res.json({ listing: toListingDto(existing, bidPaise, rank), alreadyListed: true });
      return;
    }

    const [created] = await db
      .insert(boardListings)
      .values({ ...values, contentHash: hash } as typeof boardListings.$inferInsert)
      .returning();

    res.status(201).json({ listing: toListingDto(created, 0, 0), alreadyListed: false });
  } catch (err) {
    console.error("POST /api/board/listings:", err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

async function getListingRank(listingId: string, kind: string): Promise<{ bidPaise: number; rank: number }> {
  const bid = bidExpr("all");
  const rows = await db
    .select({ id: boardListings.id, bid })
    .from(boardListings)
    .leftJoin(boardPayments, paymentJoin("all"))
    .where(and(eq(boardListings.kind, kind), eq(boardListings.status, "active")))
    .groupBy(boardListings.id)
    .orderBy(desc(bid), asc(boardListings.createdAt));

  const index = rows.findIndex((r) => r.id === listingId);
  if (index === -1) {
    const [row] = await db
      .select({ bid })
      .from(boardListings)
      .leftJoin(boardPayments, paymentJoin("all"))
      .where(eq(boardListings.id, listingId))
      .groupBy(boardListings.id);
    return { bidPaise: row?.bid ?? 0, rank: 0 };
  }

  return { bidPaise: rows[index].bid, rank: index + 1 };
}

export default router;
