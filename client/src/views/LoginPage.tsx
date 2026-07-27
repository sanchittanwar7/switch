import { useAuth } from "../contexts/AuthContext";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="h-screen flex items-center justify-center bg-brand-canvas-soft">
      <div className="text-center space-y-6">
        <h1 className="text-[32px] font-semibold leading-[40px] tracking-[-1.28px] text-brand-ink">
          Lean Switch
        </h1>
        <p className="text-sm text-brand-body">
          Intelligent job switching.
        </p>
        <button
          onClick={login}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-ink text-brand-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <LogIn size={18} />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
