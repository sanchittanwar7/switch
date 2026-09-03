import { Link } from "react-router-dom";

export interface InfoSection {
  heading: string;
  paragraphs: string[];
}

interface InfoPageProps {
  title: string;
  description: string;
  sections: InfoSection[];
}

export default function InfoPage({ title, description, sections }: InfoPageProps) {
  return (
    <div className="min-h-screen bg-brand-canvas text-brand-ink">
      <nav className="relative z-10 flex items-center justify-between px-6 h-16 border-b border-brand-hairline bg-brand-canvas/80 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-[-0.28px] text-brand-ink">
            Lean Switch
          </span>
        </Link>
        <Link
          to="/"
          className="text-[14px] text-brand-body hover:text-brand-ink transition-colors"
        >
          Back to home
        </Link>
      </nav>

      <main className="max-w-[720px] mx-auto px-6 py-16">
        <h1 className="text-[32px] font-semibold leading-[40px] tracking-[-1.28px] text-brand-ink mb-4">
          {title}
        </h1>
        <p className="text-[16px] leading-[24px] text-brand-body mb-12">
          {description}
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-[18px] font-medium leading-[26px] text-brand-ink mb-3">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph, i) => (
                <p
                  key={i}
                  className="text-[14px] leading-[22px] text-brand-body mb-3"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-brand-hairline py-8">
        <div className="max-w-[720px] mx-auto px-6 text-[12px] leading-[16px] text-brand-mute">
          © {new Date().getFullYear()} Lean Switch. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
