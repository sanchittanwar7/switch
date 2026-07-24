import { create } from "zustand";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from "../lib/api";
import type { Column, Card, Comment } from "../types";

interface KanbanStore {
  columns: Column[];
  cards: Record<string, Card>;
  loading: boolean;
  fetchBoard: () => Promise<void>;
  createCard: (data: {
    company: string;
    role: string;
    jobUrl?: string;
    resumePath?: string;
    tags?: string[];
    columnId: string;
  }) => Promise<Card>;
  updateCard: (
    id: string,
    data: Partial<
      Pick<
        Card,
        "company" | "role" | "jobUrl" | "resumePath" | "tags" | "columnId"
      >
    >,
  ) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCard: (columns: { id: string; cardIds: string[] }[]) => Promise<void>;
  addComment: (cardId: string, text: string) => Promise<void>;
}

interface BoardResponse {
  columns: Column[];
  cards: Record<string, Card>;
}

export const useKanbanStore = create<KanbanStore>((set) => ({
  columns: [],
  cards: {},
  loading: false,

  fetchBoard: async () => {
    set({ loading: true });
    const data = await apiGet<BoardResponse>("/api/kanban");
    set({ columns: data.columns, cards: data.cards, loading: false });
  },

  createCard: async (data) => {
    const card = await apiPost<Card>("/api/kanban/cards", data);
    set((state) => ({
      cards: { ...state.cards, [card.id]: card },
      columns: state.columns.map((col) =>
        col.id === card.columnId
          ? { ...col, cardIds: [...col.cardIds, card.id] }
          : col,
      ),
    }));
    return card;
  },

  updateCard: async (id, data) => {
    const updated = await apiPatch<Card>(`/api/kanban/cards/${id}`, data);
    set((state) => ({
      cards: { ...state.cards, [id]: updated },
    }));
  },

  deleteCard: async (id) => {
    await apiDelete(`/api/kanban/cards/${id}`);
    set((state) => {
      const { [id]: _removed, ...rest } = state.cards;
      return {
        cards: rest,
        columns: state.columns.map((col) => ({
          ...col,
          cardIds: col.cardIds.filter((cid) => cid !== id),
        })),
      };
    });
  },

  moveCard: async (columns) => {
    set((state) => {
      const newCards = { ...state.cards };
      for (const col of columns) {
        for (let i = 0; i < col.cardIds.length; i++) {
          const cardId = col.cardIds[i];
          if (newCards[cardId]) {
            newCards[cardId] = {
              ...newCards[cardId],
              columnId: col.id,
              position: i,
            };
          }
        }
      }
      return {
        cards: newCards,
        columns: state.columns.map((col) => {
          const updated = columns.find((c) => c.id === col.id);
          return updated ? { ...col, cardIds: updated.cardIds } : col;
        }),
      };
    });

    await apiPut("/api/kanban", { columns });
  },

  addComment: async (cardId, text) => {
    const comment = await apiPost<Comment>(
      `/api/kanban/cards/${cardId}/comments`,
      { text },
    );
    set((state) => {
      const card = state.cards[cardId];
      if (!card) return state;
      return {
        cards: {
          ...state.cards,
          [cardId]: { ...card, comments: [...card.comments, comment] },
        },
      };
    });
  },
}));
