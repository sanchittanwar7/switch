import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, X, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { getQuestions, getSharedQuestions } from "../lib/api";
import { useSettingsStore } from "../stores/settingsStore";
import type { QuestionBankEntry, SharedQuestionEntry, InterviewType, InterviewStatus } from "../types";

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

type Tab = "mine" | "all";

export default function QuestionBankView() {
  const navigate = useNavigate();
  const shareQuestions = useSettingsStore((s) => s.settings?.shareQuestions ?? false);

  const [activeTab, setActiveTab] = useState<Tab>("mine");

  const [myQuestions, setMyQuestions] = useState<QuestionBankEntry[]>([]);
  const [sharedQuestions, setSharedQuestions] = useState<SharedQuestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab === "mine") {
      const filters: { type?: string; company?: string; status?: string; search?: string } = {};
      if (typeFilter) filters.type = typeFilter;
      if (companyFilter) filters.company = companyFilter;
      if (statusFilter) filters.status = statusFilter;
      if (appliedSearch) filters.search = appliedSearch;

      setLoading(true);
      setError(null);
      getQuestions(filters)
        .then((data) => {
          setMyQuestions(data.interviews);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || "Failed to load questions");
          setLoading(false);
        });
    } else {
      if (!shareQuestions) {
        setLoading(false);
        setError(null);
        setSharedQuestions([]);
        return;
      }

      const filters: { type?: string; company?: string; search?: string } = {};
      if (typeFilter) filters.type = typeFilter;
      if (companyFilter) filters.company = companyFilter;
      if (appliedSearch) filters.search = appliedSearch;

      setLoading(true);
      setError(null);
      getSharedQuestions(filters)
        .then((data) => {
          setSharedQuestions(data.interviews);
          setLoading(false);
        })
        .catch((err) => {
          if (err.message?.includes("Sharing must be enabled")) {
            setError("sharing_disabled");
          } else {
            setError(err.message || "Failed to load shared questions");
          }
          setLoading(false);
        });
    }
  }, [activeTab, typeFilter, companyFilter, statusFilter, appliedSearch, shareQuestions]);

  const companies = useMemo(() => {
    const questions = activeTab === "mine" ? myQuestions : sharedQuestions;
    const set = new Set<string>();
    questions.forEach((q) => {
      if (q.company) set.add(q.company);
    });
    return Array.from(set).sort();
  }, [myQuestions, sharedQuestions, activeTab]);

  const displayQuestions = activeTab === "mine" ? myQuestions : sharedQuestions;
  const hasFilters = typeFilter || companyFilter || (activeTab === "mine" && statusFilter) || appliedSearch;

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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setExpandedIds(new Set());
    if (tab === "all") {
      setStatusFilter("");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto py-16 px-8">
        <h2 className="text-[24px] font-semibold leading-[32px] tracking-[-0.96px] text-brand-ink mb-2">
          Question Bank
        </h2>
        <p className="text-sm text-brand-body mb-10">
          Browse interview questions across all your applications.
        </p>

        <div className="flex items-center gap-1 mb-8">
          <button
            onClick={() => handleTabChange("mine")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === "mine"
                ? "bg-brand-ink text-brand-canvas"
                : "text-brand-body hover:text-brand-ink hover:bg-brand-canvas"
            }`}
          >
            My Questions
          </button>
          <button
            onClick={() => handleTabChange("all")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-brand-ink text-brand-canvas"
                : "text-brand-body hover:text-brand-ink hover:bg-brand-canvas"
            }`}
          >
            All Questions
          </button>
        </div>

        {activeTab === "all" && !shareQuestions && (
          <div className="p-12 rounded-xl bg-brand-canvas border border-brand-hairline flex flex-col items-center text-center mb-10">
            <Globe size={32} className="text-brand-mute mb-4" />
            <p className="text-[14px] text-brand-body mb-2">
              Question sharing is currently disabled.
            </p>
            <p className="text-[13px] text-brand-mute max-w-md mb-4">
              Enable question sharing in Settings to browse questions shared by other users.
              When sharing is on, only your question titles, types, companies, and dates are
              shared — your application details, roles, and statuses always stay private.
            </p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-[100px] bg-brand-ink text-brand-canvas px-5 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
            >
              <Globe size={14} />
              Open Settings
            </Link>
          </div>
        )}

        {activeTab === "all" && shareQuestions && (
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
        )}

        {activeTab === "mine" && (
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
        )}

        {loading && (
          <div className="flex items-center justify-center py-32">
            <span className="text-sm text-brand-mute">Loading questions...</span>
          </div>
        )}

        {error && error !== "sharing_disabled" && (
          <div className="text-center py-32">
            <p className="text-sm text-brand-error">{error}</p>
          </div>
        )}

        {!loading && !error && displayQuestions.length === 0 && (
          <div className="text-center py-32">
            <p className="text-sm text-brand-body">
              {activeTab === "all" && shareQuestions
                ? hasFilters
                  ? "No shared questions match your filters."
                  : "No shared questions yet."
                : hasFilters
                  ? "No questions match your filters."
                  : "No questions recorded yet. Add interviews to your applications."}
            </p>
          </div>
        )}

        {!loading && !error && displayQuestions.length > 0 && (
          <div className="space-y-4">
            {displayQuestions.map((q) => {
              const isExpanded = expandedIds.has(q.interviewId);
              const isMine = activeTab === "mine";
              const entry = q as QuestionBankEntry;
              const shared = q as SharedQuestionEntry;

              return (
                <div
                  key={q.interviewId}
                  className="bg-brand-canvas border border-brand-hairline rounded-lg hover:border-brand-hairline-strong transition-colors"
                >
                  {isMine ? (
                    <button
                      onClick={() => navigate(`/application/${entry.applicationId}`)}
                      className="w-full text-left p-6 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <h4 className="text-sm font-medium text-brand-ink">
                              {entry.company}
                            </h4>
                            <span className="inline-flex items-center text-xs text-brand-body bg-brand-canvas-soft px-1.5 py-0.5 rounded-full border border-brand-hairline shrink-0">
                              {TYPE_LABELS[entry.type]}
                            </span>
                            {entry.role && (
                              <span className="inline-flex items-center text-xs text-brand-body bg-brand-canvas-soft px-1.5 py-0.5 rounded-full border border-brand-hairline shrink-0">
                                {entry.role}
                              </span>
                            )}
                            <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[entry.status]}`}>
                              {STATUS_LABELS[entry.status]}
                            </span>
                          </div>
                          <p className="text-sm text-brand-body mt-2 leading-relaxed">
                            {entry.questionTitle}
                          </p>
                          <p className="text-xs text-brand-mute mt-2">
                            {formatDate(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <h4 className="text-sm font-medium text-brand-ink">
                              {shared.company}
                            </h4>
                            <span className="inline-flex items-center text-xs text-brand-body bg-brand-canvas-soft px-1.5 py-0.5 rounded-full border border-brand-hairline shrink-0">
                              {TYPE_LABELS[shared.type]}
                            </span>
                          </div>
                          <p className="text-sm text-brand-body mt-2 leading-relaxed">
                            {shared.questionTitle}
                          </p>
                          <p className="text-xs text-brand-mute mt-2">
                            {formatDate(shared.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {q.questionDetail && (
                    <>
                      <div className="border-t border-brand-hairline" />
                      <button
                        onClick={() => toggleExpand(q.interviewId)}
                        className="w-full flex items-center justify-between px-6 py-2.5 text-xs font-medium text-brand-mute hover:text-brand-body hover:bg-brand-canvas-soft transition-colors rounded-b-lg"
                      >
                        <span>Question Detail</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isExpanded && (
                        <div className="px-6 pb-5">
                          <p className="text-sm text-brand-body whitespace-pre-wrap leading-relaxed">
                            {q.questionDetail}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
