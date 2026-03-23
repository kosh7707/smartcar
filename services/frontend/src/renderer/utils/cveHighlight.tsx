import React from "react";

const CVE_REGEX = /CVE-\d{4}-\d{4,}/g;

/**
 * Highlight CVE identifiers in text with accent-colored spans.
 * Non-CVE text is returned as-is.
 */
export function highlightCVEs(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  CVE_REGEX.lastIndex = 0;

  while ((match = CVE_REGEX.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    parts.push(
      <span key={match.index} className="cve-highlight">
        {match[0]}
      </span>,
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length <= 1 ? (parts[0] ?? text) : <>{parts}</>;
}
