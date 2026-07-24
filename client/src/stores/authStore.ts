import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthStore {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  initFromSession: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: true,

  login: async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, isAuthenticated: false });
  },

  initFromSession: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session?.user,
      loading: false,
    });
  },

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session?.user,
      loading: false,
    });
  },
}));
