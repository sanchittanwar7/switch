import { MapPin, ExternalLink, TrendingUp, Briefcase, Clock, Pencil, Trash2 } from "lucide-react";
import type { BoardListing } from "../../types";

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (min === null && max === null) return null;
  const ccy = currency || "INR";
  if (min !== null && max !== null) return `${ccy} ${min.toLocaleString()} - ${max.toLocaleString()}`;
  if (min !== null) return `${ccy} ${min.toLocaleString()}+`;
  return `${ccy} up to ${(max as number).toLocaleString()}`;
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[13px] text-brand-link hover:text-brand-ink transition-colors"
    >
      <ExternalLink size={12} />
      {label}
    </a>
  );
}

function SkillPills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {skills.map((skill) => (
        <span
          key={skill}
          className="text-[11px] bg-brand-canvas-soft-2 text-brand-body px-2 py-0.5 rounded-full border border-brand-hairline"
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

function LocationRow({ locations }: { locations: string[] }) {
  if (locations.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[13px] text-brand-body">
      <MapPin size={13} className="text-brand-mute shrink-0" />
      <span>{locations.join(", ")}</span>
    </div>
  );
}

interface ListingCardProps {
  listing: BoardListing;
  onBoost: (listing: BoardListing) => void;
  onEdit: (listing: BoardListing) => void;
  onDelete: (listing: BoardListing) => void;
}

export default function ListingCard({ listing, onBoost, onEdit, onDelete }: ListingCardProps) {
  const isCandidate = listing.kind === "candidate";
  const salary = formatSalary(listing.salaryMin, listing.salaryMax, listing.currency);

  return (
    <div className="bg-brand-canvas border border-brand-hairline rounded-xl p-6 hover:border-brand-hairline-strong transition-colors">
      <div className="flex items-start gap-5">
        <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-brand-canvas-soft-2 border border-brand-hairline">
          <span className="text-[11px] font-mono text-brand-mute">#</span>
          <span className="text-[18px] font-semibold leading-none text-brand-ink">
            {listing.rank}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <h3 className="text-[16px] font-medium leading-[24px] text-brand-ink">
              {isCandidate
                ? listing.name || "Anonymous"
                : listing.company || "Company"}
            </h3>
            {!isCandidate && listing.role && (
              <span className="inline-flex items-center gap-1 text-[13px] text-brand-body bg-brand-canvas-soft-2 px-2 py-0.5 rounded-full border border-brand-hairline">
                <Briefcase size={12} />
                {listing.role}
              </span>
            )}
          </div>

          {isCandidate && (listing.role || listing.company) && (
            <div className="mt-0.5 text-[13px] text-brand-body">
              {[listing.role, listing.company].filter(Boolean).join(" at ")}
            </div>
          )}

          <div className="mt-2 space-y-1">
            <LocationRow locations={listing.locations} />

            {isCandidate && listing.yearsExperience !== null && (
              <div className="flex items-center gap-1.5 text-[13px] text-brand-body">
                <Clock size={13} className="text-brand-mute shrink-0" />
                <span>{listing.yearsExperience} yrs experience</span>
              </div>
            )}

            {!isCandidate &&
              (listing.yearsExperienceMin !== null || listing.yearsExperienceMax !== null) && (
                <div className="flex items-center gap-1.5 text-[13px] text-brand-body">
                  <Clock size={13} className="text-brand-mute shrink-0" />
                  <span>
                    {listing.yearsExperienceMin ?? 0} -{" "}
                    {listing.yearsExperienceMax ?? "any"} yrs experience
                  </span>
                </div>
              )}

            {salary && (
              <div className="text-[13px] text-brand-body">{salary}</div>
            )}
          </div>

          <SkillPills skills={listing.skills} />

          {(isCandidate
            ? listing.linkedinUrl || listing.xUrl || listing.githubUrl || listing.resumeUrl
            : listing.jdUrl) && (
            <div className="flex items-center flex-wrap gap-4 mt-3 pt-3 border-t border-brand-hairline">
              {isCandidate && listing.linkedinUrl && (
                <LinkChip href={listing.linkedinUrl} label="LinkedIn" />
              )}
              {isCandidate && listing.xUrl && <LinkChip href={listing.xUrl} label="X" />}
              {isCandidate && listing.githubUrl && (
                <LinkChip href={listing.githubUrl} label="GitHub" />
              )}
              {isCandidate && listing.resumeUrl && (
                <LinkChip href={listing.resumeUrl} label="Resume" />
              )}
              {!isCandidate && listing.jdUrl && (
                <LinkChip href={listing.jdUrl} label="Job description" />
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-[16px] font-semibold leading-[24px] text-brand-ink">
              {formatPaise(listing.bidPaise)}
            </div>
            <div className="text-[11px] text-brand-mute">raised</div>
          </div>
          <button
            onClick={() => onBoost(listing)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink text-brand-canvas px-4 h-9 text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            <TrendingUp size={14} />
            Boost
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(listing)}
              title="Edit"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-brand-mute hover:text-brand-ink hover:bg-brand-canvas-soft transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => onDelete(listing)}
              title="Delete"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-brand-mute hover:text-brand-error hover:bg-brand-error-soft transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
