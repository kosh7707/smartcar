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
    <div className="markdown-content">
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
                <pre className="markdown-code-block">
                  {lang && <span className="markdown-code-block__lang">{lang}</span>}
                  <code
                    className="markdown-code-block__code"
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(codeStr, lang),
                    }}
                  />
                </pre>
              );
            }

            // Inline code
            return (
              <code className="markdown-inline-code" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="markdown-link">
                {children}
              </a>
            );
          },
          h1: ({ children }) => <h1 className="markdown-heading markdown-heading--h1">{children}</h1>,
          h2: ({ children }) => <h2 className="markdown-heading markdown-heading--h2">{children}</h2>,
          h3: ({ children }) => <h3 className="markdown-heading markdown-heading--h3">{children}</h3>,
          h4: ({ children }) => <h4 className="markdown-heading markdown-heading--h4">{children}</h4>,
          h5: ({ children }) => <h5 className="markdown-heading markdown-heading--h5">{children}</h5>,
          h6: ({ children }) => <h6 className="markdown-heading markdown-heading--h6">{children}</h6>,
          p: ({ children }) => <p className="markdown-paragraph">{children}</p>,
          ul: ({ children }) => <ul className="markdown-list markdown-list--unordered">{children}</ul>,
          ol: ({ children }) => <ol className="markdown-list markdown-list--ordered">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="markdown-quote">{children}</blockquote>,
          hr: () => <hr className="markdown-rule" />,
          table: ({ children }) => <table className="markdown-table">{children}</table>,
          img: ({ src, alt }) => <img src={src} alt={alt} className="markdown-image" />,
        }}
      >
        {md}
      </Markdown>
    </div>
  );
}
