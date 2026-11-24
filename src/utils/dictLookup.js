export function normalizeWord(raw) {
  return (raw || "")
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")
    .toLowerCase();
}

export function lookupWord(rawWord, dict, lemmas) {
  const w = normalizeWord(rawWord);
  if (!w || w.length < 2) return null;

  if (dict[w]) {
    return { query: w, lemma: w, entry: dict[w], isInflected: false };
  }

  const lem = lemmas[w];
  if (lem && dict[lem]) {
    return { query: w, lemma: lem, entry: dict[lem], isInflected: lem !== w };
  }

  // Try British -> American spelling & common regular inflections
  const candidates = [];
  if (w.endsWith("ised")) candidates.push(w.slice(0, -4) + "ized", w.slice(0, -4) + "ize");
  if (w.endsWith("ising")) candidates.push(w.slice(0, -5) + "izing", w.slice(0, -5) + "ize");
  if (w.endsWith("ise")) candidates.push(w.slice(0, -3) + "ize");
  if (w.endsWith("isation")) candidates.push(w.slice(0, -7) + "ization");
  if (w.endsWith("our")) candidates.push(w.slice(0, -3) + "or");
  if (w.endsWith("s")) candidates.push(w.slice(0, -1));
  if (w.endsWith("es")) candidates.push(w.slice(0, -2));
  if (w.endsWith("ies")) candidates.push(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) candidates.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith("ied")) candidates.push(w.slice(0, -3) + "y");
  if (w.endsWith("ing")) candidates.push(w.slice(0, -3), w.slice(0, -3) + "e");
  if (w.endsWith("ly")) candidates.push(w.slice(0, -2), w.slice(0, -2) + "e", w.slice(0, -3) + "y");
  if (w.endsWith("ness")) candidates.push(w.slice(0, -4), w.slice(0, -5) + "y");
  if (w.endsWith("er")) candidates.push(w.slice(0, -2), w.slice(0, -1));
  if (w.endsWith("est")) candidates.push(w.slice(0, -3), w.slice(0, -2));

  for (const c of candidates) {
    if (dict[c]) {
      return { query: w, lemma: c, entry: dict[c], isInflected: true };
    }
    if (lemmas[c] && dict[lemmas[c]]) {
      return { query: w, lemma: lemmas[c], entry: dict[lemmas[c]], isInflected: true };
    }
  }

  // Try hyphenated or prefixed compound (re-, un-, non-, pre-, over-, under-, micro-)
  if (rawWord.includes("-")) {
    const parts = rawWord.split("-").map(normalizeWord).filter(Boolean);
    for (const part of parts) {
      const sub = lookupWord(part, dict, lemmas);
      if (sub) return sub;
    }
  }

  return null;
}

export function formatTransSummary(entry) {
  if (!entry || !entry.trans || !entry.trans.length) return "暂无释义";
  return entry.trans
    .slice(0, 3)
    .map((t) => `${t.pos ? t.pos + ". " : ""}${t.cn}`)
    .join("；");
}

let activeAudio = null;

export function speakText(text, accent = "us") {
  if (!text || typeof window === "undefined") return;
  const clean = text.trim();
  if (!clean) return;

  // For single word or short phrase, try Youdao TTS audio first for natural pronunciation, fallback to Web Speech
  const isShort = clean.split(/\s+/).length <= 3 && /^[A-Za-z\s'-]+$/.test(clean);
  if (isShort && typeof Audio !== "undefined") {
    try {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }
      const typeParam = accent === "uk" ? 1 : 2;
      const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=${typeParam}`;
      const audio = new Audio(url);
      activeAudio = audio;
      audio.play().catch(() => {
        speakWithSpeechSynthesis(clean, accent);
      });
      return;
    } catch {
      // Fallback below
    }
  }
  speakWithSpeechSynthesis(clean, accent);
}

function speakWithSpeechSynthesis(text, accent) {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = accent === "uk" ? "en-GB" : "en-US";
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn("SpeechSynthesis failed:", e);
  }
}

const liveZhCache = new Map();

export async function fetchLiveZh(text) {
  const clean = (text || "").replace(/^(?:P\d+|[A-Z]\))\s+/, "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!clean) return "";
  if (liveZhCache.has(clean)) return liveZhCache.get(clean);

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean.slice(0, 480))}&langpair=en|zh-CN&de=cet4lab@example.com`
    );
    if (res.ok) {
      const data = await res.json();
      const zh = data?.responseData?.translatedText || "";
      if (zh && !/MYMEMORY WARNING/i.test(zh)) {
        liveZhCache.set(clean, zh.trim());
        return zh.trim();
      }
    }
  } catch {}

  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(clean)}`
    );
    if (res.ok) {
      const data = await res.json();
      const zh = (data?.[0] || []).map((x) => x[0]).join("").trim();
      if (zh) {
        liveZhCache.set(clean, zh);
        return zh;
      }
    }
  } catch {}
  return "";
}

export function lookupSentenceTrans(text, translations) {
  if (!text || !translations) return "";
  const norm = text.replace(/\s+/g, " ").trim();
  if (translations[norm]) return translations[norm];
  const stripped = norm.replace(/^(?:P\d+|[A-Z]\))\s+/, "").trim();
  if (translations[stripped]) return translations[stripped];
  // Fuzzy match if sentence was clipped by P1 prefix or trailing punctuation
  for (const [k, v] of Object.entries(translations)) {
    if (k.length >= 12 && (norm === k || k.replace(/^P\d+\s+/, "") === stripped)) {
      return v;
    }
  }
  return "";
}

export function analyzeSelection(selectedText, dict, lemmas) {
  const words = (selectedText.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) || []);
  const breakdown = [];
  const seen = new Set();
  for (const w of words) {
    const norm = w.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    const res = lookupWord(w, dict, lemmas);
    if (res) {
      breakdown.push({
        token: w,
        lemma: res.lemma,
        phonetic: res.entry.us || res.entry.uk || "",
        summary: formatTransSummary(res.entry),
      });
    }
  }
  return breakdown;
}
