import { useAuth } from "../contexts/AuthContext";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="h-screen flex items-center justify-center bg-brand-canvas">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-semibold text-brand-ink tracking-tight">
          Switch
        </h1>
        <p className="text-sm text-brand-body">
          Tailor your resume. Land the job.
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
