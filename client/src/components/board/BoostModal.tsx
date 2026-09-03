import { useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, TrendingUp } from "lucide-react";
import RazorpayButton from "./RazorpayButton";
import { getBoardListings } from "../../lib/api";
import type { BoardListing } from "../../types";

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40;
const MIN_RUPEES = 99;

interface BoostModalProps {
  listing: BoardListing;
  alreadyListed: boolean;
  initialAmount?: string | null;
  onClose: () => void;
  onPaid: () => void;
}

export default function BoostModal({ listing, alreadyListed, initialAmount, onClose, onPaid }: BoostModalProps) {
  const [polling, setPolling] = useState(false);
  const [paid, setPaid] = useState(false);
  const [amount, setAmount] = useState(initialAmount ?? "");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const initialBidRef = useRef(listing.bidPaise);
  const initialStatusRef = useRef(listing.status);

  const amountValue = Number(amount);
  const amountPaise = Math.round(amountValue * 100);
  const amountValid =
    amount.trim() !== "" && Number.isFinite(amountValue) && amountValue >= MIN_RUPEES;

  const title =
    listing.kind === "candidate"
      ? listing.name || "Candidate"
      : listing.company || "Company";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startPolling() {
    setPolling(true);
    pollCountRef.current = 0;

    timerRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      try {
        const data = await getBoardListings(listing.kind, "all");
        const current = data.listings.find((l) => l.id === listing.id);

        if (current) {
          const activated = initialStatusRef.current !== "active" && current.status === "active";
          const boosted = current.status === "active" && current.bidPaise > initialBidRef.current;

          if (activated || boosted) {
            if (timerRef.current) clearInterval(timerRef.current);
            setPolling(false);
            setPaid(true);
            onPaid();
            return;
          }
        }
      } catch {
        /* transient poll failure — keep trying */
      }

      if (pollCountRef.current >= MAX_POLLS) {
        if (timerRef.current) clearInterval(timerRef.current);
        setPolling(false);
      }
    }, POLL_INTERVAL_MS);
  }

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

        <div className="flex items-center gap-2 mb-6">
          <TrendingUp size={18} className="text-brand-link" />
          <h3 className="text-[18px] font-semibold leading-[24px] tracking-[-0.36px] text-brand-ink">
            Boost listing.
          </h3>
        </div>

        <div className="rounded-lg bg-brand-canvas-soft border border-brand-hairline p-4 mb-6">
          <p className="text-[14px] font-medium text-brand-ink">{title}</p>
          <p className="text-[13px] text-brand-body mt-1">
            Current raised: {formatPaise(listing.bidPaise)}
          </p>
        </div>

        {!paid && !polling && (
          <div className="space-y-4">
            <p className="text-[14px] leading-[20px] text-brand-body">
              {alreadyListed
                ? "This listing is already on the board. Your payment boosts it and pushes it higher in the rankings."
                : "Complete a payment of at least ₹99 to activate this listing. Anyone can pay — the amount you enter becomes the listing's bid."}
            </p>

            <label className="block">
              <span className="text-[14px] leading-[20px] font-medium text-brand-ink mb-1.5 block">
                Amount (₹)
              </span>
              <input
                type="number"
                min={MIN_RUPEES}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${MIN_RUPEES}`}
                className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[13px] text-brand-error">
                {error}
              </div>
            )}

            <RazorpayButton
              listingId={listing.id}
              amountPaise={amountPaise}
              disabled={!amountValid}
              onPaid={startPolling}
              onError={setError}
            />
            <p className="text-[12px] text-brand-mute">
              Razorpay checkout opens here. Complete the payment — we'll confirm automatically.
            </p>
          </div>
        )}

        {polling && (
          <div className="flex items-center gap-3 py-2">
            <Loader2 size={18} className="animate-spin text-brand-link" />
            <p className="text-[14px] text-brand-body">Waiting for your payment…</p>
          </div>
        )}

        {paid && (
          <div className="flex items-center gap-3 py-2">
            <CheckCircle2 size={18} className="text-brand-link" />
            <p className="text-[14px] text-brand-ink">Payment received. Listing {alreadyListed ? "boosted" : "activated"}.</p>
          </div>
        )}

        {paid && (
          <button
            onClick={onClose}
            className="mt-6 w-full inline-flex items-center justify-center rounded-full bg-brand-ink text-brand-canvas px-6 h-11 text-[14px] leading-[20px] font-medium hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
