import React, { useEffect, useState } from "react";
import { Volume2, BookmarkPlus, BookmarkCheck, X, Languages, Sparkles } from "lucide-react";
import { analyzeSelection, formatTransSummary, speakText } from "../utils/dictLookup";

export default function LookupPopover({
  popup,
  dict,
  lemmas,
  vocabBook,
  autoSpeak,
  voiceAccent,
  onClose,
  onToggleSaveWord,
  onSavePhrase,
}) {
  const [onlineTrans, setOnlineTrans] = useState("");
  const [loadingOnline, setLoadingOnline] = useState(false);

  useEffect(() => {
    setOnlineTrans("");
    setLoadingOnline(false);
    if (!popup) return;
    if (autoSpeak && popup.mode === "word") {
      speakText(popup.word, voiceAccent);
    }
  }, [popup, autoSpeak, voiceAccent]);

  if (!popup) return null;

  // Position popup safely inside viewport
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const popW = Math.min(390, vw - 24);
  let left = popup.rect.left + popup.rect.width / 2 - popW / 2;
  left = Math.max(12, Math.min(left, vw - popW - 12));

  const placeAbove = popup.rect.bottom + 320 > vh && popup.rect.top > 260;
  const top = placeAbove ? Math.max(12, popup.rect.top - 10) : Math.min(vh - 20, popup.rect.bottom + 10);

  const style = {
    width: `${popW}px`,
    left: `${left}px`,
    top: `${top}px`,
    transform: placeAbove ? "translateY(-100%)" : "none",
  };

  if (popup.mode === "word") {
    const res = popup.lookup;
    const key = (res?.lemma || popup.word).toLowerCase();
    const isSaved = Boolean(vocabBook[key]);
    const entry = res?.entry;

    return (
      <div className="lookup-popover" style={style} onClick={(e) => e.stopPropagation()}>
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
              <Volume2 size={17} />
            </button>
            <button className="icon-btn" title="关闭" onClick={onClose}>
              <X size={17} />
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
              <span className="sub-label">所在原句：</span>
              <p>{popup.sentence}</p>
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
    );
  }

  // Phrase / Sentence selection mode
  const breakdown = analyzeSelection(popup.text, dict, lemmas);
  const phraseKey = popup.text.toLowerCase().replace(/\s+/g, " ").trim();
  const isPhraseSaved = Boolean(vocabBook[phraseKey]);

  const handleOnlineTranslate = async () => {
    setLoadingOnline(true);
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(popup.text.slice(0, 450))}&langpair=en|zh-CN`
      );
      const data = await res.json();
      setOnlineTrans(data?.responseData?.translatedText || "翻译服务暂不可用，请参考逐词拆解或右侧真题解析。");
    } catch {
      setOnlineTrans("离线状态下无法连接在线翻译，可参考下方逐词释义或右侧真题解析。");
    } finally {
      setLoadingOnline(false);
    }
  };

  return (
    <div className="lookup-popover lookup-popover-wide" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="popover-header">
        <div>
          <div className="popover-phrase-title">划词词组 / 整句拆解</div>
          <div className="selected-snippet">“{popup.text}”</div>
        </div>
        <div className="popover-actions-top">
          <button className="icon-btn" title="朗读选中内容" onClick={() => speakText(popup.text, voiceAccent)}>
            <Volume2 size={17} />
          </button>
          <button className="icon-btn" title="关闭" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="popover-body">
        <div className="online-trans-row">
          <button className="btn-secondary-sm" onClick={handleOnlineTranslate} disabled={loadingOnline}>
            <Languages size={14} /> {loadingOnline ? "翻译中..." : "在线整句参考译文"}
          </button>
          {onlineTrans && <div className="online-trans-box">{onlineTrans}</div>}
        </div>

        <div className="sub-label">逐词核心释义（点击 + 单收生词）：</div>
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
              meaningSummary: onlineTrans || breakdown.map((b) => `${b.token}:${b.summary.split("；")[0]}`).join(" | "),
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
  );
}
