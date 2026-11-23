import React, { useMemo, useRef, useState } from "react";
import { Volume2, Trash2, Download, Upload, Search, AlertTriangle, Calendar, Zap } from "lucide-react";
import { speakText } from "../utils/dictLookup";
import { exportAllBackup, getTodayStr } from "../utils/storage";

export default function VocabManagerView({
  papers,
  vocabBook,
  voiceAccent,
  onRemoveVocab,
  onToggleMistake,
  onImportBackup,
  onGoCram,
}) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | yesterday | mistakes | phrases | paper:<id>
  const fileInputRef = useRef(null);

  const yesterdayStr = getTodayStr(-1);
  const items = useMemo(() => Object.values(vocabBook), [vocabBook]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (filterMode === "yesterday" && item.addedDate !== yesterdayStr) return false;
        if (filterMode === "mistakes" && !item.inMistakeBook) return false;
        if (filterMode === "phrases" && !item.isPhrase) return false;
        if (filterMode.startsWith("paper:") && item.sourcePaperId !== filterMode.slice(6)) return false;
        if (q) {
          return (
            item.text.toLowerCase().includes(q) ||
            (item.meaningSummary || "").toLowerCase().includes(q) ||
            (item.sourcePaperLabel || "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
  }, [items, query, filterMode, yesterdayStr]);

  const handleExportJson = () => {
    const content = exportAllBackup();
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cet4-vocab-backup-${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTxt = () => {
    const lines = filtered.map((x) => `${x.text}\t${x.meaningSummary || ""}\t${x.sourcePaperLabel || ""}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cet4-words-${getTodayStr()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      onImportBackup(text);
    } catch {
      alert("导入失败：请检查 JSON 备份文件格式。");
    }
    e.target.value = "";
  };

  const yesterdayCount = items.filter((i) => i.addedDate === yesterdayStr).length;
  const mistakeCount = items.filter((i) => i.inMistakeBook).length;

  return (
    <div className="manager-workspace">
      <div className="manager-header-card">
        <div className="manager-title-row">
          <div>
            <h2>自制真题单词本 & 错词管理</h2>
            <p className="paper-hint">
              帖子“注意三”：昨天从真题里捞出的单词，今天务必过一轮！支持导出 TXT 导入其它背词 App 或导出 JSON 备份。
            </p>
          </div>
          <div className="manager-actions">
            <button className="btn-secondary-sm" onClick={handleExportTxt}>
              <Download size={14} /> 导出词表 TXT
            </button>
            <button className="btn-secondary-sm" onClick={handleExportJson}>
              <Download size={14} /> 备份进度 JSON
            </button>
            <button className="btn-secondary-sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> 恢复备份
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="manager-filters-row">
          <div className="search-input-wrap">
            <Search size={15} />
            <input
              type="text"
              placeholder="搜索英文单词、中文释义或真题月份..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
            <option value="all">全部自制词 ({items.length})</option>
            <option value="yesterday">昨日真题新增·今日必刷 ({yesterdayCount})</option>
            <option value="mistakes">错词本标记 ({mistakeCount})</option>
            <option value="phrases">仅看词组 / 难句</option>
            {papers.map((p) => (
              <option key={p.id} value={`paper:${p.id}`}>
                {p.label} {p.set}
              </option>
            ))}
          </select>

          {yesterdayCount > 0 && (
            <button className="btn-cram-now" onClick={() => onGoCram("my-paper", "yesterday")}>
              <Calendar size={14} /> 速刷昨日 {yesterdayCount} 词
            </button>
          )}
          {mistakeCount > 0 && (
            <button className="btn-cram-now danger" onClick={() => onGoCram("mistakes", "all")}>
              <Zap size={14} /> 专刷错词本 ({mistakeCount})
            </button>
          )}
        </div>
      </div>

      <div className="vocab-table-card">
        {filtered.length === 0 ? (
          <div className="empty-stage">
            <p>当前筛选条件下没有词条。</p>
          </div>
        ) : (
          <div className="vocab-grid">
            {filtered.map((item) => (
              <div key={item.id} className="vocab-row-card">
                <div className="vrc-main">
                  <div className="vrc-top">
                    <strong className="vrc-word">{item.text}</strong>
                    {item.phonetic && <span className="mini-phone">/{item.phonetic}/</span>}
                    {item.isPhrase && <span className="tag-phrase">词组</span>}
                    {item.inMistakeBook && (
                      <span className="mistake-pill">
                        <AlertTriangle size={11} /> 错词
                      </span>
                    )}
                    <span className="vrc-source">
                      {item.sourcePaperLabel} · {item.sourceSection}
                    </span>
                  </div>
                  <div className="vrc-cn">{item.meaningSummary}</div>
                  {item.contextSentence && <div className="vrc-ctx">例句：{item.contextSentence}</div>}
                </div>
                <div className="vrc-btns">
                  <button
                    className="icon-btn"
                    title="发音"
                    onClick={() => speakText(item.text, voiceAccent)}
                  >
                    <Volume2 size={16} />
                  </button>
                  <button
                    className={`btn-mini-pill ${item.inMistakeBook ? "is-mistake" : ""}`}
                    onClick={() => onToggleMistake(item.id)}
                  >
                    {item.inMistakeBook ? "移出错词本" : "+错词本"}
                  </button>
                  <button
                    className="icon-btn danger"
                    title="删除"
                    onClick={() => onRemoveVocab(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
