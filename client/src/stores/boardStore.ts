import { create } from "zustand";
import { getBoardListings, createBoardListing, updateBoardListing, deleteBoardListing } from "../lib/api";
import type {
  BoardListing,
  BoardListingKind,
  RankWindow,
  BoardFilters,
  BoardListingInput,
  BoardCreateResponse,
} from "../types";

interface BoardStore {
  kind: BoardListingKind;
  window: RankWindow;
  filters: BoardFilters;
  listings: BoardListing[];
  loading: boolean;
  error: string | null;
  setKind: (kind: BoardListingKind) => void;
  setWindow: (window: RankWindow) => void;
  setFilters: (filters: BoardFilters) => void;
  fetchListings: (opts?: { silent?: boolean }) => Promise<void>;
  createListing: (data: BoardListingInput) => Promise<BoardCreateResponse>;
  updateListing: (id: string, data: BoardListingInput) => Promise<void>;
  deleteListing: (id: string) => Promise<void>;
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  kind: "candidate",
  window: "all",
  filters: {},
  listings: [],
  loading: false,
  error: null,

  setKind: (kind) => {
    if (get().kind === kind) return;
    set({ kind, filters: {}, error: null });
  },

  setWindow: (window) => {
    if (get().window === window) return;
    set({ window });
  },

  setFilters: (filters) => {
    set({ filters });
  },

  fetchListings: async (opts) => {
    const { kind, window, filters } = get();
    if (!opts?.silent) set({ loading: true });
    set({ error: null });
    try {
      const data = await getBoardListings(kind, window, filters);
      set({ listings: data.listings, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load board",
      });
    }
  },

  createListing: async (data) => {
    const response = await createBoardListing(data);
    return response;
  },

  updateListing: async (id, data) => {
    const { listing } = await updateBoardListing(id, data);
    set((state) => ({
      listings: state.listings.map((l) => (l.id === id ? { ...l, ...listing } : l)),
    }));
  },

  deleteListing: async (id) => {
    await deleteBoardListing(id);
    set((state) => ({
      listings: state.listings.filter((l) => l.id !== id),
    }));
  },
}));
