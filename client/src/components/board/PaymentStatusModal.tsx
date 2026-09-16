import { X, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface PaymentStatusModalProps {
  status: string | null;
  email: string | null;
  onClose: () => void;
}

interface StatusView {
  icon: typeof CheckCircle2;
  iconClass: string;
  title: string;
  body: string;
}

const STATUS_VIEWS: Record<string, StatusView> = {
  succeeded: {
    icon: CheckCircle2,
    iconClass: "text-brand-success",
    title: "Payment successful.",
    body: "Your boost has been applied. The listing will rank higher.",
  },
  failed: {
    icon: XCircle,
    iconClass: "text-brand-error",
    title: "Payment failed.",
    body: "Your payment didn't go through. You can try boosting again.",
  },
  cancelled: {
    icon: AlertTriangle,
    iconClass: "text-brand-warning",
    title: "Payment cancelled.",
    body: "You cancelled the payment. No charge was made.",
  },
  pending: {
    icon: AlertTriangle,
    iconClass: "text-brand-warning",
    title: "Payment pending.",
    body: "We're still processing your payment. We'll update the board shortly.",
  },
  expired: {
    icon: AlertTriangle,
    iconClass: "text-brand-warning",
    title: "Payment expired.",
    body: "This payment session expired. Please start a new boost.",
  },
};

export default function PaymentStatusModal({ status, email, onClose }: PaymentStatusModalProps) {
  if (!status) return null;

  const normalized = status.toLowerCase();
  const view = STATUS_VIEWS[normalized] ?? STATUS_VIEWS.pending;
  const Icon = view.icon;
  const succeeded = normalized === "succeeded";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="relative w-full max-w-[400px] rounded-xl bg-brand-canvas border border-brand-hairline p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded text-brand-mute hover:text-brand-ink transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center">
          <Icon size={32} className={view.iconClass} />
          <h3 className="mt-4 text-[18px] font-semibold leading-[24px] tracking-[-0.36px] text-brand-ink">
            {view.title}
          </h3>
          <p className="mt-2 text-[13px] leading-[20px] text-brand-body">{view.body}</p>
          {succeeded && email && (
            <p className="mt-3 text-[12px] text-brand-mute">We'll email a receipt to {email}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
