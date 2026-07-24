import { useAuth } from "../contexts/AuthContext";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">Switch</h1>
        <p className="text-gray-400">Tailor your resume. Land the job.</p>
        <button
          onClick={login}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        >
          <LogIn size={20} />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
