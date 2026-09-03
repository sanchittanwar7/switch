import { X, Users, Building2 } from "lucide-react";

interface WhyBidModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WhyBidModal({ open, onClose }: WhyBidModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="relative w-full max-w-[440px] rounded-xl bg-brand-canvas border border-brand-hairline p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded text-brand-mute hover:text-brand-ink transition-colors"
        >
          <X size={16} />
        </button>

        <h3 className="text-[18px] font-semibold leading-[24px] tracking-[-0.36px] text-brand-ink mb-6">
          Why bid?
        </h3>

        <div className="space-y-5">
          <div className="rounded-lg bg-brand-canvas-soft border border-brand-hairline p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={15} className="text-brand-link" />
              <p className="text-[14px] font-medium text-brand-ink">Why should a candidate bid?</p>
            </div>
            <p className="text-[13px] leading-[20px] text-brand-body">
              Most of the people randomly apply for jobs knowing that they're not eligible. This
              minimal payment filters 90% of such people out — exponentially increasing your
              chances to be seen.
            </p>
          </div>

          <div className="rounded-lg bg-brand-canvas-soft border border-brand-hairline p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={15} className="text-brand-link" />
              <p className="text-[14px] font-medium text-brand-ink">Why should a recruiter bid?</p>
            </div>
            <p className="text-[13px] leading-[20px] text-brand-body">
              Recruiters spend hours and burn thousands to find a serious and right fit. Spend a
              small fraction here to get noticed by candidates who are actually looking for the
              right opportunity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
