import { useEffect } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";

export { useAuthStore as useAuth } from "../stores/authStore";

export function AuthProvider({ children }: { children: ReactNode }) {
  const initFromSession = useAuthStore((s) => s.initFromSession);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    initFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [initFromSession, setSession]);

  return <>{children}</>;
}
