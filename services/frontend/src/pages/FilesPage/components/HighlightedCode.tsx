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
      <div className="source-tree__code">
        <p className="text-tertiary" style={{ padding: "var(--cds-spacing-05)" }}>
          파일을 선택하면 내용을 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="source-tree__code">
      {lines.map((html, i) => {
        const lineNo = i + 1;
        const isHighlighted = highlightLineNos?.has(lineNo);

        return (
          <div
            key={lineNo}
            className={`source-tree__code-line${isHighlighted ? " source-tree__code-line--highlight" : ""}`}
          >
            <span className="source-tree__line-no">{lineNo}</span>
            <span className="source-tree__line-content" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      })}
    </div>
  );
});
