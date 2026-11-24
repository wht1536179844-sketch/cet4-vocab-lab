import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "C:/Users/ncs54/.gemini/antigravity/scratch/cet4-vocab-lab";
const OUT_DIR = path.join(ROOT, "public", "data");
const CACHE_PATH = path.join(ROOT, "raw_cache", "translations_cache.json");

const papers = JSON.parse(await fs.readFile(path.join(OUT_DIR, "papers.json"), "utf8"));

let cache = {};
try {
  cache = JSON.parse(await fs.readFile(CACHE_PATH, "utf8"));
} catch {}

function normKey(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function splitParagraphs(text) {
  if (!text) return [];
  const normalized = text
    .replace(/\s+(P\d+\s)/g, "\n$1")
    .replace(/\s+([A-Z]\)\s)/g, "\n$1");
  return normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitSentences(para) {
  if (!para) return [];
  const parts = para.match(/[^.?!]+[.?!]+(?=\s|$)|[^.?!]+$/g) || [para];
  return parts.map((s) => normKey(s)).filter((s) => s.length > 3 && /[A-Za-z]/.test(s));
}

const orderedUnits = [];
const seenUnits = new Set();
const addUnit = (u) => {
  if (u && !seenUnits.has(u)) {
    seenUnits.add(u);
    orderedUnits.push(u);
  }
};

// Prioritize 2026-06 first, then 2025-12, then 2025-06
for (const p of papers) {
  const seenPassages = new Set();
  for (const q of p.questions) {
    if (q.passage && !seenPassages.has(q.passage)) {
      seenPassages.add(q.passage);
      for (const para of splitParagraphs(q.passage)) {
        addUnit(normKey(para));
        for (const sent of splitSentences(para)) addUnit(sent);
      }
    }
    if (q._leakedNextScript) {
      const clean = normKey(q._leakedNextScript);
      addUnit(clean);
      for (const sent of splitSentences(clean)) addUnit(sent);
    }
  }
  if (p.subjective?.writing?.directions) addUnit(normKey(p.subjective.writing.directions));
  if (p.subjective?.writing?.model) {
    for (const para of splitParagraphs(p.subjective.writing.model)) {
      addUnit(normKey(para));
      for (const sent of splitSentences(para)) addUnit(sent);
    }
  }
}

const remaining = orderedUnits.filter((t) => !cache[t]);
console.log(`Total units: ${orderedUnits.length}, already cached: ${orderedUnits.length - remaining.length}, remaining: ${remaining.length}`);

async function translateViaMyMemory(text) {
  const clean = text.replace(/^P\d+\s+/, "").slice(0, 480);
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|zh-CN&de=cet4lab@example.com`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return "";
    const data = await res.json();
    const zh = data?.responseData?.translatedText || "";
    if (!zh || /MYMEMORY WARNING/i.test(zh)) return "";
    return zh.trim();
  } catch {
    return "";
  }
}

async function translateViaGoogle(text) {
  const clean = text.replace(/^P\d+\s+/, "");
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(clean)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return "";
    const data = await res.json();
    return (data?.[0] || []).map((x) => x[0]).join("").trim();
  } catch {
    return "";
  }
}

let useGoogle = false;
const BATCH = 6;
let savedCount = 0;

for (let i = 0; i < remaining.length; i += BATCH) {
  const slice = remaining.slice(i, i + BATCH);
  const results = await Promise.all(
    slice.map(async (t) => {
      let zh = await translateViaMyMemory(t);
      if (!zh && useGoogle) {
        zh = await translateViaGoogle(t);
      }
      return zh;
    })
  );
  slice.forEach((t, idx) => {
    if (results[idx]) {
      cache[t] = results[idx];
      savedCount++;
    }
  });

  if ((i / BATCH) % 10 === 0 || i + BATCH >= remaining.length) {
    console.log(`Processed ${Math.min(i + BATCH, remaining.length)}/${remaining.length}, total cached: ${Object.keys(cache).length}`);
    await fs.writeFile(CACHE_PATH, JSON.stringify(cache), "utf8");
  }
  await new Promise((r) => setTimeout(r, 120));
}

await fs.writeFile(CACHE_PATH, JSON.stringify(cache), "utf8");
await fs.writeFile(path.join(OUT_DIR, "translations.json"), JSON.stringify(cache), "utf8");
console.log("Final translations.json entries:", Object.keys(cache).length);
