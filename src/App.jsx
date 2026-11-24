import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Zap,
  Bookmark,
  Volume2,
  VolumeX,
  HelpCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import PaperReaderView from "./components/PaperReaderView";
import SpeedCramView from "./components/SpeedCramView";
import VocabManagerView from "./components/VocabManagerView";
import LookupPopover from "./components/LookupPopover";
import GuideModal from "./components/GuideModal";
import { lookupWord, normalizeWord } from "./utils/dictLookup";
import {
  getTodayStr,
  importAllBackup,
  loadCoreProgress,
  loadDailyStats,
  loadSettings,
  loadVocabBook,
  saveCoreProgress,
  saveDailyStats,
  saveSettings,
  saveVocabBook,
} from "./utils/storage";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [papers, setPapers] = useState([]);
  const [cet4Core, setCet4Core] = useState([]);
  const [cet4Syllabus, setCet4Syllabus] = useState([]);
  const [dict, setDict] = useState({});
  const [lemmas, setLemmas] = useState({});
  const [translations, setTranslations] = useState({});
  const justSelectedRef = useRef(false);

  const [tab, setTab] = useState("reader"); // "reader" | "cram" | "vocab"
  const [selectedPaperId, setSelectedPaperId] = useState("2026-06-1");
  const [cramLaunch, setCramLaunch] = useState({ deck: "my-paper", paperFilter: "all" });

  const [vocabBook, setVocabBook] = useState(() => loadVocabBook());
  const [coreProgress, setCoreProgress] = useState(() => loadCoreProgress());
  const [settings, setSettings] = useState(() => loadSettings());
  const [dailyStats, setDailyStats] = useState(() => loadDailyStats());

  const [popup, setPopup] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const [pRes, cRes, sRes, dRes, lRes, tRes] = await Promise.all([
          fetch("./data/papers.json").then((r) => r.json()),
          fetch("./data/cet4_core.json").then((r) => r.json()),
          fetch("./data/cet4_syllabus.json").then((r) => r.json()),
          fetch("./data/dict.json").then((r) => r.json()),
          fetch("./data/lemmas.json").then((r) => r.json()),
          fetch("./data/translations.json").then((r) => r.json()).catch(() => ({})),
        ]);
        if (!alive) return;
        setPapers(pRes);
        setCet4Core(cRes);
        setCet4Syllabus(sRes);
        setDict(dRes);
        setLemmas(lRes);
        setTranslations(tRes || {});
        if (pRes.length > 0 && !pRes.find((p) => p.id === "2026-06-1")) {
          setSelectedPaperId(pRes[0].id);
        }
        setLoading(false);
      } catch (e) {
        if (!alive) return;
        setLoadErr("真题或词典数据加载失败：" + (e.message || e));
        setLoading(false);
      }
    }
    init();
    return () => {
      alive = false;
    };
  }, []);

  // Close popover when clicking outside, but don't kill a selection popup right after mouseup
  useEffect(() => {
    const onGlobalClick = () => {
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }
      setPopup(null);
    };
    window.addEventListener("click", onGlobalClick);
    return () => window.removeEventListener("click", onGlobalClick);
  }, []);

  const currentPaper = useMemo(
    () => papers.find((p) => p.id === selectedPaperId) || papers[0],
    [papers, selectedPaperId]
  );

  const savedWordsSet = useMemo(() => {
    const set = new Set();
    for (const item of Object.values(vocabBook)) {
      if (!item.isPhrase) {
        set.add(normalizeWord(item.text));
        if (item.lemma) set.add(normalizeWord(item.lemma));
      }
    }
    return set;
  }, [vocabBook]);

  const updateVocabBook = (updater) => {
    setVocabBook((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveVocabBook(next);
      return next;
    });
  };

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const handleWordClick = (word, sentence, rect, sectionLabel) => {
    const lookup = lookupWord(word, dict, lemmas);
    setPopup({
      mode: "word",
      word,
      sentence,
      rect,
      sectionLabel,
      lookup,
    });
  };

  const handleTextSelect = (text, rect, sectionLabel) => {
    justSelectedRef.current = true;
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 250);
    setPopup({
      mode: "selection",
      text,
      rect,
      sectionLabel,
    });
  };

  const handleToggleSaveWord = ({
    key,
    word,
    phonetic,
    trans,
    meaningSummary,
    contextSentence,
    sectionLabel,
  }) => {
    const normKey = key.toLowerCase();
    updateVocabBook((prev) => {
      const next = { ...prev };
      if (next[normKey]) {
        delete next[normKey];
      } else {
        const now = new Date();
        next[normKey] = {
          id: normKey,
          text: word,
          lemma: normKey,
          isPhrase: false,
          phonetic,
          trans,
          meaningSummary,
          sourcePaperId: currentPaper?.id || "",
          sourcePaperLabel: currentPaper ? `${currentPaper.label} ${currentPaper.set}` : "",
          sourceSection: sectionLabel || "真题精读",
          contextSentence: contextSentence || "",
          addedAt: now.toISOString(),
          addedDate: getTodayStr(),
          reviewCount: 0,
          knowCount: 0,
          wrongCount: 0,
          inMistakeBook: false,
        };
      }
      return next;
    });
  };

  const handleSavePhrase = ({ text, meaningSummary, contextSentence, sectionLabel, toggle }) => {
    const clean = text.replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (!key) return;
    updateVocabBook((prev) => {
      const next = { ...prev };
      if (toggle && next[key]) {
        delete next[key];
      } else {
        next[key] = {
          id: key,
          text: clean,
          lemma: key,
          isPhrase: true,
          phonetic: "",
          trans: [],
          meaningSummary: meaningSummary || "真题词组/难句",
          sourcePaperId: currentPaper?.id || "",
          sourcePaperLabel: currentPaper ? `${currentPaper.label} ${currentPaper.set}` : "",
          sourceSection: sectionLabel || "真题词组",
          contextSentence: contextSentence || clean,
          addedAt: new Date().toISOString(),
          addedDate: getTodayStr(),
          reviewCount: 0,
          knowCount: 0,
          wrongCount: 0,
          inMistakeBook: false,
        };
      }
      return next;
    });
  };

  const handleRecordResult = (card, isKnown, mode) => {
    const today = getTodayStr();
    const wasNew = card.reviewCount === 0;

    setDailyStats((prev) => {
      const base = prev.date === today ? prev : { date: today, reviewed: 0, learned: 0, crammed: 0, rounds: 0 };
      const next = {
        ...base,
        crammed: base.crammed + 1,
        reviewed: base.reviewed + (wasNew ? 0 : 1),
        learned: base.learned + (wasNew ? 1 : 0),
      };
      saveDailyStats(next);
      return next;
    });

    if (card.sourceType === "vocabBook") {
      updateVocabBook((prev) => {
        const cur = prev[card.id];
        if (!cur) return prev;
        return {
          ...prev,
          [card.id]: {
            ...cur,
            reviewCount: (cur.reviewCount || 0) + 1,
            knowCount: (cur.knowCount || 0) + (isKnown ? 1 : 0),
            wrongCount: (cur.wrongCount || 0) + (isKnown ? 0 : 1),
            inMistakeBook: isKnown ? false : true,
            lastReviewedAt: new Date().toISOString(),
          },
        };
      });
    } else {
      setCoreProgress((prev) => {
        const cur = prev[card.id] || { knowCount: 0, wrongCount: 0, inMistakeBook: false };
        const next = {
          ...prev,
          [card.id]: {
            knowCount: cur.knowCount + (isKnown ? 1 : 0),
            wrongCount: cur.wrongCount + (isKnown ? 0 : 1),
            inMistakeBook: isKnown ? false : true,
            lastSeenAt: new Date().toISOString(),
          },
        };
        saveCoreProgress(next);
        return next;
      });
    }
  };

  const handleRemoveVocab = (id) => {
    updateVocabBook((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleToggleMistake = (id) => {
    updateVocabBook((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return {
        ...prev,
        [id]: { ...cur, inMistakeBook: !cur.inMistakeBook },
      };
    });
  };

  const handleImportBackup = (jsonText) => {
    importAllBackup(jsonText);
    setVocabBook(loadVocabBook());
    setCoreProgress(loadCoreProgress());
    setSettings(loadSettings());
    alert("备份数据恢复成功！");
  };

  const yesterdayStr = getTodayStr(-1);
  const yesterdayCount = useMemo(
    () => Object.values(vocabBook).filter((v) => v.addedDate === yesterdayStr).length,
    [vocabBook, yesterdayStr]
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 size={34} className="spin" />
        <h3>正在加载 2025–2026 四级真题与离线划词词库...</h3>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="loading-screen">
        <h3>加载出错</h3>
        <p>{loadErr}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">
          <div className="brand-badge">CET-4</div>
          <div>
            <h1>四级划词工坊</h1>
            <span>2026年6月起点 · 含2025全年9套真题</span>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab ${tab === "reader" ? "active" : ""}`}
            onClick={() => setTab("reader")}
          >
            <BookOpen size={16} />
            <span>① 真题划词精读</span>
          </button>
          <button
            className={`nav-tab ${tab === "cram" ? "active" : ""}`}
            onClick={() => setTab("cram")}
          >
            <Zap size={16} />
            <span>② 备考速刷 & 2:1</span>
          </button>
          <button
            className={`nav-tab ${tab === "vocab" ? "active" : ""}`}
            onClick={() => setTab("vocab")}
          >
            <Bookmark size={16} />
            <span>自制词本 ({Object.keys(vocabBook).length})</span>
          </button>
        </nav>

        <div className="nav-right">
          {yesterdayCount > 0 && (
            <button
              className="yesterday-pill"
              title="昨日真题捞出的生词，今天务必过一轮"
              onClick={() => {
                setCramLaunch({ deck: "my-paper", paperFilter: "yesterday" });
                setTab("cram");
              }}
            >
              <Calendar size={14} /> 昨日生词待刷 ({yesterdayCount})
            </button>
          )}

          <button
            className={`sound-toggle ${settings.autoSpeak ? "on" : ""}`}
            title="置顶经验：初期背新词建议放出声音辅助记忆"
            onClick={() => updateSettings({ autoSpeak: !settings.autoSpeak })}
          >
            {settings.autoSpeak ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{settings.autoSpeak ? "外放已开" : "外放已关"}</span>
          </button>

          <button
            className="accent-btn"
            onClick={() => updateSettings({ voiceAccent: settings.voiceAccent === "us" ? "uk" : "us" })}
          >
            {settings.voiceAccent === "us" ? "美音" : "英音"}
          </button>

          <button className="guide-btn" onClick={() => setGuideOpen(true)}>
            <HelpCircle size={15} />
            <span>背词方法</span>
          </button>
        </div>
      </header>

      <main className="main-container">
        {tab === "reader" && (
          <PaperReaderView
            papers={papers}
            selectedPaperId={selectedPaperId}
            onSelectPaper={(id) => {
              setPopup(null);
              setSelectedPaperId(id);
            }}
            vocabBook={vocabBook}
            savedWordsSet={savedWordsSet}
            lemmas={lemmas}
            translations={translations}
            voiceAccent={settings.voiceAccent}
            onWordClick={handleWordClick}
            onTextSelect={handleTextSelect}
            onRemoveVocab={handleRemoveVocab}
            onGoCramPaper={(paperId) => {
              setCramLaunch({ deck: "my-paper", paperFilter: paperId });
              setTab("cram");
            }}
          />
        )}

        {tab === "cram" && (
          <SpeedCramView
            papers={papers}
            cet4Core={cet4Core}
            cet4Syllabus={cet4Syllabus}
            vocabBook={vocabBook}
            coreProgress={coreProgress}
            settings={settings}
            dailyStats={dailyStats}
            initialDeck={cramLaunch.deck}
            initialPaperFilter={cramLaunch.paperFilter}
            onRecordResult={handleRecordResult}
            onJumpToReader={() => setTab("reader")}
          />
        )}

        {tab === "vocab" && (
          <VocabManagerView
            papers={papers}
            vocabBook={vocabBook}
            voiceAccent={settings.voiceAccent}
            onRemoveVocab={handleRemoveVocab}
            onToggleMistake={handleToggleMistake}
            onImportBackup={handleImportBackup}
            onGoCram={(deck, filter) => {
              setCramLaunch({ deck, paperFilter: filter });
              setTab("cram");
            }}
          />
        )}
      </main>

      <LookupPopover
        popup={popup}
        dict={dict}
        lemmas={lemmas}
        translations={translations}
        vocabBook={vocabBook}
        autoSpeak={settings.autoSpeak}
        voiceAccent={settings.voiceAccent}
        onClose={() => setPopup(null)}
        onToggleSaveWord={handleToggleSaveWord}
        onSavePhrase={handleSavePhrase}
      />

      {/* Mobile Fixed Bottom Navigation (iPhone 15 Pro Max thumb-friendly) */}
      <nav className="mobile-bottom-nav" aria-label="移动端主导航">
        <button
          className={`mb-tab ${tab === "reader" ? "active" : ""}`}
          onClick={() => setTab("reader")}
        >
          <BookOpen size={19} />
          <span>真题划词</span>
        </button>
        <button
          className={`mb-tab ${tab === "cram" ? "active" : ""}`}
          onClick={() => setTab("cram")}
        >
          <Zap size={19} />
          <span>备考速刷</span>
        </button>
        <button
          className={`mb-tab ${tab === "vocab" ? "active" : ""}`}
          onClick={() => setTab("vocab")}
        >
          <Bookmark size={19} />
          <span>词本 ({Object.keys(vocabBook).length})</span>
        </button>
      </nav>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
