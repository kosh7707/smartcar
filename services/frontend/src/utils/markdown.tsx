import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "./highlight";

/**
 * Render markdown string to React nodes.
 * Uses react-markdown with GFM support + highlight.js for code blocks.
 */
export function renderMarkdown(md: string): React.ReactNode {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = className?.match(/language-(\w+)/);
          const lang = match?.[1];
          const codeStr = String(children).replace(/\n$/, "");

          // Fenced code block
          if (lang || (className && className.includes("language-"))) {
            return (
              <pre className="relative my-4 overflow-x-auto whitespace-pre rounded-[var(--cds-radius)] border border-[var(--cds-border-subtle)] bg-[var(--cds-layer-02)] p-5 font-mono text-[var(--cds-type-xs)] leading-[1.6]">
                {lang && <span className="absolute top-[var(--cds-spacing-03)] right-[var(--cds-spacing-04)] text-[var(--cds-type-2xs)] uppercase tracking-[0.05em] text-[var(--cds-text-placeholder)]">{lang}</span>}
                <code
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(codeStr, lang),
                  }}
                />
              </pre>
            );
          }

          // Inline code
          return (
            <code className="rounded-[var(--cds-radius)] bg-[var(--cds-layer-02)] px-[5px] py-px font-mono text-[0.9em]" {...props}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--cds-interactive)] no-underline hover:underline">
              {children}
            </a>
          );
        },
        h1: ({ children }) => <h1 className="my-[var(--cds-spacing-04)] mb-[var(--cds-spacing-03)] text-[var(--cds-text-primary)] first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="my-[var(--cds-spacing-04)] mb-[var(--cds-spacing-03)] text-[var(--cds-text-primary)] first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="my-[var(--cds-spacing-04)] mb-[var(--cds-spacing-03)] text-[var(--cds-text-primary)] first:mt-0">{children}</h3>,
        h4: ({ children }) => <h4 className="my-[var(--cds-spacing-04)] mb-[var(--cds-spacing-03)] text-[var(--cds-text-primary)] first:mt-0">{children}</h4>,
        h5: ({ children }) => <h5 className="my-[var(--cds-spacing-04)] mb-[var(--cds-spacing-03)] text-[var(--cds-text-primary)] first:mt-0">{children}</h5>,
        h6: ({ children }) => <h6 className="my-[var(--cds-spacing-04)] mb-[var(--cds-spacing-03)] text-[var(--cds-text-primary)] first:mt-0">{children}</h6>,
        p: ({ children }) => <p className="my-[var(--cds-spacing-03)] leading-[1.7] text-[var(--cds-text-secondary)]">{children}</p>,
        ul: ({ children }) => <ul className="my-[var(--cds-spacing-03)] list-disc pl-[var(--cds-spacing-06)] leading-[1.7] text-[var(--cds-text-secondary)]">{children}</ul>,
        ol: ({ children }) => <ol className="my-[var(--cds-spacing-03)] list-decimal pl-[var(--cds-spacing-06)] leading-[1.7] text-[var(--cds-text-secondary)]">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="my-[var(--cds-spacing-04)] border-l-[3px] border-[var(--cds-border-subtle)] px-[var(--cds-spacing-05)] py-[var(--cds-spacing-03)] italic text-[var(--cds-text-secondary)]">{children}</blockquote>,
        hr: () => <hr className="my-[var(--cds-spacing-05)] border-0 border-t border-[var(--cds-border-subtle)]" />,
        table: ({ children }) => <table className="my-[var(--cds-spacing-04)] w-full border-collapse text-[var(--cds-type-sm)]">{children}</table>,
        img: ({ src, alt }) => <img src={src} alt={alt} className="my-[var(--cds-spacing-04)] max-w-full rounded-[var(--cds-radius)]" />,
      }}
    >
      {md}
    </Markdown>
  );
}
