import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getApplication } from "../lib/api";
import ApplicationDetailCard from "../components/application/ApplicationDetailCard";
import InterviewsSection from "../components/application/InterviewsSection";
import type { Application, Interview } from "../types";

type ApplicationDetail = Application & { interviews: Interview[]; columnTitle: string };

export default function ApplicationView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchApplication = useCallback(async () => {
    if (!id) return;
    setError("");
    setLoading(true);
    try {
      const data = await getApplication(id);
      setApplication(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setError("not_found");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load application");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-brand-mute">Loading application...</p>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-brand-body">Application not found.</p>
        <button
          onClick={() => navigate("/board")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-link hover:text-brand-link-deep bg-brand-canvas-soft-2 hover:bg-brand-canvas-soft border border-brand-hairline rounded-full transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Board
        </button>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-brand-error">{error || "Something went wrong."}</p>
        <button
          onClick={() => navigate("/board")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-link hover:text-brand-link-deep bg-brand-canvas-soft-2 hover:bg-brand-canvas-soft border border-brand-hairline rounded-full transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Board
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <button
        onClick={() => navigate("/board")}
        className="flex items-center gap-1.5 text-sm text-brand-mute hover:text-brand-ink transition-colors font-medium"
      >
        <ArrowLeft size={16} />
        Back to Board
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <ApplicationDetailCard
            application={application}
            onRefresh={fetchApplication}
          />
        </div>

        <div className="lg:col-span-1">
          <InterviewsSection
            applicationId={application.id}
            interviews={application.interviews ?? []}
            onRefresh={fetchApplication}
          />
        </div>
      </div>
    </div>
  );
}
