import React from "react";
import "./markdown.css";
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
              <pre className="md-code-block">
                {lang && <span className="md-code-lang">{lang}</span>}
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
            <code className="md-inline-code" {...props}>
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
              {children}
            </a>
          );
        },
        h1: ({ children }) => <h1 className="md-heading">{children}</h1>,
        h2: ({ children }) => <h2 className="md-heading">{children}</h2>,
        h3: ({ children }) => <h3 className="md-heading">{children}</h3>,
        h4: ({ children }) => <h4 className="md-heading">{children}</h4>,
        h5: ({ children }) => <h5 className="md-heading">{children}</h5>,
        h6: ({ children }) => <h6 className="md-heading">{children}</h6>,
        p: ({ children }) => <p className="md-para">{children}</p>,
        ul: ({ children }) => <ul className="md-list">{children}</ul>,
        ol: ({ children }) => <ol className="md-list">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
        hr: () => <hr className="md-hr" />,
        table: ({ children }) => <table className="md-table">{children}</table>,
        img: ({ src, alt }) => <img src={src} alt={alt} className="md-img" />,
      }}
    >
      {md}
    </Markdown>
  );
}
