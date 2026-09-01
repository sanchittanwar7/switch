import { create } from "zustand";
import { getBoardListings, createBoardListing } from "../lib/api";
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
  fetchListings: () => Promise<void>;
  createListing: (data: BoardListingInput) => Promise<BoardCreateResponse>;
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

  fetchListings: async () => {
    const { kind, window, filters } = get();
    set({ loading: true, error: null });
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
}));
