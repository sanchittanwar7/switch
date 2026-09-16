import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createBoardOrder } from "../../lib/api";

interface DodoPayButtonProps {
  listingId: string;
  amountPaise: number;
  disabled?: boolean;
  label?: string;
  onPaid: () => void;
  onError?: (message: string) => void;
}

export default function DodoPayButton({
  listingId,
  amountPaise,
  disabled = false,
  label = "Proceed to payment",
  onPaid,
  onError,
}: DodoPayButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading || disabled) return;
    setLoading(true);

    try {
      const order = await createBoardOrder(listingId, amountPaise);

      const opened = window.open(order.checkoutUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        throw new Error("Checkout pop-up was blocked. Allow pop-ups and try again.");
      }

      setLoading(false);
      onPaid();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed to start";
      onError?.(message);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="w-full inline-flex items-center justify-center rounded-full bg-brand-ink text-brand-canvas px-6 h-11 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      {loading && <Loader2 size={14} className="animate-spin mr-2" />}
      {label}
    </button>
  );
}
