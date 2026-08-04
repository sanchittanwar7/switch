import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ExternalLink } from "lucide-react";
import { getQuestions } from "../lib/api";
import type { QuestionBankEntry, InterviewType, InterviewStatus } from "../types";

const TYPE_LABELS: Record<InterviewType, string> = {
  phone_screen: "Phone Screen",
  coding: "Coding",
  technical: "Technical",
  system_design: "System Design",
  behavioral: "Behavioral",
  onsite: "Onsite",
  final: "Final",
  take_home: "Take Home",
  other: "Other",
};

const STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  passed: "Passed",
  failed: "Failed",
};

const STATUS_COLORS: Record<InterviewStatus, string> = {
  scheduled: "bg-brand-link/10 text-brand-link border-brand-link/20",
  completed: "bg-green-950/40 text-green-400 border-green-800/40",
  passed: "bg-green-950/40 text-green-400 border-green-800/40",
  failed: "bg-brand-error-soft text-brand-error border-brand-error-soft",
};

const INTERVIEW_TYPES: InterviewType[] = [
  "phone_screen",
  "coding",
  "technical",
  "system_design",
  "behavioral",
  "onsite",
  "final",
  "take_home",
  "other",
];

const INTERVIEW_STATUSES: InterviewStatus[] = [
  "scheduled",
  "completed",
  "passed",
  "failed",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function QuestionBankView() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  useEffect(() => {
    const filters: { type?: string; company?: string; status?: string; search?: string } = {};
    if (typeFilter) filters.type = typeFilter;
    if (companyFilter) filters.company = companyFilter;
    if (statusFilter) filters.status = statusFilter;
    if (appliedSearch) filters.search = appliedSearch;

    setLoading(true);
    setError(null);
    getQuestions(filters)
      .then((data) => {
        setQuestions(data.interviews);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load questions");
        setLoading(false);
      });
  }, [typeFilter, companyFilter, statusFilter, appliedSearch]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.company) set.add(q.company);
    });
    return Array.from(set).sort();
  }, [questions]);

  const hasFilters = typeFilter || companyFilter || statusFilter || appliedSearch;

  const clearFilters = () => {
    setTypeFilter("");
    setCompanyFilter("");
    setStatusFilter("");
    setSearchInput("");
    setAppliedSearch("");
  };

  const handleSearch = () => {
    setAppliedSearch(searchInput.trim());
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto py-16 px-8">
        <h2 className="text-[24px] font-semibold leading-[32px] tracking-[-0.96px] text-brand-ink mb-2">
          Question Bank
        </h2>
        <p className="text-sm text-brand-body mb-10">
          Browse interview questions across all your applications.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-10">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link appearance-none cursor-pointer"
          >
            <option value="">All types</option>
            {INTERVIEW_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link appearance-none cursor-pointer"
          >
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link appearance-none cursor-pointer"
          >
            <option value="">All statuses</option>
            {INTERVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <div className="flex items-center">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search questions..."
              className="h-10 bg-brand-canvas text-brand-ink border border-brand-hairline rounded-l-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-link w-56 placeholder:text-brand-mute"
            />
            <button
              onClick={handleSearch}
              className="h-10 px-3 bg-brand-canvas-soft-2 border border-l-0 border-brand-hairline rounded-r-md text-brand-mute hover:text-brand-ink transition-colors"
            >
              <Search size={16} />
            </button>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 h-10 px-3 text-sm text-brand-link hover:text-brand-ink transition-colors"
            >
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-32">
            <span className="text-sm text-brand-mute">Loading questions...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-32">
            <p className="text-sm text-brand-error">{error}</p>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div className="text-center py-32">
            <p className="text-sm text-brand-body">
              {hasFilters
                ? "No questions match your filters."
                : "No questions recorded yet. Add interviews to your applications."}
            </p>
          </div>
        )}

        {!loading && !error && questions.length > 0 && (
          <div className="space-y-4">
            {questions.map((q) => (
              <button
                key={q.interviewId}
                onClick={() => navigate(`/application/${q.applicationId}`)}
                className="w-full text-left bg-brand-canvas border border-brand-hairline rounded-lg p-6 hover:border-brand-hairline-strong transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h4 className="text-sm font-medium text-brand-ink">
                        {q.company}
                      </h4>
                      <span className="inline-flex items-center text-xs text-brand-body bg-brand-canvas-soft px-1.5 py-0.5 rounded-full border border-brand-hairline shrink-0">
                        {TYPE_LABELS[q.type]}
                      </span>
                      {q.role && (
                        <span className="inline-flex items-center text-xs text-brand-body bg-brand-canvas-soft px-1.5 py-0.5 rounded-full border border-brand-hairline shrink-0">
                          {q.role}
                        </span>
                      )}
                      <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[q.status]}`}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </div>
                    <p className="text-sm text-brand-body mt-2 leading-relaxed">
                      {q.question}
                    </p>
                    <p className="text-xs text-brand-mute mt-2">
                      {formatDate(q.createdAt)}
                    </p>
                  </div>
                  <ExternalLink
                    size={16}
                    className="text-brand-mute group-hover:text-brand-link transition-colors shrink-0 mt-0.5"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
