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
