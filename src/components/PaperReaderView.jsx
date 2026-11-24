import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Headphones,
  FileText,
  PenTool,
  Layers,
  Eye,
  EyeOff,
  Zap,
  Volume2,
  Trash2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import InteractiveText from "./InteractiveText";
import HlsAudioPlayer from "./HlsAudioPlayer";
import { fetchLiveZh, lookupSentenceTrans, speakText } from "../utils/dictLookup";

const MODULES = [
  { key: "reading", label: "仔细阅读", icon: BookOpen, badge: "核心" },
  { key: "cloze", label: "选词填空", icon: Layers },
  { key: "listening", label: "听力词句", icon: Headphones },
  { key: "subjective", label: "写作与翻译", icon: PenTool },
  { key: "matching", label: "长篇阅读 (选读)", icon: FileText },
];

function splitParagraphs(text) {
  if (!text) return [];
  // Normalize P1/P2 markers into paragraphs if single line
  const normalized = text
    .replace(/\s+(P\d+\s)/g, "\n$1")
    .replace(/\s+([A-Z]\)\s)/g, "\n$1");
  return normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function PaperReaderView({
  papers,
  selectedPaperId,
  onSelectPaper,
  vocabBook,
  savedWordsSet,
  lemmas,
  translations,
  voiceAccent,
  onWordClick,
  onTextSelect,
  onInspectSentence,
  onRemoveVocab,
  onGoCramPaper,
}) {
  const [activeModule, setActiveModule] = useState("reading");
  const [showExplain, setShowExplain] = useState(false);
  const [showBilingual, setShowBilingual] = useState(false);
  const [openParaZh, setOpenParaZh] = useState({});
  const [liveParaZh, setLiveParaZh] = useState({});
  const [showMatchingBody, setShowMatchingBody] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});

  const toggleParaZh = async (key, paraText) => {
    const willOpen = !openParaZh[key];
    setOpenParaZh((prev) => ({ ...prev, [key]: willOpen }));
    if (willOpen && !lookupSentenceTrans(paraText, translations) && !liveParaZh[key]) {
      const zh = await fetchLiveZh(paraText);
      if (zh) setLiveParaZh((prev) => ({ ...prev, [key]: zh }));
    }
  };

  const renderParaWithTrans = (para, key, sectionLabel) => {
    const paraZh = lookupSentenceTrans(para, translations) || liveParaZh[key];
    const isVisible = showBilingual || openParaZh[key];
    return (
      <div key={key} className="para-block">
        <p className="passage-para">
          <InteractiveText
            text={para}
            savedWordsSet={savedWordsSet}
            lemmas={lemmas}
            onWordClick={onWordClick}
            onTextSelect={onTextSelect}
            sectionLabel={sectionLabel}
          />
          <button
            className={`para-trans-btn ${isVisible ? "active" : ""}`}
            title="查看/收起本段中文意思"
            onClick={() => toggleParaZh(key, para)}
          >
            译
          </button>
        </p>
        {isVisible && (
          <div className="para-zh-box">{paraZh || "正在获取本段中文翻译..."}</div>
        )}
      </div>
    );
  };

  const currentPaper = useMemo(
    () => papers.find((p) => p.id === selectedPaperId) || papers[0],
    [papers, selectedPaperId]
  );

  // Group papers explicitly by year + month
  const paperGroups = useMemo(() => {
    const map = new Map();
    for (const p of papers) {
      const groupKey = `${p.year}-${p.month}`;
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          label: p.label, // e.g., "2026年6月"
          isStart: groupKey === "2026-06",
          items: [],
        });
      }
      map.get(groupKey).items.push(p);
    }
    return Array.from(map.values());
  }, [papers]);

  const paperVocabList = useMemo(() => {
    return Object.values(vocabBook)
      .filter((v) => v.sourcePaperId === currentPaper?.id)
      .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
  }, [vocabBook, currentPaper]);

  const countsByPaper = useMemo(() => {
    const counts = {};
    for (const v of Object.values(vocabBook)) {
      if (v.sourcePaperId) counts[v.sourcePaperId] = (counts[v.sourcePaperId] || 0) + 1;
    }
    return counts;
  }, [vocabBook]);

  if (!currentPaper) return null;

  const readingQuestions = currentPaper.questions.filter((q) => q.part === "reading");
  // Group careful reading into Passage 1 (46-50) and Passage 2 (51-55)
  const readingPassages = useMemo(() => {
    const groups = [];
    for (const q of readingQuestions) {
      let grp = groups.find((g) => g.passage === q.passage);
      if (!grp) {
        grp = { title: `Passage ${groups.length + 1}`, passage: q.passage || "", questions: [] };
        groups.push(grp);
      }
      grp.questions.push(q);
    }
    return groups;
  }, [readingQuestions]);

  const clozeQuestions = currentPaper.questions.filter((q) => q.part === "cloze");
  const clozePassage = clozeQuestions[0]?.passage || "";
  const clozeBank = clozeQuestions[0]?.wordBank || {};

  const listeningQuestions = currentPaper.questions.filter((q) => q.part === "listening");
  const matchingQuestions = currentPaper.questions.filter((q) => q.part === "matching");
  const matchingPassage = matchingQuestions[0]?.passage || "";

  const handleChooseOption = (qNo, optLetter) => {
    setUserAnswers((prev) => ({
      ...prev,
      [`${currentPaper.id}_${qNo}`]: optLetter,
    }));
  };

  return (
    <div className="reader-workspace">
      {/* Month-grouped Paper Strip */}
      <div className="paper-selector-bar">
        {paperGroups.map((group) => (
          <div key={group.key} className={`month-group ${group.isStart ? "is-featured" : ""}`}>
            <div className="month-group-title">
              <span>{group.label}</span>
              {group.isStart && <span className="start-pill">起点推荐</span>}
            </div>
            <div className="month-sets">
              {group.items.map((p) => {
                const active = p.id === currentPaper.id;
                const count = countsByPaper[p.id] || 0;
                return (
                  <button
                    key={p.id}
                    className={`paper-set-btn ${active ? "active" : ""}`}
                    onClick={() => onSelectPaper(p.id)}
                  >
                    <span>{p.set}</span>
                    {count > 0 && <span className="set-vocab-badge">{count}词</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Main Split Layout: Exam Reader + Live Marked Vocab Drawer */}
      <div className="reader-main-grid">
        <div className="reader-left-column">
          {/* Paper Header & Module Tabs */}
          <div className="paper-toolbar">
            <div className="paper-heading-row">
              <div>
                <h2>
                  {currentPaper.label} 英语四级真题（{currentPaper.set}）
                </h2>
                <p className="paper-hint">
                  💡 操作提示：<strong>单击任意英文单词</strong>即查音标释义并高亮收藏；<strong>鼠标划选词组或整句</strong>可拆解搭配并对照下方解析。
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className={`btn-toggle-explain ${showBilingual ? "is-on" : ""}`}
                  onClick={() => setShowBilingual((v) => !v)}
                >
                  <span>{showBilingual ? "✓ 已开全文译文" : "双语对照译文"}</span>
                </button>
                <button
                  className={`btn-toggle-explain ${showExplain ? "is-on" : ""}`}
                  onClick={() => setShowExplain((v) => !v)}
                >
                  {showExplain ? <EyeOff size={15} /> : <Eye size={15} />}
                  <span>{showExplain ? "✓ 已开题目解析" : "显示题目解析"}</span>
                </button>
              </div>
            </div>

            <div className="module-tabs">
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    className={`module-tab ${activeModule === m.key ? "active" : ""}`}
                    onClick={() => setActiveModule(m.key)}
                  >
                    <Icon size={15} />
                    <span>{m.label}</span>
                    {m.badge && <span className="tab-badge">{m.badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Content */}
          <div className="paper-content-card">
            {activeModule === "reading" && (
              <div className="module-section">
                {readingPassages.map((grp, pIdx) => (
                  <div key={pIdx} className="reading-block">
                    <div className="block-title-bar">
                      <h3>仔细阅读 {grp.title}</h3>
                      <span className="block-meta">第 {grp.questions[0]?.no}–{grp.questions[grp.questions.length - 1]?.no} 题</span>
                    </div>

                    <div className="passage-box">
                      {splitParagraphs(grp.passage).map((para, idx) =>
                        renderParaWithTrans(para, `read_${pIdx}_${idx}`, `仔细阅读 ${grp.title}`)
                      )}
                    </div>

                    <div className="questions-list">
                      {grp.questions.map((q) => {
                        const chosen = userAnswers[`${currentPaper.id}_${q.no}`];
                        return (
                          <div key={q.no} className="question-card">
                            <div className="q-stem">
                              <span className="q-num">{q.no}.</span>
                              <InteractiveText
                                text={q.stem}
                                savedWordsSet={savedWordsSet}
                                lemmas={lemmas}
                                onWordClick={onWordClick}
                                onTextSelect={onTextSelect}
                                sectionLabel={`仔细阅读 Q${q.no}`}
                              />
                            </div>
                            {showExplain && q.stemZh && <div className="q-zh">{q.stemZh}</div>}

                            <div className="q-options">
                              {q.options?.map((opt, oIdx) => {
                                const letter = String.fromCharCode(65 + oIdx);
                                const isChosen = chosen === letter;
                                const isCorrect = q.answer === letter;
                                const showResult = Boolean(chosen);
                                return (
                                  <div
                                    key={oIdx}
                                    className={`q-option ${isChosen ? "chosen" : ""} ${
                                      showResult && isCorrect ? "correct" : ""
                                    } ${showResult && isChosen && !isCorrect ? "wrong" : ""}`}
                                    onClick={() => handleChooseOption(q.no, letter)}
                                  >
                                    <span className="opt-letter">{letter})</span>
                                    <div className="opt-body">
                                      <InteractiveText
                                        text={opt}
                                        savedWordsSet={savedWordsSet}
                                        lemmas={lemmas}
                                        onWordClick={onWordClick}
                                        onTextSelect={onTextSelect}
                                        sectionLabel={`仔细阅读 Q${q.no} 选项${letter}`}
                                      />
                                      {showExplain && q.optionsZh?.[oIdx] && (
                                        <div className="opt-zh">{q.optionsZh[oIdx]}</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {showExplain && q.explain && (
                              <div className="explain-box">
                                <div className="explain-ans">
                                  <CheckCircle2 size={14} /> 参考答案：<strong>{q.answer}</strong>
                                  {q.type && <span className="q-type-tag">{q.type}</span>}
                                </div>
                                {q.explain["定位"] && (
                                  <div className="explain-line">
                                    <strong>定位与翻译：</strong>
                                    <InteractiveText
                                      text={q.explain["定位"]}
                                      savedWordsSet={savedWordsSet}
                                      lemmas={lemmas}
                                      onWordClick={onWordClick}
                                      onTextSelect={onTextSelect}
                                      sectionLabel={`仔细阅读 Q${q.no} 解析`}
                                    />
                                  </div>
                                )}
                                {q.explain["替换"] && (
                                  <div className="explain-line">
                                    <strong>同义替换：</strong>
                                    <InteractiveText
                                      text={q.explain["替换"]}
                                      savedWordsSet={savedWordsSet}
                                      lemmas={lemmas}
                                      onWordClick={onWordClick}
                                      onTextSelect={onTextSelect}
                                      sectionLabel={`仔细阅读 Q${q.no} 替换`}
                                    />
                                  </div>
                                )}
                                {q.explain["选项"] && (
                                  <div className="explain-line muted">{q.explain["选项"]}</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeModule === "cloze" && (
              <div className="module-section">
                <div className="block-title-bar">
                  <h3>选词填空（15选10）</h3>
                  <span className="block-meta">第 26–35 题</span>
                </div>

                <div className="word-bank-grid">
                  {Object.entries(clozeBank).map(([letter, word]) => (
                    <div key={letter} className="bank-chip">
                      <span className="bank-letter">{letter})</span>
                      <InteractiveText
                        text={word}
                        savedWordsSet={savedWordsSet}
                        lemmas={lemmas}
                        onWordClick={onWordClick}
                        onTextSelect={onTextSelect}
                        sectionLabel="选词填空词库"
                      />
                    </div>
                  ))}
                </div>

                <div className="passage-box">
                  {splitParagraphs(clozePassage).map((para, idx) =>
                    renderParaWithTrans(para, `cloze_${idx}`, "选词填空原文")
                  )}
                </div>

                <div className="questions-list">
                  {clozeQuestions.map((q) => (
                    <div key={q.no} className="question-card compact">
                      <div className="q-stem">
                        <span className="q-num">{q.no}.</span>
                        <InteractiveText
                          text={q.stem}
                          savedWordsSet={savedWordsSet}
                          lemmas={lemmas}
                          onWordClick={onWordClick}
                          onTextSelect={onTextSelect}
                          sectionLabel={`选词填空 Q${q.no}`}
                        />
                      </div>
                      {showExplain && (
                        <div className="explain-box">
                          <div className="explain-ans">
                            答案：<strong>{q.answer}) {q.answerText}</strong>
                            {q.pos && <span className="q-type-tag">{q.pos}</span>}
                          </div>
                          {q.explain?.["依据"] && <div className="explain-line">{q.explain["依据"]}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModule === "listening" && (
              <div className="module-section">
                <div className="block-title-bar">
                  <h3>听力模块（边听边划生词）</h3>
                  <span className="block-meta">第 1–25 题</span>
                </div>

                <HlsAudioPlayer audioInfo={currentPaper.audio} />

                <div className="questions-list">
                  {listeningQuestions.map((q) => {
                    const chosen = userAnswers[`${currentPaper.id}_${q.no}`];
                    return (
                      <div key={q.no} className="question-card">
                        <div className="q-stem">
                          <span className="q-num">{q.no}.</span>
                          {q.stem ? (
                            <InteractiveText
                              text={q.stem}
                              savedWordsSet={savedWordsSet}
                              lemmas={lemmas}
                              onWordClick={onWordClick}
                              onTextSelect={onTextSelect}
                              sectionLabel={`听力 Q${q.no}`}
                            />
                          ) : (
                            <span className="muted-tip">（听力题干以音频提问为准，直接看选项划词）</span>
                          )}
                        </div>
                        {showExplain && q.stemZh && <div className="q-zh">{q.stemZh}</div>}

                        <div className="q-options">
                          {q.options?.map((opt, oIdx) => {
                            const letter = String.fromCharCode(65 + oIdx);
                            const isChosen = chosen === letter;
                            const isCorrect = q.answer === letter;
                            const showResult = Boolean(chosen);
                            return (
                              <div
                                key={oIdx}
                                className={`q-option ${isChosen ? "chosen" : ""} ${
                                  showResult && isCorrect ? "correct" : ""
                                } ${showResult && isChosen && !isCorrect ? "wrong" : ""}`}
                                onClick={() => handleChooseOption(q.no, letter)}
                              >
                                <span className="opt-letter">{letter})</span>
                                <div className="opt-body">
                                  <InteractiveText
                                    text={opt}
                                    savedWordsSet={savedWordsSet}
                                    lemmas={lemmas}
                                    onWordClick={onWordClick}
                                    onTextSelect={onTextSelect}
                                    sectionLabel={`听力 Q${q.no} 选项${letter}`}
                                  />
                                  {showExplain && q.optionsZh?.[oIdx] && (
                                    <div className="opt-zh">{q.optionsZh[oIdx]}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {showExplain && q.explain && (
                          <div className="explain-box">
                            <div className="explain-ans">
                              <CheckCircle2 size={14} /> 答案：<strong>{q.answer}</strong>
                            </div>
                            {q.explain["定位"] && (
                              <div className="explain-line">
                                <strong>听力关键原文：</strong>
                                <InteractiveText
                                  text={q.explain["定位"]}
                                  savedWordsSet={savedWordsSet}
                                  lemmas={lemmas}
                                  onWordClick={onWordClick}
                                  onTextSelect={onTextSelect}
                                  sectionLabel={`听力 Q${q.no} 原文`}
                                />
                              </div>
                            )}
                            {q._leakedNextScript && (
                              <div className="explain-line">
                                <strong>补充听力段落原文：</strong>
                                <InteractiveText
                                  text={q._leakedNextScript}
                                  savedWordsSet={savedWordsSet}
                                  lemmas={lemmas}
                                  onWordClick={onWordClick}
                                  onTextSelect={onTextSelect}
                                  sectionLabel={`听力补充原文`}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeModule === "subjective" && (
              <div className="module-section">
                {currentPaper.subjective?.writing && (
                  <div className="reading-block">
                    <div className="block-title-bar">
                      <h3>Part I · 写作（题目与高分范文划词）</h3>
                    </div>
                    <div className="sub-card">
                      <div className="sub-label">写作题干：</div>
                      <p className="passage-para">
                        <InteractiveText
                          text={currentPaper.subjective.writing.directions}
                          savedWordsSet={savedWordsSet}
                          lemmas={lemmas}
                          onWordClick={onWordClick}
                          onTextSelect={onTextSelect}
                          sectionLabel="写作题干"
                        />
                      </p>
                      <div className="sub-label" style={{ marginTop: 14 }}>
                        高分范文（可直接划词收藏作文高级词汇/模板句）：
                      </div>
                      <div className="passage-box">
                        {splitParagraphs(currentPaper.subjective.writing.model).map((para, idx) =>
                          renderParaWithTrans(para, `writing_${idx}`, "写作范文")
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentPaper.subjective?.translation && (
                  <div className="reading-block" style={{ marginTop: 24 }}>
                    <div className="block-title-bar">
                      <h3>Part IV · 翻译（中文原题与参考译文划词）</h3>
                    </div>
                    <div className="sub-card">
                      <div className="sub-label">翻译原题：</div>
                      <p className="cn-source-box">{currentPaper.subjective.translation.source}</p>
                      <div className="sub-label" style={{ marginTop: 14 }}>
                        参考译文（可划词摘取主题核心词）：
                      </div>
                      <div className="passage-box">
                        <p className="passage-para">
                          <InteractiveText
                            text={currentPaper.subjective.translation.reference}
                            savedWordsSet={savedWordsSet}
                            lemmas={lemmas}
                            onWordClick={onWordClick}
                            onTextSelect={onTextSelect}
                            sectionLabel="翻译参考译文"
                          />
                        </p>
                      </div>
                      {currentPaper.subjective.translation.sentences?.length > 0 && showExplain && (
                        <div className="explain-box" style={{ marginTop: 12 }}>
                          <div className="sub-label">逐句主干与考点拆解：</div>
                          {currentPaper.subjective.translation.sentences.map((s, idx) => (
                            <div key={idx} className="explain-line" style={{ marginTop: 6 }}>
                              <InteractiveText
                                text={s.trunk || JSON.stringify(s)}
                                savedWordsSet={savedWordsSet}
                                lemmas={lemmas}
                                onWordClick={onWordClick}
                                onTextSelect={onTextSelect}
                                sectionLabel="翻译解析"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeModule === "matching" && (
              <div className="module-section">
                <div className="tip-callout">
                  <Sparkles size={16} />
                  <div>
                    <strong>经验帖作者提示：</strong>
                    “其中阅读的长篇阅读不用查，超纲词太多了。” 若基础刚起步，建议先跳过本模块；若想进阶扩充词量，可点击下方按钮展开划词。
                  </div>
                  <button className="btn-secondary-sm" onClick={() => setShowMatchingBody((v) => !v)}>
                    {showMatchingBody ? "收起长篇阅读" : "展开长篇阅读划词"}
                  </button>
                </div>

                {showMatchingBody && (
                  <>
                    <div className="passage-box">
                      {splitParagraphs(matchingPassage).map((para, idx) =>
                        renderParaWithTrans(para, `match_${idx}`, "长篇阅读")
                      )}
                    </div>
                    <div className="questions-list">
                      {matchingQuestions.map((q) => (
                        <div key={q.no} className="question-card compact">
                          <div className="q-stem">
                            <span className="q-num">{q.no}.</span>
                            <InteractiveText
                              text={q.stem}
                              savedWordsSet={savedWordsSet}
                              lemmas={lemmas}
                              onWordClick={onWordClick}
                              onTextSelect={onTextSelect}
                              sectionLabel={`长篇阅读 Q${q.no}`}
                            />
                          </div>
                          {showExplain && (
                            <div className="explain-box">
                              <div className="explain-ans">匹配段落：<strong>{q.answer}</strong></div>
                              {q.stemZh && <div className="explain-line">{q.stemZh}</div>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sticky Panel: Current Paper's Self-Made Wordbook */}
        <aside className="reader-right-column">
          <div className="sticky-vocab-panel">
            <div className="vocab-panel-header">
              <div>
                <h3>本卷自制生词本</h3>
                <span className="panel-sub">
                  {currentPaper.label} · {currentPaper.set}（共 {paperVocabList.length} 词）
                </span>
              </div>
              {paperVocabList.length > 0 && (
                <button className="btn-cram-now" onClick={() => onGoCramPaper(currentPaper.id)}>
                  <Zap size={14} /> 速刷本卷
                </button>
              )}
            </div>

            {paperVocabList.length === 0 ? (
              <div className="empty-vocab-hint">
                <p>还没有从本卷中标记生词。</p>
                <p>
                  试试直接<strong>点击左侧阅读文章里的陌生单词</strong>，把它标黄并加入本卷生词本吧！
                </p>
              </div>
            ) : (
              <div className="panel-vocab-list">
                {paperVocabList.map((item) => (
                  <div key={item.id} className="panel-vocab-item">
                    <div className="pvi-top">
                      <div className="pvi-word-line">
                        <strong>{item.text}</strong>
                        {item.isPhrase && <span className="tag-phrase">词组</span>}
                        {item.phonetic && <span className="mini-phone">/{item.phonetic}/</span>}
                      </div>
                      <div className="pvi-btns">
                        <button
                          className="icon-btn-xs"
                          title="发音"
                          onClick={() => speakText(item.text, voiceAccent)}
                        >
                          <Volume2 size={14} />
                        </button>
                        <button
                          className="icon-btn-xs danger"
                          title="移除"
                          onClick={() => onRemoveVocab(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="pvi-meaning">{item.meaningSummary}</div>
                    {item.contextSentence && (
                      <button
                        className="pvi-ctx-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectSentence?.(
                            item.contextSentence,
                            e.currentTarget.getBoundingClientRect(),
                            item.sourceSection
                          );
                        }}
                      >
                        <span className="pvi-ctx-text">例句：{item.contextSentence}</span>
                        <span className="ctx-zh-hint">看中文</span>
                      </button>
                    )}
                    <div className="pvi-meta">{item.sourceSection}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
