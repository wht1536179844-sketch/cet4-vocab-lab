const KEYS = {
  VOCAB: "cet4_lab_vocab_v1",
  CORE: "cet4_lab_core_v1",
  SETTINGS: "cet4_lab_settings_v1",
  STATS: "cet4_lab_stats_v1",
  PAPER_STATUS: "cet4_lab_paper_status_v1",
};

export function getTodayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

export function loadVocabBook() {
  return safeRead(KEYS.VOCAB, {});
}

export function saveVocabBook(book) {
  safeWrite(KEYS.VOCAB, book);
}

export function loadCoreProgress() {
  return safeRead(KEYS.CORE, {});
}

export function saveCoreProgress(progress) {
  safeWrite(KEYS.CORE, progress);
}

export function loadSettings() {
  return {
    autoSpeak: true,
    dailyNewQuota: 50,
    hideMatchingByDefault: true,
    voiceAccent: "us",
    ...safeRead(KEYS.SETTINGS, {}),
  };
}

export function saveSettings(settings) {
  safeWrite(KEYS.SETTINGS, settings);
}

export function loadDailyStats() {
  const today = getTodayStr();
  const stats = safeRead(KEYS.STATS, { date: today, reviewed: 0, learned: 0, crammed: 0, rounds: 0 });
  if (stats.date !== today) {
    return { date: today, reviewed: 0, learned: 0, crammed: 0, rounds: stats.rounds || 0 };
  }
  return stats;
}

export function saveDailyStats(stats) {
  safeWrite(KEYS.STATS, stats);
}

export function loadPaperStatus() {
  return safeRead(KEYS.PAPER_STATUS, {});
}

export function savePaperStatus(status) {
  safeWrite(KEYS.PAPER_STATUS, status);
}

export function exportAllBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    vocabBook: loadVocabBook(),
    coreProgress: loadCoreProgress(),
    settings: loadSettings(),
    paperStatus: loadPaperStatus(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importAllBackup(jsonText) {
  const data = JSON.parse(jsonText);
  if (data.vocabBook) saveVocabBook(data.vocabBook);
  if (data.coreProgress) saveCoreProgress(data.coreProgress);
  if (data.settings) saveSettings(data.settings);
  if (data.paperStatus) savePaperStatus(data.paperStatus);
  return true;
}
