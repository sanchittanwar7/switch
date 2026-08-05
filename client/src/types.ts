export interface Column {
  id: string;
  title: string;
  position: number;
  applicationIds: string[];
}

export interface Comment {
  id: string;
  applicationId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Application {
  id: string;
  userId: string;
  company: string;
  role: string;
  jobUrl: string | null;
  resumePath: string | null;
  tags: string[];
  columnId: string;
  position: number;
  comments: Comment[];
  interviews?: Interview[];
  columnTitle?: string;
  createdAt: string;
  updatedAt: string;
}

export type InterviewType = "phone_screen" | "coding" | "technical" | "system_design" | "behavioral" | "onsite" | "final" | "take_home" | "other";
export type InterviewStatus = "scheduled" | "completed" | "passed" | "failed";

export interface Interview {
  id: string;
  applicationId: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string | null;
  questionTitle: string | null;
  feedback: string | null;
  questionDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionBankEntry {
  interviewId: string;
  type: InterviewType;
  status: InterviewStatus;
  questionTitle: string;
  questionDetail: string | null;
  company: string;
  role: string;
  applicationId: string;
  createdAt: string;
}

export interface SharedQuestionEntry {
  interviewId: string;
  type: InterviewType;
  questionTitle: string;
  questionDetail: string | null;
  company: string;
  createdAt: string;
}

export interface FileEntry {
  name: string;
  type: "file" | "directory";
}

export interface LaTeXError {
  line: number;
  message: string;
  file: string;
}

export interface AgentStreamEvent {
  type: "tool_call" | "tool_result" | "message" | "done" | "error";
  data: Record<string, unknown>;
}

export type ViewMode = "day" | "week" | "month";

export interface CalendarEvent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  company: string | null;
  role: string | null;
  roundName: string | null;
  resumePath: string | null;
  jobUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  company?: string;
  role?: string;
  roundName?: string;
  resumePath?: string;
  jobUrl?: string;
}

export type UpdateEventInput = Partial<CreateEventInput>;
