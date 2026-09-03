import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { getBoardListings } from "../../lib/api";
import type { BoardListingKind } from "../../types";

const MIN_RUPEES = 99;

interface ClaimRankWidgetProps {
  kind: BoardListingKind;
  onClaim: (amount: string) => void;
}

export default function ClaimRankWidget({ kind, onClaim }: ClaimRankWidgetProps) {
  const [amount, setAmount] = useState("");
  const [bids, setBids] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    setBids([]);
    getBoardListings(kind, "all")
      .then((data) => {
        if (cancelled) return;
        const list = data.listings.map((l) => l.bidPaise);
        setBids(list);
        const maxPaise = list.reduce((m, b) => Math.max(m, b), 0);
        setAmount(String(Math.max(MIN_RUPEES, (maxPaise + 100) / 100)));
      })
      .catch(() => {
        if (!cancelled) setBids([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const amountValue = Number(amount);
  const amountPaise = Math.round(amountValue * 100);
  const valid =
    amount.trim() !== "" && Number.isFinite(amountValue) && amountValue >= MIN_RUPEES;

  const rank = useMemo(() => {
    if (!valid) return null;
    return 1 + bids.filter((b) => b >= amountPaise).length;
  }, [bids, amountPaise, valid]);

  const total = bids.length;
  const noun = kind === "candidate" ? "candidates" : "listings";

  return (
    <div className="rounded-xl bg-brand-canvas border border-brand-hairline p-6 mb-8">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-12 h-12 shrink-0 rounded-lg bg-brand-canvas-soft-2 border border-brand-hairline flex items-center justify-center">
          <Trophy size={20} className="text-brand-link" />
        </div>

        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[18px] font-semibold tracking-[-0.36px] text-brand-ink">
            Claim #{rank ?? "—"}
          </span>
          <span className="text-[16px] text-brand-body">for</span>
          <div className="inline-flex items-center gap-1 rounded-md border border-brand-hairline-strong bg-brand-canvas px-3 h-10 focus-within:ring-2 focus-within:ring-brand-link/20 focus-within:border-brand-link">
            <span className="text-[14px] text-brand-body">₹</span>
            <input
              type="number"
              min={MIN_RUPEES}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1,000"
              className="w-32 bg-transparent text-[16px] font-medium text-brand-ink placeholder:text-brand-mute focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={() => onClaim(amount)}
          disabled={!valid}
          className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-canvas px-6 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shrink-0"
        >
          Claim Rank
        </button>

        <p className="text-[13px] leading-[20px] text-brand-body ml-auto max-w-[280px]">
          {valid
            ? rank === 1
              ? `Top of the board. You'd outrank all ${total} active ${noun}.`
              : `You'd land at rank #${rank} out of ${total} active ${noun}.`
            : `Enter an amount (min ₹${MIN_RUPEES}) to preview the rank you'd land at.`}
        </p>
      </div>
    </div>
  );
}
