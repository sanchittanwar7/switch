import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createBoardOrder } from "../../lib/api";

interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  notes: Record<string, string>;
  handler: (response: RazorpayCheckoutResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayButtonProps {
  listingId: string;
  amountPaise: number;
  disabled?: boolean;
  label?: string;
  onPaid: () => void;
  onError?: (message: string) => void;
}

export default function RazorpayButton({
  listingId,
  amountPaise,
  disabled = false,
  label = "Proceed to payment",
  onPaid,
  onError,
}: RazorpayButtonProps) {
  const [loading, setLoading] = useState(false);
  const scriptLoadingRef = useRef<Promise<void> | null>(null);

  function loadCheckout(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
    if (scriptLoadingRef.current) return scriptLoadingRef.current;

    scriptLoadingRef.current = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CHECKOUT_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptLoadingRef.current = null;
        reject(new Error("Failed to load Razorpay checkout"));
      };
      document.body.appendChild(script);
    });

    return scriptLoadingRef.current;
  }

  async function handleClick() {
    if (loading || disabled) return;
    setLoading(true);

    try {
      await loadCheckout();

      const order = await createBoardOrder(listingId, amountPaise);

      const Rzr = window.Razorpay;
      if (!Rzr) throw new Error("Razorpay checkout unavailable");

      const rzp = new Rzr({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Bidding Board",
        description: "Boost a listing",
        order_id: order.orderId,
        notes: { listingId },
        handler: () => {
          setLoading(false);
          onPaid();
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      });

      rzp.open();
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
