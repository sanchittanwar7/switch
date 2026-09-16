import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Users, Building2, TrendingUp } from "lucide-react";
import { useBoardStore } from "../stores/boardStore";
import ListingCard from "../components/board/ListingCard";
import FilterBar from "../components/board/FilterBar";
import ListingFormModal from "../components/board/ListingFormModal";
import BoostModal from "../components/board/BoostModal";
import WhyBidModal from "../components/board/WhyBidModal";
import PaymentStatusModal from "../components/board/PaymentStatusModal";
import ClaimRankWidget from "../components/board/ClaimRankWidget";
import type { BoardListing, BoardListingKind, RankWindow, BoardCreateResponse } from "../types";

const KIND_TABS: { value: BoardListingKind; label: string; icon: typeof Users }[] = [
  { value: "candidate", label: "Candidates", icon: Users },
  { value: "recruiter", label: "Hiring", icon: Building2 },
];

const WINDOW_TABS: { value: RankWindow; label: string }[] = [
  { value: "all", label: "All-time" },
  { value: "today", label: "Today" },
];

export default function BiddingBoardView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { kind, window, filters, listings, loading, error, setKind, setWindow, setFilters, fetchListings, deleteListing } =
    useBoardStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<BoardListing | null>(null);
  const [boostListing, setBoostListing] = useState<BoardListing | null>(null);
  const [boostAlreadyListed, setBoostAlreadyListed] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [claimAmount, setClaimAmount] = useState<string | null>(null);

  const paymentStatus = searchParams.get("status");
  const paymentEmail = searchParams.get("email");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const refreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (paymentStatus) setPaymentModalOpen(true);
  }, [paymentStatus]);

  useEffect(() => {
    const timers = refreshTimersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  function handlePaymentStatusClose() {
    const succeeded = paymentStatus?.toLowerCase() === "succeeded";
    const next = new URLSearchParams(searchParams);
    next.delete("payment_id");
    next.delete("status");
    next.delete("email");
    setSearchParams(next, { replace: true });
    setPaymentModalOpen(false);
    if (succeeded) {
      fetchListings({ silent: true });
      [1500, 4000, 8000].forEach((delay) => {
        refreshTimersRef.current.push(setTimeout(() => fetchListings({ silent: true }), delay));
      });
    }
  }

  function handleClaim(amount: string) {
    setClaimAmount(amount);
    setFormOpen(true);
  }

  function handleCreated(res: BoardCreateResponse) {
    setFormOpen(false);
    setBoostListing(res.listing);
    setBoostAlreadyListed(res.alreadyListed);
  }

  function handleEdit(listing: BoardListing) {
    setEditingListing(listing);
  }

  function handleEditClose() {
    setEditingListing(null);
  }

  function handleDelete(listing: BoardListing) {
    if (!globalThis.confirm(`Delete listing "${listing.company || listing.role || listing.id}"?`)) return;
    deleteListing(listing.id);
  }

  function handleBoost(listing: BoardListing) {
    setClaimAmount(null);
    setBoostListing(listing);
    setBoostAlreadyListed(false);
  }

  function handlePaid() {
    setClaimAmount(null);
    setBoostListing(null);
    fetchListings();
  }

  function handleBoostClose() {
    setClaimAmount(null);
    setBoostListing(null);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchListings();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [kind, window, filters, fetchListings]);

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink">
      <nav className="flex items-center justify-between px-6 h-16 border-b border-brand-hairline bg-brand-canvas/80 backdrop-blur-xl">
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-[-0.28px] text-brand-ink">
            Lean Switch
          </span>
        </button>
      </nav>

      <div className="max-w-[960px] mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <h1 className="text-[40px] font-semibold leading-[44px] tracking-[-1.6px] text-brand-ink">
              Sponsored board.
            </h1>
            <p className="mt-3 text-[16px] leading-[24px] text-brand-body max-w-[520px]">
              Pay to get listed higher. The more a listing raises, the higher it ranks.
              Anyone can boost any listing.{" "}
              <button
                onClick={() => setWhyOpen(true)}
                className="text-brand-link hover:text-brand-link-deep underline underline-offset-2"
              >
                why
              </button>
            </p>
          </div>
        </div>

        <ClaimRankWidget kind={kind} onClaim={handleClaim} />

        <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-1">
            {KIND_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setKind(value)}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  kind === value
                    ? "bg-brand-ink text-brand-canvas"
                    : "text-brand-body hover:text-brand-ink hover:bg-brand-canvas-soft"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-full bg-brand-canvas-soft-2 border border-brand-hairline p-1">
            {WINDOW_TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setWindow(value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium transition-colors ${
                  window === value
                    ? "bg-brand-ink text-brand-canvas"
                    : "text-brand-body hover:text-brand-ink"
                }`}
              >
                {value === "today" && <TrendingUp size={13} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <FilterBar kind={kind} filters={filters} onChange={setFilters} />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={24} className="animate-spin text-brand-mute" />
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-32">
            <p className="text-sm text-brand-error">{error}</p>
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="p-12 rounded-xl bg-brand-canvas-soft border border-brand-hairline flex flex-col items-center text-center">
            <Users size={32} className="text-brand-mute mb-4" />
            <p className="text-[14px] text-brand-body mb-1">No listings yet.</p>
            <p className="text-[13px] text-brand-mute">
              Be the first to {kind === "candidate" ? "list yourself" : "post a role"}.
            </p>
          </div>
        )}

        {!loading && !error && listings.length > 0 && (
          <div className="space-y-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onBoost={handleBoost}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <ListingFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={handleCreated}
      />

      <ListingFormModal
        open={!!editingListing}
        listing={editingListing}
        onClose={handleEditClose}
        onCreated={handleCreated}
        onUpdated={handleEditClose}
      />

      {boostListing && (
        <BoostModal
          listing={boostListing}
          alreadyListed={boostAlreadyListed}
          initialAmount={claimAmount}
          onClose={handleBoostClose}
          onPaid={handlePaid}
        />
      )}

      <WhyBidModal open={whyOpen} onClose={() => setWhyOpen(false)} />

      <PaymentStatusModal
        status={paymentModalOpen ? paymentStatus : null}
        email={paymentEmail}
        onClose={handlePaymentStatusClose}
      />
    </div>
  );
}
