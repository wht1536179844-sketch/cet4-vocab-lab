import React, { useMemo } from "react";
import { normalizeWord } from "../utils/dictLookup";

function extractSentence(fullText, offset) {
  if (!fullText) return "";
  const left = fullText.slice(0, offset);
  const right = fullText.slice(offset);
  const startMatch = left.match(/(?:^|[.?!。\n])\s*([^.?!。\n]*)$/);
  const endMatch = right.match(/^([^.?!。\n]*[.?!。]?)/);
  const prefix = startMatch ? startMatch[1] : left.slice(-80);
  const suffix = endMatch ? endMatch[1] : right.slice(0, 80);
  return (prefix + suffix).replace(/\s+/g, " ").trim();
}

export default function InteractiveText({
  text,
  savedWordsSet,
  lemmas,
  onWordClick,
  onTextSelect,
  className = "",
  sectionLabel = "",
}) {
  const tokens = useMemo(() => {
    if (!text) return [];
    const result = [];
    const regex = /([A-Za-z]+(?:[-'’][A-Za-z]+)*)/g;
    let lastIdx = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        result.push({ type: "sep", value: text.slice(lastIdx, match.index), idx: lastIdx });
      }
      result.push({ type: "word", value: match[0], idx: match.index });
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) {
      result.push({ type: "sep", value: text.slice(lastIdx), idx: lastIdx });
    }
    return result;
  }, [text]);

  const handleMouseUp = (e) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const selected = sel.toString().trim();
    // Trigger phrase/sentence popup only if user dragged across multiple words or >18 chars
    if (selected && (/\s+/.test(selected) || selected.length > 20) && /[A-Za-z]/.test(selected)) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      onTextSelect?.(selected, rect, sectionLabel);
    }
  };

  return (
    <span className={`interactive-text ${className}`} onMouseUp={handleMouseUp}>
      {tokens.map((tok, i) => {
        if (tok.type === "sep") {
          return <React.Fragment key={i}>{tok.value}</React.Fragment>;
        }
        const norm = normalizeWord(tok.value);
        const lemma = lemmas?.[norm] || norm;
        const isMarked = savedWordsSet.has(norm) || savedWordsSet.has(lemma);
        return (
          <span
            key={i}
            className={`word-token ${isMarked ? "is-marked" : ""}`}
            onClick={(e) => {
              const sel = window.getSelection();
              if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
                return;
              }
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const sentence = extractSentence(text, tok.idx);
              onWordClick?.(tok.value, sentence, rect, sectionLabel);
            }}
          >
            {tok.value}
          </span>
        );
      })}
    </span>
  );
}
