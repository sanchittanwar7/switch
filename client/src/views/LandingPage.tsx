import { useNavigate } from "react-router-dom";
import { FileText, LayoutDashboard, ArrowRight, Sparkles, PenTool, Target, Zap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCTA = () => {
    if (user) {
      navigate("/board");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink">
      <div
        className="relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 124, 240, 0.12), transparent),
            radial-gradient(ellipse 50% 80% at 20% 60%, rgba(121, 40, 202, 0.08), transparent),
            radial-gradient(ellipse 60% 60% at 80% 30%, rgba(255, 0, 128, 0.06), transparent),
            radial-gradient(ellipse 70% 60% at 50% 100%, rgba(0, 223, 216, 0.06), transparent)
          `,
        }}
      >
        <nav className="relative z-10 flex items-center justify-between px-6 h-16 border-b border-brand-hairline bg-brand-canvas/80 backdrop-blur-xl">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-[-0.28px] text-brand-ink">
              Lean Switch
            </span>
          </button>
        </nav>

        <section className="relative z-10 max-w-[1200px] mx-auto px-6 pt-32 pb-40 text-center">
          <h1
            className="text-[48px] font-semibold leading-[48px] tracking-[-2.4px] text-brand-ink max-w-[720px] mx-auto"
          >
            Your resume, tailored for every job.
          </h1>
          <p className="mt-6 text-[18px] leading-[28px] text-brand-body max-w-[560px] mx-auto">
            Lean Switch is an AI-powered resume assistant that tailors your LaTeX
            resume for each job description, tracks your applications on a kanban
            board, and helps you land more interviews.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={handleCTA}
              className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-on-primary px-6 h-12 text-[16px] font-medium hover:opacity-90 transition-opacity"
            >
              Sign In
              <ArrowRight size={16} />
            </button>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full bg-brand-canvas text-brand-ink px-6 h-12 text-[16px] font-medium border border-brand-hairline hover:border-brand-hairline-strong transition-colors"
            >
              Learn More
            </a>
          </div>
        </section>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle 600px at 50% -10%, rgba(0, 124, 240, 0.04), transparent),
              radial-gradient(circle 400px at 70% 50%, rgba(121, 40, 202, 0.03), transparent),
              radial-gradient(circle 500px at 30% 50%, rgba(0, 223, 216, 0.03), transparent)
            `,
          }}
        />
      </div>

      <section id="features" className="max-w-[1200px] mx-auto px-6 py-24">
        <h2
          className="text-[32px] font-semibold leading-[40px] tracking-[-1.28px] text-brand-ink mb-16 max-w-[600px]"
        >
          Everything you need to land your next role.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Sparkles size={20} />}
            title="AI Resume Tailoring."
            description="Our AI agent reads the job description and rewrites your LaTeX resume to highlight relevant experience, skills, and keywords — without losing your voice."
          />
          <FeatureCard
            icon={<PenTool size={20} />}
            title="LaTeX Editor with Live Preview."
            description="Edit your resume in a full Monaco editor with syntax highlighting, auto-compile, and a real-time PDF preview. No local setup required."
          />
          <FeatureCard
            icon={<LayoutDashboard size={20} />}
            title="Kanban Job Tracker."
            description="Track every application through your pipeline — from bookmark to applied, phone screen, interview, offer, and beyond. Drag and drop to update."
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <FeatureCard
            icon={<Target size={20} />}
            title="One Master, Many Tailored."
            description="Keep a single master resume and generate tailored versions per role. The agent copies and edits — your original stays untouched."
          />
          <FeatureCard
            icon={<Zap size={20} />}
            title="Instant Compilation."
            description="Compile your LaTeX resume in seconds with our server-side compiler. Download the PDF or preview it instantly in your browser."
          />
          <FeatureCard
            icon={<FileText size={20} />}
            title="Multiple Resumes, One Place."
            description="Manage different resume templates for different industries. Upload existing LaTeX projects or start from a blank template."
          />
        </div>
      </section>

      <section className="bg-brand-ink text-brand-on-primary py-24">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[12px] font-mono tracking-normal uppercase text-black/40 mb-6">
            How It Works
          </p>
          <h2
            className="text-[32px] font-semibold leading-[40px] tracking-[-1.28px] mb-16"
          >
            From job post to tailored resume in minutes.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
            {[
              { step: "01", title: "Create Your Master.", desc: "Upload your LaTeX resume or start from a blank template. Edit in our code editor with live PDF preview." },
              { step: "02", title: "Save a Job.", desc: "Paste a job URL on your kanban board. The application stores the role, company, and links to your tailored resume." },
              { step: "03", title: "Let AI Tailor It.", desc: "The agent reads the job description and rewrites your resume — emphasizing matching skills without fabricating anything." },
              { step: "04", title: "Compile & Apply.", desc: "Review the result, compile the PDF, and send it. Track the application as it moves through your pipeline." },
            ].map((item) => (
              <div key={item.step}>
                <div className="text-[12px] font-mono text-black/30 mb-3">
                  {item.step}
                </div>
                <h3 className="text-[16px] font-medium leading-[24px] mb-2">
                  {item.title}
                </h3>
                <p className="text-[14px] leading-[20px] tracking-[-0.28px] text-black/50">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 py-24 text-center">
        <h2
          className="text-[32px] font-semibold leading-[40px] tracking-[-1.28px] text-brand-ink max-w-[600px] mx-auto"
        >
          Stop writing resumes manually.
        </h2>
        <p className="mt-4 text-[16px] leading-[24px] text-brand-body max-w-[480px] mx-auto">
          Join thousands of job seekers who use Lean Switch to tailor their
          resumes with AI and track their applications.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={handleCTA}
            className="inline-flex items-center gap-2 rounded-full bg-brand-ink text-brand-on-primary px-8 h-12 text-[16px] font-medium hover:opacity-90 transition-opacity"
          >
            Sign In
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="mt-12 text-[12px] leading-[16px] text-brand-mute">
          Built with Vercel · Supabase · LaTeX
        </p>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-lg bg-brand-canvas-soft border border-brand-hairline p-6 hover:border-brand-hairline-strong transition-colors"
      style={{
        boxShadow:
          "0px 1px 1px rgba(0,0,0,0.02), 0px 2px 2px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-brand-canvas-soft-2 text-brand-link mb-4">
        {icon}
      </div>
      <h3 className="text-[16px] font-medium leading-[24px] text-brand-ink mb-2">
        {title}
      </h3>
      <p className="text-[14px] leading-[20px] tracking-[-0.28px] text-brand-body">
        {description}
      </p>
    </div>
  );
}
