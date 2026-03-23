import React from "react";

/**
 * Simple markdown-to-React renderer.
 * Supports: headings, code blocks, bold, italic, bullet lists, paragraphs.
 * Designed for rendering LLM-generated analysis reports and PoC code.
 */
export function renderMarkdown(md: string): React.ReactNode {
  const normalized = md.replace(/\r\n/g, "\n");
  const blocks = splitBlocks(normalized);
  return <>{blocks.map((block, i) => renderBlock(block, i))}</>;
}

interface Block {
  type: "code" | "text";
  content: string;
  lang?: string;
}

function splitBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const codeMatch = line.match(/^```(\w*)/);

    if (codeMatch) {
      // Code block
      const lang = codeMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", content: codeLines.join("\n"), lang });
      i++; // skip closing ```
    } else {
      // Text block — collect until next code block or end
      const textLines: string[] = [];
      while (i < lines.length && !lines[i].match(/^```/)) {
        textLines.push(lines[i]);
        i++;
      }
      const content = textLines.join("\n").trim();
      if (content) blocks.push({ type: "text", content });
    }
  }

  return blocks;
}

function renderBlock(block: Block, key: number): React.ReactNode {
  if (block.type === "code") {
    return (
      <pre key={key} className="md-code-block">
        {block.lang && <span className="md-code-lang">{block.lang}</span>}
        <code>{block.content}</code>
      </pre>
    );
  }

  // Text block — split into paragraphs and render
  const paras = block.content.split(/\n\n+/);
  return (
    <React.Fragment key={key}>
      {paras.map((para, pi) => renderParagraph(para.trim(), `${key}-${pi}`))}
    </React.Fragment>
  );
}

function renderParagraph(text: string, key: string): React.ReactNode {
  // Heading
  const headingMatch = text.match(/^(#{1,4})\s+(.+)$/m);
  if (headingMatch && text.split("\n").length === 1) {
    const level = headingMatch[1].length;
    const Tag = `h${Math.min(level + 1, 6)}` as keyof JSX.IntrinsicElements;
    return <Tag key={key} className="md-heading">{renderInline(headingMatch[2])}</Tag>;
  }

  // Bullet list
  const lines = text.split("\n");
  if (lines.every((l) => /^[-*]\s/.test(l) || l.trim() === "")) {
    return (
      <ul key={key} className="md-list">
        {lines
          .filter((l) => /^[-*]\s/.test(l))
          .map((l, li) => (
            <li key={li}>{renderInline(l.replace(/^[-*]\s+/, ""))}</li>
          ))}
      </ul>
    );
  }

  // Numbered list
  if (lines.every((l) => /^\d+\.\s/.test(l) || l.trim() === "")) {
    return (
      <ol key={key} className="md-list">
        {lines
          .filter((l) => /^\d+\.\s/.test(l))
          .map((l, li) => (
            <li key={li}>{renderInline(l.replace(/^\d+\.\s+/, ""))}</li>
          ))}
      </ol>
    );
  }

  // Regular paragraph
  return <p key={key} className="md-para">{renderInline(text)}</p>;
}

function renderInline(text: string): React.ReactNode {
  // Inline code, bold, italic
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(remaining)) !== null) {
    // Text before match
    if (match.index > idx) {
      parts.push(remaining.substring(idx, match.index));
    }

    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(<code key={match.index} className="md-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }

    idx = match.index + token.length;
  }

  // Remaining text
  if (idx < remaining.length) {
    parts.push(remaining.substring(idx));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
