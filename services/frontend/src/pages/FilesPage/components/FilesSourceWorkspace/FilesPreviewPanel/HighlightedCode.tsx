import React, { useMemo } from "react";
import { highlightLines as hlLines } from "../../../../../utils/highlight";

export const HighlightedCode: React.FC<{
  code: string;
  language?: string;
  highlightLineNos?: Set<number>;
}> = React.memo(({ code, language, highlightLineNos }) => {
  const lines = useMemo(() => (code ? hlLines(code, language) : []), [code, language]);

  if (!code) {
    return (
      <div className="highlighted-code highlighted-code--empty">
        <p className="highlighted-code__empty-copy">
          파일을 선택하면 내용을 볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="highlighted-code">
      {lines.map((html, i) => {
        const lineNo = i + 1;
        const isHighlighted = highlightLineNos?.has(lineNo);

        return (
          <div
            key={lineNo}
            className={isHighlighted ? "highlighted-code__line highlighted-code__line--highlighted" : "highlighted-code__line"}
          >
            <span className="highlighted-code__line-no">{lineNo}</span>
            <span className="highlighted-code__line-text" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      })}
    </div>
  );
});
