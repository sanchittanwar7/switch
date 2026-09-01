import { ExternalLink } from "lucide-react";

const PAYMENT_PAGE_URL =
  import.meta.env.VITE_RAZORPAY_PAYMENT_PAGE_URL ||
  "https://pages.razorpay.com/pl_TWqOutRSijd1qB";

interface RazorpayButtonProps {
  listingId: string;
  label?: string;
}

export default function RazorpayButton({ listingId, label = "Proceed to payment" }: RazorpayButtonProps) {
  function openPayment() {
    const url = `${PAYMENT_PAGE_URL}?notes[listingId]=${encodeURIComponent(listingId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={openPayment}
      className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-11 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
    >
      <ExternalLink size={14} />
      {label}
    </button>
  );
}
