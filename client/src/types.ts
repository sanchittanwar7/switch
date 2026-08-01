export interface Column {
  id: string;
  title: string;
  position: number;
  cardIds: string[];
}

export interface Comment {
  id: string;
  cardId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Card {
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
  createdAt: string;
  updatedAt: string;
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
