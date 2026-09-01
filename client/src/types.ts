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

export interface ResearchSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
  messageCount: number;
}

export interface ResearchSessionDetail {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
  lastActivityAt: number;
  sessionToken: string;
}

export interface AgentMessage {
  role: "user" | "assistant" | "tool_call" | "tool_result";
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: unknown;
}

export interface ResearchReport {
  content: string;
  lastModified: number | null;
}

export type BoardListingKind = "candidate" | "recruiter";
export type BoardListingStatus = "pending_payment" | "active" | "hidden";
export type RankWindow = "all" | "today";

export interface BoardListing {
  id: string;
  kind: BoardListingKind;
  status: BoardListingStatus;
  rank: number;
  bidPaise: number;
  company: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  xUrl: string | null;
  githubUrl: string | null;
  yearsExperience: number | null;
  locations: string[];
  skills: string[];
  jdUrl: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  role: string | null;
  yearsExperienceMin: number | null;
  yearsExperienceMax: number | null;
  createdAt: string;
}

export interface BoardListingInput {
  kind: BoardListingKind;
  company?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  xUrl?: string;
  githubUrl?: string;
  yearsExperience?: number;
  locations?: string[];
  skills?: string[];
  jdUrl?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  role?: string;
  yearsExperienceMin?: number;
  yearsExperienceMax?: number;
}

export interface BoardPayment {
  id: string;
  listingId: string;
  userId: string | null;
  razorpayPaymentId: string;
  amountPaise: number;
  status: string;
  capturedAt: string;
  createdAt: string;
}

export interface BoardFilters {
  skills?: string[];
  location?: string;
  yearsExperience?: number;
  role?: string;
}

export interface BoardListingsResponse {
  kind: BoardListingKind;
  window: RankWindow;
  listings: BoardListing[];
}

export interface BoardCreateResponse {
  listing: BoardListing;
  alreadyListed: boolean;
}

export interface BoardOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}
