import React, { useEffect, useMemo, useState } from "react";
import { Volume2, BookmarkPlus, BookmarkCheck, X, Languages, Sparkles, GitBranch } from "lucide-react";
import { analyzeSelection, fetchLiveZh, formatTransSummary, lookupSentenceTrans, speakText } from "../utils/dictLookup";
import { analyzeSentenceStructure } from "../utils/sentenceAnalyzer";

export default function LookupPopover({
  popup,
  dict,
  lemmas,
  translations,
  vocabBook,
  autoSpeak,
  voiceAccent,
  onClose,
  onToggleSaveWord,
  onSavePhrase,
}) {
  const [sentenceZh, setSentenceZh] = useState("");
  const [loadingSentence, setLoadingSentence] = useState(false);

  useEffect(() => {
    setSentenceZh("");
    setLoadingSentence(false);
    if (!popup) return;
    if (autoSpeak && popup.mode === "word") {
      speakText(popup.word, voiceAccent);
    }

    const targetText = popup.mode === "word" ? popup.sentence : popup.text;
    if (!targetText) return;

    const offlineZh = lookupSentenceTrans(targetText, translations);
    if (offlineZh) {
      setSentenceZh(offlineZh);
      return;
    }

    let cancelled = false;
    setLoadingSentence(true);
    fetchLiveZh(targetText).then((zh) => {
      if (!cancelled) {
        setSentenceZh(zh);
        setLoadingSentence(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [popup, translations, autoSpeak, voiceAccent]);

  const targetSentence = popup ? (popup.mode === "word" ? popup.sentence : popup.text) : "";
  const structure = useMemo(() => {
    if (!targetSentence) return null;
    return analyzeSentenceStructure(targetSentence, dict, lemmas);
  }, [targetSentence, dict, lemmas]);

  if (!popup) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const isMobile = vw <= 768;

  let desktopStyle = {};
  if (!isMobile) {
    const popW = Math.min(440, vw - 24);
    let left = popup.rect.left + popup.rect.width / 2 - popW / 2;
    left = Math.max(12, Math.min(left, vw - popW - 12));
    const placeAbove = popup.rect.bottom + 380 > vh && popup.rect.top > 280;
    const top = placeAbove ? Math.max(12, popup.rect.top - 10) : Math.min(vh - 20, popup.rect.bottom + 10);
    desktopStyle = {
      width: `${popW}px`,
      left: `${left}px`,
      top: `${top}px`,
      transform: placeAbove ? "translateY(-100%)" : "none",
    };
  }

  const renderStructureBlock = () => {
    if (!structure) return null;
    return (
      <div className="structure-box">
        <div className="structure-head">
          <span className="sub-label">
            <GitBranch size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            句子成分分析
          </span>
          <span className="sentence-type-badge">{structure.sentenceType}</span>
        </div>

        <div className="chunks-wrap">
          {structure.chunks.map((c, idx) => (
            <div key={idx} className={`chunk-pill color-${c.color}`}>
              <div className="chunk-role">{c.role}</div>
              <div className="chunk-en">{c.text}</div>
              {c.gloss && <div className="chunk-gloss">{c.gloss}</div>}
            </div>
          ))}
        </div>

        {structure.features.length > 0 && (
          <div className="structure-features">
            {structure.features.map((f, idx) => (
              <span key={idx} className="feature-tag">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (popup.mode === "word") {
    const res = popup.lookup;
    const key = (res?.lemma || popup.word).toLowerCase();
    const isSaved = Boolean(vocabBook[key]);
    const entry = res?.entry;

    return (
      <>
        {isMobile && <div className="sheet-backdrop" onClick={onClose} />}
        <div
          className={`lookup-popover ${isMobile ? "is-bottom-sheet" : ""}`}
          style={desktopStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {isMobile && <div className="sheet-handle" />}
          <div className="popover-header">
            <div>
              <div className="popover-word-row">
                <span className="popover-word">{popup.word}</span>
                {res?.isInflected && <span className="badge-lemma">原形: {res.lemma}</span>}
              </div>
              {(entry?.uk || entry?.us) && (
                <div className="popover-phonetics">
                  {entry.uk && <span>英 /{entry.uk}/</span>}
                  {entry.us && <span>美 /{entry.us}/</span>}
                </div>
              )}
            </div>
            <div className="popover-actions-top">
              <button
                className="icon-btn"
                title="朗读发音"
                onClick={() => speakText(popup.word, voiceAccent)}
              >
                <Volume2 size={18} />
              </button>
              <button className="icon-btn" title="关闭" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="popover-body">
            {entry?.trans?.length ? (
              <ul className="trans-list">
                {entry.trans.slice(0, 5).map((t, idx) => (
                  <li key={idx}>
                    {t.pos && <span className="pos-tag">{t.pos}.</span>}
                    <span>{t.cn}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-tip">离线词库暂未收录该词（可能是人名/地名，帖主建议专有名词可跳过）。</p>
            )}

            {entry?.phrases?.length > 0 && (
              <div className="popover-phrases">
                <div className="sub-label">常见真题搭配（点击可收为词组）</div>
                {entry.phrases.slice(0, 3).map((ph, idx) => (
                  <div key={idx} className="phrase-chip-row">
                    <span>
                      <strong>{ph.p}</strong> — {ph.cn}
                    </span>
                    <button
                      className="mini-add-btn"
                      onClick={() =>
                        onSavePhrase({
                          text: ph.p,
                          meaningSummary: ph.cn,
                          contextSentence: popup.sentence,
                          sectionLabel: popup.sectionLabel,
                        })
                      }
                    >
                      +词组
                    </button>
                  </div>
                ))}
              </div>
            )}

            {popup.sentence && (
              <div className="popover-context">
                <div className="context-head-row">
                  <span className="sub-label">所在原句 & 整句意思：</span>
                  <button
                    className="mini-speak-btn"
                    title="朗读整句"
                    onClick={() => speakText(popup.sentence.replace(/^P\d+\s+/, ""), voiceAccent)}
                  >
                    <Volume2 size={12} /> 读整句
                  </button>
                </div>
                <p className="context-en">{popup.sentence}</p>
                {loadingSentence ? (
                  <p className="sentence-zh-loading">正在翻译整句...</p>
                ) : sentenceZh ? (
                  <p className="sentence-zh-line">{sentenceZh}</p>
                ) : null}

                {renderStructureBlock()}
              </div>
            )}
          </div>

          <div className="popover-footer">
            <button
              className={`btn-mark ${isSaved ? "is-saved" : ""}`}
              onClick={() =>
                onToggleSaveWord({
                  key,
                  word: res?.lemma || popup.word.toLowerCase(),
                  surfaceWord: popup.word,
                  phonetic: entry?.us || entry?.uk || "",
                  trans: entry?.trans || [],
                  meaningSummary: formatTransSummary(entry),
                  contextSentence: popup.sentence,
                  sectionLabel: popup.sectionLabel,
                })
              }
            >
              {isSaved ? (
                <>
                  <BookmarkCheck size={16} /> 已加入自制生词本（点击移出）
                </>
              ) : (
                <>
                  <BookmarkPlus size={16} /> 标记高亮并加入生词本
                </>
              )}
            </button>
          </div>
        </div>
      </>
    );
  }

  // Phrase / Sentence selection mode
  const breakdown = analyzeSelection(popup.text, dict, lemmas);
  const phraseKey = popup.text.toLowerCase().replace(/\s+/g, " ").trim();
  const isPhraseSaved = Boolean(vocabBook[phraseKey]);

  return (
    <>
      {isMobile && <div className="sheet-backdrop" onClick={onClose} />}
      <div
        className={`lookup-popover lookup-popover-wide ${isMobile ? "is-bottom-sheet" : ""}`}
        style={desktopStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && <div className="sheet-handle" />}
        <div className="popover-header">
          <div>
            <div className="popover-phrase-title">整句翻译 · 成分拆解</div>
            <div className="selected-snippet">“{popup.text}”</div>
          </div>
          <div className="popover-actions-top">
            <button className="icon-btn" title="朗读选中内容" onClick={() => speakText(popup.text, voiceAccent)}>
              <Volume2 size={18} />
            </button>
            <button className="icon-btn" title="关闭" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="popover-body">
          <div className="online-trans-row">
            <div className="sub-label">
              <Languages size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
              整句中文意思：
            </div>
            <div className="online-trans-box">
              {loadingSentence ? "正在翻译..." : sentenceZh || "暂未获取到整句译文，请参考下方成分分析与逐词拆解。"}
            </div>
          </div>

          {renderStructureBlock()}

          <div className="sub-label" style={{ marginTop: 10 }}>逐词核心释义（点击 + 单收生词）：</div>
          <div className="breakdown-list">
            {breakdown.length === 0 && <p className="muted-tip">未识别到英文单词。</p>}
            {breakdown.map((item) => {
              const k = item.lemma.toLowerCase();
              const saved = Boolean(vocabBook[k]);
              return (
                <div key={k} className="breakdown-row">
                  <div className="breakdown-main">
                    <strong>{item.token}</strong>
                    {item.phonetic && <span className="mini-phone">/{item.phonetic}/</span>}
                    <span className="mini-cn">{item.summary}</span>
                  </div>
                  <button
                    className={`mini-add-btn ${saved ? "saved" : ""}`}
                    onClick={() =>
                      onToggleSaveWord({
                        key: k,
                        word: item.lemma,
                        surfaceWord: item.token,
                        phonetic: item.phonetic,
                        trans: dict[k]?.trans || [],
                        meaningSummary: item.summary,
                        contextSentence: popup.text,
                        sectionLabel: popup.sectionLabel,
                      })
                    }
                  >
                    {saved ? "已收" : "+生词"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="popover-footer">
          <button
            className={`btn-mark ${isPhraseSaved ? "is-saved" : ""}`}
            onClick={() =>
              onSavePhrase({
                text: popup.text,
                meaningSummary: sentenceZh || breakdown.map((b) => `${b.token}:${b.summary.split("；")[0]}`).join(" | "),
                contextSentence: popup.text,
                sectionLabel: popup.sectionLabel,
                toggle: true,
              })
            }
          >
            <Sparkles size={16} />{" "}
            {isPhraseSaved ? "✓ 已存入自制词组本（点击移出）" : "将选中内容作为词组/难句加入词本"}
          </button>
        </div>
      </div>
    </>
  );
}
