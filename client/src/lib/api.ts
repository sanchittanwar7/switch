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
