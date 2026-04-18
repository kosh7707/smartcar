import React, { useMemo } from "react";
import { highlightLines as hlLines } from "../../../utils/highlight";

export const HighlightedCode: React.FC<{
  code: string;
  language?: string;
  highlightLineNos?: Set<number>;
}> = React.memo(({ code, language, highlightLineNos }) => {
  const lines = useMemo(() => (code ? hlLines(code, language) : []), [code, language]);

  if (!code) {
    return (
      <div className="min-w-max font-mono text-sm leading-6 text-foreground">
        <p className="px-5 py-5 text-sm text-muted-foreground">
          파일을 선택하면 내용을 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-max font-mono text-sm leading-6 text-foreground">
      {lines.map((html, i) => {
        const lineNo = i + 1;
        const isHighlighted = highlightLineNos?.has(lineNo);

        return (
          <div
            key={lineNo}
            className="flex min-h-6 px-5 transition-colors hover:bg-muted/60"
            style={isHighlighted ? { background: "color-mix(in srgb, var(--aegis-severity-high) 10%, transparent)" } : undefined}
          >
            <span className="inline-block min-w-11 shrink-0 select-none pr-4 text-right text-muted-foreground">{lineNo}</span>
            <span className="flex-1 whitespace-pre" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      })}
    </div>
  );
});
