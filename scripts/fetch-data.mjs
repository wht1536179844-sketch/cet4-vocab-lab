import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = "C:/Users/ncs54/.gemini/antigravity/scratch/cet4-vocab-lab";
const RAW_DIR = path.join(ROOT, "raw_cache");
const OUT_DIR = path.join(ROOT, "public", "data");

await fs.mkdir(RAW_DIR, { recursive: true });
await fs.mkdir(OUT_DIR, { recursive: true });

async function downloadText(url, cacheName) {
  const cachePath = path.join(RAW_DIR, cacheName);
  try {
    return await fs.readFile(cachePath, "utf8");
  } catch {
    console.log("Fetching", url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    await fs.writeFile(cachePath, text, "utf8");
    return text;
  }
}

async function downloadZipJson(url, name) {
  const zipPath = path.join(RAW_DIR, `${name}.zip`);
  const extractDir = path.join(RAW_DIR, name);
  try {
    const files = await fs.readdir(extractDir);
    const jsonFile = files.find((f) => f.endsWith(".json"));
    if (jsonFile) return await fs.readFile(path.join(extractDir, jsonFile), "utf8");
  } catch {}
  console.log("Fetching zip", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(zipPath, buf);
  await fs.mkdir(extractDir, { recursive: true });
  await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${extractDir}'`,
  ]);
  const files = await fs.readdir(extractDir);
  const jsonFile = files.find((f) => f.endsWith(".json"));
  if (!jsonFile) throw new Error(`No json found in ${name}`);
  return await fs.readFile(path.join(extractDir, jsonFile), "utf8");
}

// 1. Fetch Index & Audio & 2025-2026 Papers
const indexJs = await downloadText(
  "https://raw.githubusercontent.com/123xzw999/cet4-exam-quiz/main/data/index.js",
  "index.js"
);
const audioJs = await downloadText(
  "https://raw.githubusercontent.com/123xzw999/cet4-exam-quiz/main/data/audio.js",
  "audio.js"
);

const win = {};
eval(indexJs.replace(/window\./g, "win."));
eval(audioJs.replace(/window\./g, "win."));

const targetIds = win.__CET4_INDEX
  .filter((item) => item.year === "2026" || item.year === "2025")
  .map((item) => item.id)
  .sort((a, b) => b.localeCompare(a)); // 2026-06-3..1, 2025-12-3..1, 2025-06-3..1

// Sort properly: 2026-06-1, 2026-06-2, 2026-06-3, 2025-12-1..3, 2025-06-1..3
targetIds.sort((a, b) => {
  const [ya, ma, sa] = a.split("-").map(Number);
  const [yb, mb, sb] = b.split("-").map(Number);
  if (ya !== yb) return yb - ya;
  if (ma !== mb) return mb - ma;
  return sa - sb;
});

console.log("Target CET-4 papers:", targetIds);

function cleanOptionLeak(opt) {
  if (typeof opt !== "string") return { clean: opt, leakedScript: "" };
  // Detect leaked listening script appended after sentence-ending punctuation + number + Capital letter
  const m = opt.match(/^(.+?[.?!])\s+\d+\s+([A-Z][a-z].{40,})$/s);
  if (m) {
    return { clean: m[1].trim(), leakedScript: m[2].trim() };
  }
  return { clean: opt, leakedScript: "" };
}

const papers = [];
for (const id of targetIds) {
  const pJs = await downloadText(
    `https://raw.githubusercontent.com/123xzw999/cet4-exam-quiz/main/data/papers/${id}.js`,
    `paper_${id}.js`
  );
  const pWin = { __CET4_PAPERS: {} };
  eval(pJs.replace(/window\.__CET4_PAPERS/g, "pWin.__CET4_PAPERS"));
  const raw = pWin.__CET4_PAPERS[id];

  // Clean questions & attach listening script hints if leaked
  const cleanedQuestions = raw.questions.map((q) => {
    const qCopy = { ...q };
    if (Array.isArray(qCopy.options)) {
      qCopy.options = qCopy.options.map((o) => {
        const { clean, leakedScript } = cleanOptionLeak(o);
        if (leakedScript) qCopy._leakedNextScript = leakedScript;
        return clean;
      });
    }
    return qCopy;
  });

  const audioInfo = win.__CET4_AUDIO[id] || null;
  papers.push({
    id: raw.id,
    label: raw.label,
    set: raw.set,
    title: `${raw.label} 大学英语四级真题 (${raw.set})`,
    year: id.slice(0, 4),
    month: id.slice(5, 7),
    audio: audioInfo,
    questions: cleanedQuestions,
    subjective: raw.subjective || {},
  });
}

await fs.writeFile(path.join(OUT_DIR, "papers.json"), JSON.stringify(papers), "utf8");
console.log("Saved papers.json:", papers.length, "papers");

// 2. Fetch Vocabulary & Dictionaries
const cet4CoreRaw = await downloadZipJson(
  "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164649209_CET4_1.zip",
  "CET4_1"
);
const cet4FullRaw = await downloadZipJson(
  "https://raw.githubusercontent.com/kajweb/dict/master/book/1521164635506_CET4_2.zip",
  "CET4_2"
);

