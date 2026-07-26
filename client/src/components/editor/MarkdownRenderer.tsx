import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-brand-ink mt-4 mb-2 tracking-[-0.02em]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-brand-ink mt-3 mb-1.5 tracking-[-0.01em]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-semibold text-brand-ink mt-2 mb-1">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-xs text-brand-body leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-medium text-brand-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="pl-4 mb-2 space-y-0.5 list-disc">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="pl-4 mb-2 space-y-0.5 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-xs text-brand-body">{children}</li>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-link underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand-hairline-strong pl-3 italic text-brand-mute text-xs my-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-brand-hairline my-3" />,
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-brand-canvas-soft-2 text-brand-body font-mono text-xs px-1 py-0.5 rounded-sm">
          {children}
        </code>
      );
    }
    return (
      <code className="text-xs font-mono text-brand-body" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-brand-canvas-soft-2 border border-brand-hairline rounded-md p-3 my-2 overflow-x-auto">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-brand-hairline bg-brand-canvas-soft-2 px-2 py-1 text-left font-medium text-brand-ink">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-brand-hairline px-2 py-1 text-brand-body">{children}</td>
  ),
};

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
});

export default MarkdownRenderer;
