import React, { useEffect, useMemo, useState } from "react";
import {
  Zap,
  CalendarCheck,
  Volume2,
  Check,
  X,
  RotateCcw,
  ArrowRight,
  Flame,
  BookMarked,
  AlertTriangle,
} from "lucide-react";
import { formatTransSummary, speakText } from "../utils/dictLookup";
import { getTodayStr } from "../utils/storage";

export default function SpeedCramView({
  papers,
  cet4Core,
  cet4Syllabus,
  vocabBook,
  coreProgress,
  settings,
  dailyStats,
  initialDeck = "my-paper",
  initialPaperFilter = "all",
  onRecordResult,
  onClearMistake,
  onJumpToReader,
}) {
  const [studyMode, setStudyMode] = useState("cram"); // "cram" | "daily21"
  const [deck, setDeck] = useState(initialDeck);
  const [paperFilter, setPaperFilter] = useState(initialPaperFilter);
  const [dailyRatioPreset, setDailyRatioPreset] = useState(50); // 50 new : 100 review (or 100:200)
  const [shuffleOrder, setShuffleOrder] = useState(false);

  const [queue, setQueue] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [revealedWrong, setRevealedWrong] = useState(false);
  const [sessionKnown, setSessionKnown] = useState(0);
  const [sessionWrong, setSessionWrong] = useState([]);

  useEffect(() => {
    setDeck(initialDeck);
    setPaperFilter(initialPaperFilter);
  }, [initialDeck, initialPaperFilter]);

  // Unified item normalizer
  const buildCardFromVocab = (v) => ({
    id: v.id,
    sourceType: "vocabBook",
    word: v.text,
    phonetic: v.phonetic || "",
    meaning: v.meaningSummary || formatTransSummary(v),
    context: v.contextSentence || "",
    meta: `${v.sourcePaperLabel || "真题"} · ${v.sourceSection || ""}`,
    isPhrase: v.isPhrase,
    inMistakeBook: Boolean(v.inMistakeBook),
    reviewCount: v.reviewCount || 0,
    addedDate: v.addedDate,
  });

  const buildCardFromBookWord = (w, bookName) => {
    const k = w.word.toLowerCase();
    const prog = coreProgress[k] || {};
    return {
      id: k,
      sourceType: "coreProgress",
      word: w.word,
      phonetic: w.us || w.uk || "",
      meaning: formatTransSummary(w),
      context: w.sentences?.[0] ? `${w.sentences[0].en}（${w.sentences[0].cn}）` : "",
      meta: bookName,
      phrases: w.phrases || [],
      inMistakeBook: Boolean(prog.inMistakeBook),
      reviewCount: prog.knowCount || 0,
    };
  };

  // Compute available decks & counts
  const yesterdayStr = getTodayStr(-1);
  const vocabAll = useMemo(() => Object.values(vocabBook).map(buildCardFromVocab), [vocabBook]);
  const yesterdayVocab = useMemo(
    () => vocabAll.filter((v) => v.addedDate === yesterdayStr),
    [vocabAll, yesterdayStr]
  );

  const mistakeCards = useMemo(() => {
    const list = [];
    for (const v of vocabAll) {
      if (v.inMistakeBook) list.push(v);
    }
    const coreMap = new Map();
    for (const w of cet4Core) coreMap.set(w.word.toLowerCase(), w);
    for (const w of cet4Syllabus) {
      const k = w.word.toLowerCase();
      if (!coreMap.has(k)) coreMap.set(k, w);
    }
    for (const [k, prog] of Object.entries(coreProgress)) {
      if (prog.inMistakeBook && !vocabBook[k] && coreMap.has(k)) {
        list.push(buildCardFromBookWord(coreMap.get(k), "词库错词"));
      }
    }
    return list;
  }, [vocabAll, coreProgress, cet4Core, cet4Syllabus, vocabBook]);

  const buildQueue = (targetDeck = deck, targetMode = studyMode, targetPaper = paperFilter) => {
    let pool = [];
    if (targetDeck === "my-paper") {
      if (targetPaper === "yesterday") {
        pool = yesterdayVocab;
      } else if (targetPaper === "all") {
        pool = vocabAll;
      } else {
        pool = vocabAll.filter((v) =>
          Object.values(vocabBook).find((raw) => raw.id === v.id)?.sourcePaperId === targetPaper
        );
      }
    } else if (targetDeck === "mistakes") {
      pool = mistakeCards;
    } else if (targetDeck === "cet4-core") {
      pool = cet4Core.map((w) => buildCardFromBookWord(w, "四级真题核心词汇"));
    } else if (targetDeck === "cet4-syllabus") {
      pool = cet4Syllabus.map((w) => buildCardFromBookWord(w, "四级大纲词汇"));
    }

    if (targetMode === "daily21") {
      // 2:1 ratio: review words (2x) vs unseen new words (1x)
      const reviewPool = pool.filter((c) => c.reviewCount > 0 || c.inMistakeBook || c.addedDate === yesterdayStr);
      const newPool = pool.filter((c) => c.reviewCount === 0 && !c.inMistakeBook && c.addedDate !== yesterdayStr);
      const targetNew = Math.min(dailyRatioPreset, newPool.length);
      const targetReview = Math.min(dailyRatioPreset * 2, reviewPool.length);
      const pickedReview = reviewPool.slice(0, targetReview);
      const pickedNew = newPool.slice(0, targetNew);
      // Interleave 2 review : 1 new
      const mixed = [];
      let ri = 0;
      let ni = 0;
      while (ri < pickedReview.length || ni < pickedNew.length) {
        if (ri < pickedReview.length) mixed.push(pickedReview[ri++]);
        if (ri < pickedReview.length) mixed.push(pickedReview[ri++]);
        if (ni < pickedNew.length) mixed.push(pickedNew[ni++]);
      }
      pool = mixed.length > 0 ? mixed : pool.slice(0, dailyRatioPreset * 3);
    }

    if (shuffleOrder) {
      pool = [...pool].sort(() => Math.random() - 0.5);
    }

    setQueue(pool);
    setCursor(0);
    setRevealedWrong(false);
    setSessionKnown(0);
    setSessionWrong([]);
  };

  useEffect(() => {
    buildQueue(deck, studyMode, paperFilter);
  }, [deck, studyMode, paperFilter, dailyRatioPreset, shuffleOrder]);

  const currentCard = queue[cursor] || null;

  useEffect(() => {
    if (currentCard && settings.autoSpeak && !revealedWrong) {
      speakText(currentCard.word, settings.voiceAccent);
    }
  }, [cursor, currentCard?.id, studyMode, deck]);

  const advanceCard = () => {
    setRevealedWrong(false);
    setCursor((c) => c + 1);
  };

  const handleKnow = () => {
    if (!currentCard || revealedWrong) return;
    setSessionKnown((n) => n + 1);
    onRecordResult(currentCard, true, studyMode);
    advanceCard();
  };

  const handleDontKnow = () => {
    if (!currentCard) return;
    if (!revealedWrong) {
      setRevealedWrong(true);
      setSessionWrong((prev) => [...prev, currentCard]);
      onRecordResult(currentCard, false, studyMode);
    } else {
      advanceCard();
    }
  };

  // Keyboard shortcuts for ultra-fast cramming
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      if (!currentCard) return;
      if (e.code === "Space" || e.key === "j" || e.key === "J" || e.key === "ArrowRight") {
        e.preventDefault();
        if (revealedWrong) {
          advanceCard();
        } else {
          handleKnow();
        }
      } else if (e.key === "f" || e.key === "F" || e.key === "k" || e.key === "K" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleDontKnow();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        speakText(currentCard.word, settings.voiceAccent);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentCard, revealedWrong, settings.voiceAccent]);

  const isDone = queue.length > 0 && cursor >= queue.length;

  return (
    <div className="cram-workspace">
      {/* Top Controls */}
      <div className="cram-controls-card">
        <div className="cram-mode-row">
          <div className="mode-pills">
            <button
              className={`mode-pill ${studyMode === "cram" ? "active" : ""}`}
              onClick={() => setStudyMode("cram")}
            >
              <Zap size={15} />
              <span>备考速刷模式</span>
              <small>快速 · 大量 · 不卡词</small>
            </button>
            <button
              className={`mode-pill ${studyMode === "daily21" ? "active" : ""}`}
              onClick={() => setStudyMode("daily21")}
            >
              <CalendarCheck size={15} />
              <span>首页 2:1 复习新学</span>
              <small>2倍复习 : 1倍新词</small>
            </button>
          </div>

          <div className="cram-today-stats">
            <span>
              <Flame size={14} /> 今日已刷 <strong>{dailyStats.crammed}</strong> 词
            </span>
            <span>
              复习 <strong>{dailyStats.reviewed}</strong> / 新学 <strong>{dailyStats.learned}</strong>
            </span>
          </div>
        </div>

        <div className="deck-selector-row">
          <button
            className={`deck-chip ${deck === "my-paper" ? "active" : ""}`}
            onClick={() => setDeck("my-paper")}
          >
            <BookMarked size={14} /> 我的真题自制词本 ({vocabAll.length})
          </button>
          <button
            className={`deck-chip ${deck === "mistakes" ? "active" : ""}`}
            onClick={() => setDeck("mistakes")}
          >
            <AlertTriangle size={14} /> 错词本 ({mistakeCards.length})
          </button>
          <button
            className={`deck-chip ${deck === "cet4-core" ? "active" : ""}`}
            onClick={() => setDeck("cet4-core")}
          >
            四级真题核心词 ({cet4Core.length})
          </button>
          <button
            className={`deck-chip ${deck === "cet4-syllabus" ? "active" : ""}`}
            onClick={() => setDeck("cet4-syllabus")}
          >
            四级大纲词库 ({cet4Syllabus.length})
          </button>
        </div>

        <div className="cram-subbar">
          {deck === "my-paper" && (
            <div className="filter-group">
              <label>筛选真题范围：</label>
              <select value={paperFilter} onChange={(e) => setPaperFilter(e.target.value)}>
                <option value="all">全部真题生词 ({vocabAll.length})</option>
                <option value="yesterday">昨日真题新增·必过一轮 ({yesterdayVocab.length})</option>
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.set}
                  </option>
                ))}
              </select>
            </div>
          )}

          {studyMode === "daily21" && (
            <div className="filter-group">
              <label>2:1 每日体量：</label>
              <select value={dailyRatioPreset} onChange={(e) => setDailyRatioPreset(Number(e.target.value))}>
                <option value={20}>轻量：40复习 + 20新学</option>
                <option value={50}>标准：100复习 + 50新学</option>
                <option value={100}>帖子同款冲刺：200复习 + 100新学</option>
              </select>
            </div>
          )}

          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={shuffleOrder}
              onChange={(e) => setShuffleOrder(e.target.checked)}
            />
            <span>乱序速刷</span>
          </label>

          <button className="btn-secondary-sm" onClick={() => buildQueue(deck, studyMode, paperFilter)}>
            <RotateCcw size={14} /> 重新开一轮
          </button>
        </div>
      </div>

      {/* Flashcard Stage */}
      <div className="cram-stage">
        {queue.length === 0 ? (
          <div className="empty-stage">
            <h3>当前词本暂无待刷单词</h3>
            <p>
              {deck === "mistakes"
                ? "太棒了！错词本已经清空。"
                : "快去「真题划词精读」打开 2026 年 6 月真题，点选你不认识的单词加入自制词本吧！"}
            </p>
            <button className="btn-primary" onClick={onJumpToReader}>
              前往 2026年6月 真题划词精读
            </button>
          </div>
        ) : isDone ? (
          <div className="round-done-card">
            <div className="done-badge">🎉 本轮完成</div>
            <h3>本轮共刷完 {queue.length} 个词</h3>
            <div className="done-metrics">
              <div className="metric-box green">
                <span>认识直接过</span>
                <strong>{sessionKnown}</strong>
              </div>
              <div className="metric-box red">
                <span>进入错词本</span>
                <strong>{sessionWrong.length}</strong>
              </div>
            </div>
            <p className="done-tip">
              帖子心得：速刷不要在一轮里死扣，把“认识率”交给轮数和重复次数，明天再刷一遍效果翻倍！
            </p>
            <div className="done-actions">
              {sessionWrong.length > 0 && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setDeck("mistakes");
                    buildQueue("mistakes", "cram");
                  }}
                >
                  <Zap size={16} /> 立即再刷一遍错词本 ({mistakeCards.length})
                </button>
              )}
              <button className="btn-secondary" onClick={() => buildQueue(deck, studyMode, paperFilter)}>
                <RotateCcw size={16} /> 开启下一轮速刷
              </button>
            </div>
          </div>
        ) : (
          <div className="flashcard">
            <div className="flashcard-progress-bar">
              <div
                className="flashcard-progress-fill"
                style={{ width: `${Math.round(((cursor + 1) / queue.length) * 100)}%` }}
              />
            </div>

            <div className="flashcard-top">
              <span className="card-index">
                {cursor + 1} / {queue.length}
              </span>
              <span className="card-meta-tag">
                {currentCard.meta}
                {currentCard.inMistakeBook && <em className="mistake-pill">错词本</em>}
              </span>
            </div>

            <div className="flashcard-center">
              <div className="card-word-row">
                <h1 className="card-word">{currentCard.word}</h1>
                <button
                  className="speak-circle-btn"
                  title="朗读 (快捷键 R)"
                  onClick={() => speakText(currentCard.word, settings.voiceAccent)}
                >
                  <Volume2 size={20} />
                </button>
              </div>
              {currentCard.phonetic && <div className="card-phonetic">/{currentCard.phonetic}/</div>}

              {revealedWrong ? (
                <div className="card-reveal-box">
                  <div className="reveal-meaning">{currentCard.meaning}</div>
                  {currentCard.context && (
                    <div className="reveal-context">
                      <span>语境原句：</span>
                      {currentCard.context}
                    </div>
                  )}
                  {currentCard.phrases?.length > 0 && (
                    <div className="reveal-phrases">
                      {currentCard.phrases.slice(0, 2).map((p, idx) => (
                        <span key={idx} className="mini-phrase-pill">
                          {p.p} · {p.cn}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mistake-notice">
                    已自动收入「错词本」，不打断本轮节奏，继续下一个！
                  </div>
                </div>
              ) : (
                <div className="card-prompt-hint">
                  看到单词第一时间反应出中文意思了吗？
                </div>
              )}
            </div>

            <div className="flashcard-actions">
              {!revealedWrong ? (
                <>
                  <button className="btn-unknow" onClick={handleDontKnow}>
                    <X size={18} />
                    <span>不会 · 记入错词本</span>
                    <kbd>F / ←</kbd>
                  </button>
                  <button className="btn-know" onClick={handleKnow}>
                    <Check size={18} />
                    <span>认识 · 直接过</span>
                    <kbd>Space / J</kbd>
                  </button>
                </>
              ) : (
                <button className="btn-next-fast" onClick={advanceCard}>
                  <span>下一个单词</span>
                  <ArrowRight size={18} />
                  <kbd>Space / Enter</kbd>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
