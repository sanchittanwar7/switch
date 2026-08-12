import { supabase } from "./supabase";
import type { Application, Interview, InterviewType, InterviewStatus, QuestionBankEntry, SharedQuestionEntry } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "";

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

async function getHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {
      /* use raw text */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { headers: await getHeaders() });
  return handleResponse<T>(res);
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(apiUrl(path), { headers: await getHeaders() });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error || text;
    } catch {
      /* use raw text */
    }
    throw new Error(message);
  }
  return res.blob();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: await getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "PATCH",
    headers: await getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "PUT",
    headers: await getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export async function apiDelete<T = { success: boolean }>(
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: await getHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res);
}

export function getApplication(id: string): Promise<Application & { interviews: Interview[]; columnTitle: string }> {
  return apiGet(`/api/applications/${id}`);
}

export function createInterview(
  appId: string,
  data: {
    type: InterviewType;
    status?: InterviewStatus;
    scheduledAt?: string;
    questionTitle?: string;
    feedback?: string;
    questionDetail?: string;
  },
): Promise<Interview> {
  return apiPost(`/api/applications/${appId}/interviews`, data);
}

export function updateInterview(
  appId: string,
  interviewId: string,
  data: Partial<Interview>,
): Promise<Interview> {
  return apiPatch(`/api/applications/${appId}/interviews/${interviewId}`, data);
}

export function deleteInterview(appId: string, interviewId: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/applications/${appId}/interviews/${interviewId}`);
}

export interface QuestionBankFilters {
  type?: string;
  company?: string;
  search?: string;
  status?: string;
}

export function getQuestions(filters?: QuestionBankFilters): Promise<{ interviews: QuestionBankEntry[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.company) params.set("company", filters.company);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.status) params.set("status", filters.status);
  return apiGet(`/api/questions?${params.toString()}`);
}

export interface SharedQuestionFilters {
  type?: string;
  company?: string;
  search?: string;
}

export function getSharedQuestions(filters?: SharedQuestionFilters): Promise<{ interviews: SharedQuestionEntry[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.company) params.set("company", filters.company);
  if (filters?.search) params.set("search", filters.search);
  return apiGet(`/api/questions/shared?${params.toString()}`);
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface ProfileLocation {
  city: string;
  country: string;
  isRemote: boolean;
}

export interface ProfileWorkExperience {
  id: string;
  company: string;
  role: string;
  teamName: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  skills: string[];
  position: number;
}

export interface ProfileProject {
  id: string;
  title: string;
  description: string;
  github: string;
  url: string;
}

export interface ProfileSkill {
  id: string;
  name: string;
  expertise: "beginner" | "intermediate" | "expert";
}

// Location
export async function getLocation() {
  return apiGet<ProfileLocation | null>("/api/profile/location");
}

export async function updateLocation(data: Partial<ProfileLocation>) {
  return apiPut<ProfileLocation>("/api/profile/location", data);
}

// Work Experiences
export async function getExperiences() {
  return apiGet<ProfileWorkExperience[]>("/api/profile/experiences");
}

export async function createExperience(data: Omit<ProfileWorkExperience, "id" | "position">) {
  return apiPost<ProfileWorkExperience>("/api/profile/experiences", data);
}

export async function updateExperience(id: string, data: Partial<Omit<ProfileWorkExperience, "id" | "position">>) {
  return apiPatch<ProfileWorkExperience>(`/api/profile/experiences/${id}`, data);
}

export async function deleteExperience(id: string) {
  return apiDelete(`/api/profile/experiences/${id}`);
}

export async function reorderExperiences(orderedIds: string[]) {
  return apiPut<ProfileWorkExperience[]>("/api/profile/experiences/reorder", { orderedIds });
}

// Projects
export async function getProjects() {
  return apiGet<ProfileProject[]>("/api/profile/projects");
}

export async function createProject(data: Omit<ProfileProject, "id">) {
  return apiPost<ProfileProject>("/api/profile/projects", data);
}

export async function updateProject(id: string, data: Partial<Omit<ProfileProject, "id">>) {
  return apiPatch<ProfileProject>(`/api/profile/projects/${id}`, data);
}

export async function deleteProject(id: string) {
  return apiDelete(`/api/profile/projects/${id}`);
}

// Skills
export async function getSkills() {
  return apiGet<ProfileSkill[]>("/api/profile/skills");
}

export async function createSkill(data: Omit<ProfileSkill, "id">) {
  return apiPost<ProfileSkill>("/api/profile/skills", data);
}

export async function updateSkill(id: string, data: Partial<Omit<ProfileSkill, "id">>) {
  return apiPatch<ProfileSkill>(`/api/profile/skills/${id}`, data);
}

export async function deleteSkill(id: string) {
  return apiDelete(`/api/profile/skills/${id}`);
}

// Default Resume
export async function getDefaultResume(): Promise<{ defaultResumeName: string | null; resumes: { name: string }[] }> {
  return apiGet("/api/settings/default-resume");
}

export async function setDefaultResume(defaultResumeName: string | null): Promise<{ success: boolean; defaultResumeName?: string }> {
  return apiPut("/api/settings/default-resume", { defaultResumeName });
}