function parseKajwebLines(rawText) {
  return rawText
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const obj = JSON.parse(line);
      const c = obj.content?.word?.content || {};
      const trans = (c.trans || []).map((t) => ({
        pos: t.pos || "",
        cn: t.tranCn || "",
      }));
      const phrases = (c.phrase?.phrases || []).slice(0, 4).map((p) => ({
        p: p.pContent,
        cn: p.pCn,
      }));
      const sentences = (c.sentence?.sentences || []).slice(0, 2).map((s) => ({
        en: s.sContent,
        cn: s.sCn,
      }));
      return {
        word: obj.headWord,
        uk: c.ukphone || "",
        us: c.usphone || "",
        trans,
        phrases,
        sentences,
      };
    });
}

const cet4CoreList = parseKajwebLines(cet4CoreRaw);
const cet4FullList = parseKajwebLines(cet4FullRaw);
console.log("CET4_1 core:", cet4CoreList.length, "CET4_2 full:", cet4FullList.length);

// Fetch Kylebing JSONs for broad dictionary coverage (初中, 高中, CET4, CET6)
const dictMap = {};
function mergeWord(w, entry) {
  const key = w.toLowerCase();
  if (!dictMap[key]) {
    dictMap[key] = entry;
  } else {
    // Prefer richer entry with phonetics
    if (!dictMap[key].us && entry.us) dictMap[key].us = entry.us;
    if (!dictMap[key].uk && entry.uk) dictMap[key].uk = entry.uk;
    if ((!dictMap[key].phrases || !dictMap[key].phrases.length) && entry.phrases?.length) {
      dictMap[key].phrases = entry.phrases;
    }
    if ((!dictMap[key].sentences || !dictMap[key].sentences.length) && entry.sentences?.length) {
      dictMap[key].sentences = entry.sentences;
    }
    if ((!dictMap[key].trans || !dictMap[key].trans.length) && entry.trans?.length) {
      dictMap[key].trans = entry.trans;
    }
  }
}

for (const item of cet4CoreList) mergeWord(item.word, item);
for (const item of cet4FullList) mergeWord(item.word, item);

const kyleFiles = [
  ["1-初中-顺序.json", "kyle_1.json"],
  ["2-高中-顺序.json", "kyle_2.json"],
  ["3-CET4-顺序.json", "kyle_3.json"],
  ["4-CET6-顺序.json", "kyle_4.json"],
  ["5-考研-顺序.json", "kyle_5.json"],
];
for (const [remote, local] of kyleFiles) {
  const url = `https://raw.githubusercontent.com/Kylebing/english-vocabulary/master/json/${encodeURIComponent(remote)}`;
  const txt = await downloadText(url, local);
  const arr = JSON.parse(txt);
  for (const x of arr) {
    mergeWord(x.word, {
      word: x.word,
      uk: "",
      us: "",
      trans: (x.translations || []).map((t) => ({ pos: t.type || "", cn: t.translation || "" })),
      phrases: (x.phrases || []).slice(0, 3).map((p) => ({ p: p.phrase, cn: p.translation })),
      sentences: [],
    });
  }
}

// Fetch lemma.en.txt
const lemmaTxt = await downloadText(
  "https://raw.githubusercontent.com/skywind3000/ECDICT/master/lemma.en.txt",
  "lemma.en.txt"
);
const lemmas = {};
for (const line of lemmaTxt.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const arrow = line.indexOf("->");
  if (arrow === -1) continue;
  const basePart = line.slice(0, arrow).trim();
  const base = basePart.split("/")[0].toLowerCase();
  const forms = line.slice(arrow + 2).trim().split(",");
  for (const f of forms) {
    const fw = f.trim().toLowerCase();
    if (fw && !lemmas[fw]) lemmas[fw] = base;
  }
}

// Check coverage of words in our 9 CET-4 papers
const paperWords = new Set();
for (const p of papers) {
  const texts = [];
  for (const q of p.questions) {
    if (q.stem) texts.push(q.stem);
    if (q.passage) texts.push(q.passage);
    if (Array.isArray(q.options)) texts.push(...q.options);
    if (q.explain?.["定位"]) texts.push(q.explain["定位"]);
    if (q._leakedNextScript) texts.push(q._leakedNextScript);
  }
  if (p.subjective?.writing?.model) texts.push(p.subjective.writing.model);
  if (p.subjective?.writing?.directions) texts.push(p.subjective.writing.directions);
  if (p.subjective?.translation?.reference) texts.push(p.subjective.translation.reference);
  for (const t of texts) {
    const matches = t.match(/[A-Za-z]{2,}/g) || [];
    for (const m of matches) paperWords.add(m.toLowerCase());
  }
}

let hit = 0;
const missing = [];
for (const w of paperWords) {
  if (dictMap[w] || (lemmas[w] && dictMap[lemmas[w]])) {
    hit++;
  } else {
    missing.push(w);
  }
}
console.log(`Paper word coverage: ${hit}/${paperWords.size} (${((hit / paperWords.size) * 100).toFixed(1)}%)`);
console.log("Sample missing words (first 50):", missing.slice(0, 50));

await fs.writeFile(path.join(OUT_DIR, "cet4_core.json"), JSON.stringify(cet4CoreList), "utf8");
await fs.writeFile(path.join(OUT_DIR, "cet4_syllabus.json"), JSON.stringify(cet4FullList), "utf8");
await fs.writeFile(path.join(OUT_DIR, "dict.json"), JSON.stringify(dictMap), "utf8");
await fs.writeFile(path.join(OUT_DIR, "lemmas.json"), JSON.stringify(lemmas), "utf8");
console.log("All data files written to", OUT_DIR);
