import { eq } from "drizzle-orm";
import { db } from "../db";
import { userProfiles, workExperiences, skills, projects } from "../db/schema";

export interface CandidateLocationPreference {
  city: string | null;
  country: string | null;
  isRemote: boolean;
}

export interface CandidateWorkExperience {
  company: string;
  role: string;
  teamName: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  skills: string[];
}

export interface CandidateSkill {
  name: string;
  expertise: "beginner" | "intermediate" | "expert";
}

export interface CandidateProject {
  title: string;
  description: string | null;
  github: string | null;
  url: string | null;
}

export interface CandidateProfile {
  locationPreference: CandidateLocationPreference | null;
  workExperience: CandidateWorkExperience[];
  skills: CandidateSkill[];
  projects: CandidateProject[];
}

export function isProfileEmpty(profile: CandidateProfile): boolean {
  return (
    profile.workExperience.length === 0 &&
    profile.skills.length === 0 &&
    profile.projects.length === 0
  );
}

export async function loadCandidateProfile(userId: string): Promise<CandidateProfile> {
  const [location] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  const experiences = await db
    .select()
    .from(workExperiences)
    .where(eq(workExperiences.userId, userId))
    .orderBy(workExperiences.position);

  const skillRows = await db
    .select()
    .from(skills)
    .where(eq(skills.userId, userId));

  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId));

  return {
    locationPreference: location
      ? {
          city: location.city,
          country: location.country,
          isRemote: location.isRemote,
        }
      : null,
    workExperience: experiences.map((e) => ({
      company: e.company,
      role: e.role,
      teamName: e.teamName,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      skills: e.skills ?? [],
    })),
    skills: skillRows.map((s) => ({
      name: s.name,
      expertise: s.expertise as "beginner" | "intermediate" | "expert",
    })),
    projects: projectRows.map((p) => ({
      title: p.title,
      description: p.description,
      github: p.github,
      url: p.url,
    })),
  };
}
