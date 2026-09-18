import { score, type EntryType } from "@typesafe-ai/sdk";
import { getTypeSafeClient } from "../lib/typesafe";
import type { CandidateProfile } from "./profile-loader";

export const RUBRIC = [
  "No overlap: the candidate's skills, domain, and seniority are entirely different from what the role requires.",
  "Weak match: the candidate has only a few tangential skills or an adjacent domain, and none of the role's core requirements.",
  "Partial match: the candidate meets some core skills or has adjacent experience but is missing key requirements or the right seniority.",
  "Reasonable match: the candidate meets most core skills and has relevant experience, with a few gaps that are learnable.",
  "Strong match: the candidate meets the core skills and experience, with only minor gaps in nice-to-haves.",
  "Excellent match: the candidate meets or exceeds requirements across skills, experience, and domain.",
] as const;

export interface OpenRole {
  id: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  description: string;
}

export interface RankedRole {
  rank: number;
  title: string;
  location: string | null;
  url: string | null;
  score: number;
  normalizedScore: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend: Record<string, string>;
}

export interface RelevanceResult {
  ranked: RankedRole[];
  totalScored: number;
  rubric: string[];
}

const MAX_DESCRIPTION_CHARS = 4000;

function truncate(role: OpenRole): OpenRole {
  if (role.description.length <= MAX_DESCRIPTION_CHARS) return role;
  return { ...role, description: role.description.slice(0, MAX_DESCRIPTION_CHARS) };
}

function buildQuestions(roles: OpenRole[]) {
  const questions: Record<string, ReturnType<typeof score>> = {};
  roles.forEach((_, i) => {
    questions[`job_${i}`] = score(
      `How relevant is the candidate's profile to the job described in \`jobs[${i}]\`? ` +
        `Consider required skills, seniority, domain, and (when stated) the role's location ` +
        `against the candidate's location preference.`,
      RUBRIC,
    );
  });
  return questions;
}

export async function scoreRolesForCandidate(
  profile: CandidateProfile,
  roles: OpenRole[],
): Promise<RankedRole[]> {
  if (roles.length === 0) return [];

  const trimmed = roles.map(truncate);
  const client = getTypeSafeClient();

  const response = await client.systemOne({
    state: {
      candidate: profile,
      jobs: trimmed.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company ?? null,
        location: r.location ?? null,
        url: r.url ?? null,
        description: r.description,
      })),
    } as unknown as EntryType,
    questions: buildQuestions(trimmed),
  });

  const maxLevel = RUBRIC.length - 1;

  const ranked: RankedRole[] = trimmed.map((role, i) => {
    const answer = response.answers[`job_${i}`];
    return {
      rank: 0,
      title: role.title,
      location: role.location ?? null,
      url: role.url ?? null,
      score: answer.score,
      normalizedScore: answer.score / maxLevel,
      confidence: answer.confidence,
      probabilities: answer.probabilities as unknown as Record<string, number>,
      legend: answer.legend as unknown as Record<string, string>,
    };
  });

  ranked.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  return ranked;
}

export function buildTopRoles(ranked: RankedRole[], k = 5): RankedRole[] {
  return ranked.slice(0, k);
}

export function summarizeTopRoles(top: RankedRole[]): string {
  if (top.length === 0) return "No matching roles found.";
  const lines = top.map((r) => {
    const pct = Math.round(r.normalizedScore * 100);
    const loc = r.location ? ` — ${r.location}` : "";
    const link = r.url ? ` — ${r.url}` : "";
    return `${r.rank}. **${r.title}**${loc} — ${pct}% match${link}`;
  });
  return `**Top matching roles:**\n\n${lines.join("\n")}`;
}
