import fs from "node:fs/promises";
import path from "node:path";

const ROOT = "C:/Users/ncs54/.gemini/antigravity/scratch/cet4-vocab-lab";
const RAW_DIR = path.join(ROOT, "raw_cache");
const OUT_DIR = path.join(ROOT, "public", "data");

const csvPath = path.join(RAW_DIR, "ecdict.csv");
try {
  await fs.access(csvPath);
} catch {
  console.log("Downloading ecdict.csv...");
  const res = await fetch("https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(csvPath, buf);
}

const papers = JSON.parse(await fs.readFile(path.join(OUT_DIR, "papers.json"), "utf8"));
const dictMap = JSON.parse(await fs.readFile(path.join(OUT_DIR, "dict.json"), "utf8"));
const lemmas = JSON.parse(await fs.readFile(path.join(OUT_DIR, "lemmas.json"), "utf8"));

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

// Parse CSV line supporting quotes
function parseCsvLine(line) {
  const cols = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

function parseTransStr(translation) {
  if (!translation) return [];
  return translation
    .split(/\\n|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^([a-z]+\.)\s*(.+)$/i);
      if (m) return { pos: m[1].replace(/\.$/, ""), cn: m[2] };
      return { pos: "", cn: part };
    });
}

const csvText = await fs.readFile(csvPath, "utf8");
const lines = csvText.split(/\r?\n/);
// header: word,phonetic,definition,translation,pos,collins,oxford,tag,bnc,frq,exchange,detail,audio
let enriched = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const cols = parseCsvLine(line);
  const word = cols[0]?.trim();
  if (!word) continue;
  const key = word.toLowerCase();
  const phonetic = cols[1]?.trim() || "";
  const translation = cols[3]?.trim() || "";
  const bnc = Number(cols[8] || 0);
  const frq = Number(cols[9] || 0);
  const tag = cols[7]?.trim() || "";

  const isNeeded =
    paperWords.has(key) ||
    dictMap[key] ||
    (bnc > 0 && bnc <= 12000) ||
    (frq > 0 && frq <= 12000) ||
    /zk|gk|cet4|cet6|ky/.test(tag);

  if (!isNeeded || !translation) continue;

  if (!dictMap[key]) {
    dictMap[key] = {
      word,
      uk: phonetic,
      us: phonetic,
      trans: parseTransStr(translation),
      phrases: [],
      sentences: [],
    };
    enriched++;
  } else if (!dictMap[key].us && phonetic) {
    dictMap[key].us = phonetic;
    if (!dictMap[key].uk) dictMap[key].uk = phonetic;
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

console.log(`Enriched ${enriched} entries from ECDICT.`);
console.log(`Dict size: ${Object.keys(dictMap).length} words.`);
console.log(`Paper word coverage: ${hit}/${paperWords.size} (${((hit / paperWords.size) * 100).toFixed(2)}%)`);
console.log("Remaining missing sample:", missing.slice(0, 40));

await fs.writeFile(path.join(OUT_DIR, "dict.json"), JSON.stringify(dictMap), "utf8");
