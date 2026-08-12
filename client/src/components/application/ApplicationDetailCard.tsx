import { useNavigate } from "react-router-dom";
import { ExternalLink, FileText, Tag } from "lucide-react";
import type { Application } from "../../types";

interface ApplicationDetailCardProps {
  application: Application;
}

export default function ApplicationDetailCard({ application }: ApplicationDetailCardProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-brand-ink tracking-[-0.05em]">
          {application.company}
        </h1>
        <p className="text-sm text-brand-body mt-1">
          {application.role}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {application.columnTitle && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-canvas-soft-2 text-brand-body border border-brand-hairline">
            {application.columnTitle}
          </span>
        )}
        {application.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs text-brand-body bg-brand-canvas-soft-2 border border-brand-hairline px-2 py-1 rounded-full"
          >
            <Tag size={10} className="inline mr-1" />
            {tag}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {application.jobUrl && (
          <a
            href={application.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-brand-link hover:text-brand-link-deep transition-colors min-w-0"
            title={application.jobUrl}
          >
            <ExternalLink size={14} className="shrink-0" />
            <span className="truncate">{application.jobUrl}</span>
          </a>
        )}
        {application.resumePath && (
          <button
            onClick={() => navigate(`/resume?project=${application.resumePath}`)}
            className="flex items-center gap-2 text-sm text-brand-link hover:text-brand-link-deep transition-colors min-w-0 max-w-full"
            title={application.resumePath}
          >
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{application.resumePath}</span>
          </button>
        )}
      </div>
    </div>
  );
}
