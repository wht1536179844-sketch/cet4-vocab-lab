import { lookupWord } from "./dictLookup.js";

const LINK_VERBS = new Set([
  "is", "am", "are", "was", "were", "be", "been", "being",
  "become", "becomes", "became", "seem", "seems", "seemed",
  "appear", "appears", "remain", "remains", "feel", "feels", "felt",
  "look", "looks", "looked", "sound", "sounds", "taste", "tastes", "prove", "proves",
]);

const AUX_VERBS = new Set([
  "do", "does", "did", "don't", "doesn't", "didn't",
  "can", "could", "can't", "couldn't", "will", "would", "won't", "wouldn't",
  "shall", "should", "shouldn't", "may", "might", "must", "mustn't",
  "have", "has", "had", "haven't", "hasn't", "hadn't",
  "is", "am", "are", "was", "were", "isn't", "aren't", "wasn't", "weren't",
]);

const ADVERBS_IN_VP = new Set([
  "not", "n't", "never", "always", "often", "usually", "sometimes", "only",
  "also", "still", "already", "just", "really", "actually", "equally", "generally",
  "likely", "probably", "rarely", "seldom", "even", "almost", "nearly", "far",
]);

const PREPOSITIONS = new Set([
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "about",
  "into", "through", "during", "between", "among", "against", "without",
  "under", "over", "after", "before", "despite", "than", "as", "like",
]);

const SUBORDINATORS = new Set([
  "because", "although", "though", "while", "whereas", "since", "unless",
  "until", "if", "when", "whenever", "where", "wherever", "whether", "that",
  "which", "who", "whom", "whose", "what",
]);

const INTRO_PHRASES = [
  /^on the one hand\b,?/i,
  /^on the other hand\b,?/i,
  /^from a[n]?\s+[\w\s-]+?\s+point of view\b,?/i,
  /^in fact\b,?/i,
  /^for example\b,?/i,
  /^for instance\b,?/i,
  /^in addition\b,?/i,
  /^meanwhile\b,?/i,
  /^however\b,?/i,
  /^therefore\b,?/i,
  /^moreover\b,?/i,
  /^fortunately\b,?/i,
  /^unfortunately\b,?/i,
  /^according to\s+[^,]+,?/i,
];

const FUNCTION_GLOSS = {
  can: "能够",
  could: "可以/曾能",
  will: "将会",
  would: "将会/过去常",
  "won't": "不会",
  "can't": "不能",
  "don't": "不",
  "doesn't": "不",
  "didn't": "没有",
  should: "应该",
  may: "可能",
  might: "或许",
  must: "必须",
  not: "不",
  only: "只/仅仅",
  often: "经常",
  is: "是",
  are: "是",
  was: "是(过去)",
  were: "是(过去)",
  become: "变得",
  becomes: "变得",
  your: "你的",
  my: "我的",
  his: "他的",
  her: "她的",
  their: "他们的",
  our: "我们的",
  it: "它",
  to: "对/向",
  of: "……的",
  for: "为了/对于",
  in: "在……中",
  on: "在……上",
  from: "从",
  with: "和/用",
  under: "在……下",
  whether: "是否",
  and: "并且",
  but: "但是",
  so: "所以",
  or: "或者",
  give: "给出",
  worth: "值得",
  "on the one hand": "一方面",
  "on the other hand": "另一方面",
};

const COMMON_VERBS = new Set([
  "say", "says", "said", "make", "makes", "made", "take", "takes", "took",
  "give", "gives", "gave", "get", "gets", "got", "use", "uses", "used",
  "find", "finds", "found", "think", "thinks", "thought", "know", "knows", "knew",
  "want", "wants", "wanted", "need", "needs", "needed", "deserve", "deserves", "deserved",
  "stretch", "stretches", "stretched", "grow", "grows", "grew", "grown",
  "kill", "kills", "killed", "contain", "contains", "contained", "require", "requires",
  "suggest", "suggests", "show", "shows", "showed", "mean", "means", "meant",
  "help", "helps", "helped", "keep", "keeps", "kept", "lead", "leads", "led",
  "depend", "depends", "depended", "affect", "affects", "affected", "cause", "causes",
  "believe", "believes", "claim", "claims", "claimed", "argue", "argues",
  "increase", "increases", "reduce", "reduces", "improve", "improves",
  "worth", "see", "sees", "saw", "seen", "have", "has", "had",
]);

const NOT_VERB_WORDS = new Set([
  "the", "a", "an", "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their",
  "some", "any", "many", "much", "more", "most", "no", "every", "each", "both", "all",
  "and", "or", "but", "so", "yet", "nor", "very", "too", "quite", "rather",
  "organic", "food", "price", "higher", "classic", "grocery", "store", "dilemma",
  "personal", "decision", "science", "clear-cut", "answer", "question", "nutrition", "difference",
  "trade-offs", "trade-off", "product", "consideration",
]);

function getGlossForChunk(text, dict, lemmas) {
  const lower = text.toLowerCase().trim();
  if (FUNCTION_GLOSS[lower]) return FUNCTION_GLOSS[lower];
  const words = text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) || [];
  const pieces = [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (["the", "a", "an"].includes(lw)) continue;
    if (FUNCTION_GLOSS[lw]) {
      pieces.push(FUNCTION_GLOSS[lw]);
      continue;
    }
    const hit = lookupWord(w, dict, lemmas);
    if (hit?.entry?.trans?.length) {
      const firstCn = hit.entry.trans[0].cn.split(/[；;，,]/)[0].trim();
      if (firstCn && pieces.length < 4) pieces.push(firstCn);
    }
  }
  return pieces.join(" ");
}

function isLikelyVerb(token, prevToken, dict, lemmas, allowAfterAdv = false) {
  const lw = token.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
  if (!lw || NOT_VERB_WORDS.has(lw) || PREPOSITIONS.has(lw)) return false;
  if (AUX_VERBS.has(lw) || LINK_VERBS.has(lw) || COMMON_VERBS.has(lw)) return true;
  if (/'s$|'re$|'ve$|'ll$|'d$|n't$/.test(lw)) return true;

  const prevLw = (prevToken || "").toLowerCase();
  if (["the", "a", "an", "my", "your", "his", "her", "our", "their", "this", "that"].includes(prevLw)) {
    return false;
  }

  const hit = lookupWord(lw, dict, lemmas);
  if (hit?.entry?.trans?.length) {
    const poses = hit.entry.trans.map((t) => (t.pos || "").toLowerCase());
    const hasV = poses.some((p) => p.startsWith("v"));
    const onlyV = poses.every((p) => p.startsWith("v"));
    if (onlyV) return true;
    if (hasV && (allowAfterAdv || /ed$|ing$|es$/.test(lw) || AUX_VERBS.has(prevLw) || prevLw === "to")) {
      return true;
    }
  }
  return false;
}

function splitClauseIntoChunks(clauseText, dict, lemmas) {
  const chunks = [];
  let remaining = clauseText.trim();
  if (!remaining) return chunks;

  // 1. Check introductory phrase
  for (const rx of INTRO_PHRASES) {
    const m = remaining.match(rx);
    if (m) {
      const phrase = m[0].replace(/,$/, "").trim();
      chunks.push({ role: "过渡/状语", color: "amber", text: phrase, gloss: getGlossForChunk(phrase, dict, lemmas) });
      remaining = remaining.slice(m[0].length).trim();
      break;
    }
  }

  // 2. Leading comma-separated adverbial/prepositional phrase
  if (!chunks.length) {
    const commaIdx = remaining.indexOf(",");
    if (commaIdx > 0 && commaIdx < 50) {
      const head = remaining.slice(0, commaIdx).trim();
      const firstWord = head.split(/\s+/)[0].toLowerCase();
      if (PREPOSITIONS.has(firstWord) || SUBORDINATORS.has(firstWord) || firstWord.endsWith("ly")) {
        chunks.push({
          role: SUBORDINATORS.has(firstWord) ? "状语从句" : "句首状语",
          color: SUBORDINATORS.has(firstWord) ? "purple" : "amber",
          text: head,
          gloss: getGlossForChunk(head, dict, lemmas),
        });
        remaining = remaining.slice(commaIdx + 1).trim();
      }
    }
  }

  const words = remaining.split(/\s+/).filter(Boolean);
  if (!words.length) return chunks;

  const firstLw = words[0].toLowerCase().replace(/[^a-z']/g, "");

  // 3. Yes/No Question inversion
  if ((AUX_VERBS.has(firstLw) || LINK_VERBS.has(firstLw)) && remaining.endsWith("?")) {
    chunks.push({
      role: LINK_VERBS.has(firstLw) ? "系动词(提前)" : "助动词(提前)",
      color: "rose",
      text: words[0],
      gloss: LINK_VERBS.has(firstLw) ? "是" : "疑问助动词",
    });

    let splitIdx = -1;
    for (let i = 1; i < words.length; i++) {
      const lw = words[i].toLowerCase().replace(/[^a-z-]/g, "");
      if (lw === "worth" || isLikelyVerb(words[i], words[i - 1], dict, lemmas)) {
        splitIdx = i;
        break;
      }
      const hit = lookupWord(lw, dict, lemmas);
      if (i >= 2 && hit?.entry?.trans?.[0]?.pos?.startsWith("adj") && !["higher", "lower", "better", "new", "old"].includes(lw)) {
        splitIdx = i;
        break;
      }
    }
    if (splitIdx > 1) {
      const subj = words.slice(1, splitIdx).join(" ");
      const rest = words.slice(splitIdx).join(" ").replace(/[?.!]+$/, "");
      chunks.push({ role: "主语", color: "blue", text: subj, gloss: getGlossForChunk(subj, dict, lemmas) });
      chunks.push({
        role: LINK_VERBS.has(firstLw) ? "表语" : "谓语+宾语",
        color: "emerald",
        text: rest,
        gloss: getGlossForChunk(rest, dict, lemmas),
      });
    } else {
      const rest = words.slice(1).join(" ").replace(/[?.!]+$/, "");
      chunks.push({ role: "主语及表语/宾语", color: "blue", text: rest, gloss: getGlossForChunk(rest, dict, lemmas) });
    }
    return chunks;
  }

  // 4. "There is/are..."
  if (firstLw === "there" && words[1] && (LINK_VERBS.has(words[1].toLowerCase()) || AUX_VERBS.has(words[1].toLowerCase()))) {
    let vEnd = 2;
    while (vEnd < words.length && (AUX_VERBS.has(words[vEnd].toLowerCase()) || ADVERBS_IN_VP.has(words[vEnd].toLowerCase()))) {
      vEnd++;
    }
    const thereVerb = words.slice(0, vEnd).join(" ");
    const realSubj = words.slice(vEnd).join(" ").replace(/[?.!]+$/, "");
    chunks.push({ role: "There be 句型", color: "rose", text: thereVerb, gloss: "存在/有" });
    if (realSubj) {
      chunks.push({ role: "真实主语", color: "blue", text: realSubj, gloss: getGlossForChunk(realSubj, dict, lemmas) });
    }
    return chunks;
  }

  // 5. Declarative clause
  let subPrefixEnd = 0;
  if (SUBORDINATORS.has(firstLw)) {
    chunks.push({ role: "从句引导词", color: "purple", text: words[0], gloss: FUNCTION_GLOSS[firstLw] || "引导从句" });
    subPrefixEnd = 1;
  }

  let verbStart = -1;
  for (let i = subPrefixEnd; i < words.length; i++) {
    const raw = words[i];
    if (i === subPrefixEnd && /^(it|that|there|what|who|he|she)'s$/i.test(raw)) {
      const [sPart] = raw.split("'");
      chunks.push({ role: "主语", color: "blue", text: sPart, gloss: getGlossForChunk(sPart, dict, lemmas) });
      chunks.push({ role: "系/助动词", color: "rose", text: "'s (is)", gloss: "是" });
      const rest = words.slice(i + 1).join(" ").replace(/[?.!]+$/, "");
      if (rest) splitRestWithModifiers(rest, "表语/宾语", chunks, dict, lemmas);
      return chunks;
    }

    if (i > subPrefixEnd && isLikelyVerb(raw, words[i - 1], dict, lemmas)) {
      verbStart = i;
      break;
    }
  }

  if (verbStart === -1) {
    const clean = words.slice(subPrefixEnd).join(" ").replace(/[?.!]+$/, "");
    chunks.push({ role: "分句内容", color: "blue", text: clean, gloss: getGlossForChunk(clean, dict, lemmas) });
    return chunks;
  }

  const subjText = words.slice(subPrefixEnd, verbStart).join(" ");
  if (subjText) {
    chunks.push({ role: "主语", color: "blue", text: subjText, gloss: getGlossForChunk(subjText, dict, lemmas) });
  }

  // Collect full verb group: aux/modal + adverbs + main verb
  let verbEnd = verbStart + 1;
  let seenMainVerb = !AUX_VERBS.has(words[verbStart].toLowerCase().replace(/[^a-z']/g, ""));
  while (verbEnd < words.length) {
    const curLw = words[verbEnd].toLowerCase().replace(/[^a-z']/g, "");
    if (ADVERBS_IN_VP.has(curLw) && !seenMainVerb) {
      verbEnd++;
      continue;
    }
    if (!seenMainVerb && isLikelyVerb(words[verbEnd], words[verbEnd - 1], dict, lemmas, true)) {
      verbEnd++;
      if (!AUX_VERBS.has(curLw)) seenMainVerb = true;
      continue;
    }
    break;
  }

  const verbText = words.slice(verbStart, verbEnd).join(" ");
  const lastVerbLw = words[verbEnd - 1].toLowerCase().replace(/[^a-z']/g, "");
  const isLink = LINK_VERBS.has(lastVerbLw);
  chunks.push({
    role: isLink ? "系动词" : "谓语",
    color: "rose",
    text: verbText,
    gloss: getGlossForChunk(verbText, dict, lemmas) || (isLink ? "是" : ""),
  });

  const restText = words.slice(verbEnd).join(" ").replace(/[?.!]+$/, "");
  if (restText) {
    splitRestWithModifiers(restText, isLink ? "表语" : "宾语/补足语", chunks, dict, lemmas);
  }

  return chunks;
}

function splitRestWithModifiers(restText, primaryRole, chunks, dict, lemmas) {
  const words = restText.split(/\s+/).filter(Boolean);
  let prepSplit = -1;
  for (let i = 1; i < words.length; i++) {
    const lw = words[i].toLowerCase().replace(/[^a-z]/g, "");
    if (
      i >= 2 &&
      (SUBORDINATORS.has(lw) ||
        (PREPOSITIONS.has(lw) && ["to", "of", "for", "from", "with", "in", "on", "depending", "between"].includes(lw)))
    ) {
      prepSplit = i;
      break;
    }
  }

  if (prepSplit > 0) {
    const core = words.slice(0, prepSplit).join(" ");
    const tail = words.slice(prepSplit).join(" ");
    const tailFirst = words[prepSplit].toLowerCase().replace(/[^a-z]/g, "");
    chunks.push({ role: primaryRole, color: "emerald", text: core, gloss: getGlossForChunk(core, dict, lemmas) });
    chunks.push({
      role: SUBORDINATORS.has(tailFirst) ? "从句修饰" : "介词短语(定/状语)",
      color: SUBORDINATORS.has(tailFirst) ? "purple" : "amber",
      text: tail,
      gloss: getGlossForChunk(tail, dict, lemmas),
    });
  } else {
    chunks.push({ role: primaryRole, color: "emerald", text: restText, gloss: getGlossForChunk(restText, dict, lemmas) });
  }
}

export function analyzeSentenceStructure(rawSentence, dict, lemmas) {
  if (!rawSentence) return null;
  const clean = rawSentence.replace(/^(?:P\d+|[A-Z]\))\s+/, "").replace(/\s+/g, " ").trim();
  if (!clean || !/[A-Za-z]/.test(clean)) return null;

  const lower = clean.toLowerCase();
  let sentenceType = "陈述句（主干结构）";
  const features = [];

  if (clean.endsWith("?")) {
    sentenceType = /^(what|why|how|when|where|who|which|whose)\b/i.test(clean) ? "特殊疑问句" : "一般疑问句";
  } else if (/^there\s+(is|are|was|were|will be|has been|have been)\b/i.test(clean)) {
    sentenceType = "There be 存在句";
  } else if (/\b(and|but|so|yet)\b/i.test(clean) && /,\s*(and|but|so|yet|or)\s+/i.test(clean)) {
    sentenceType = "并列复合句";
  } else if (/\b(because|although|though|while|whereas|if|unless|when|since|whether|which|that|who)\b/i.test(clean)) {
    sentenceType = "主从复合句";
  }

  if (/\bworth\b/i.test(lower)) features.push("固定搭配：be worth + 名词（值得……）");
  if (/\bwhether or not\b/i.test(lower)) features.push("结构：whether or not（是否……）");
  if (/\bon the one hand\b/i.test(lower)) features.push("对比衔接：on the one hand（一方面）");
  if (/\bon the other hand\b/i.test(lower)) features.push("对比衔接：on the other hand（另一方面）");
  if (/\bdepending on\b/i.test(lower)) features.push("分词状语：depending on（取决于……）");
  if (/\bno difference between\b/i.test(lower)) features.push("搭配：difference between A and B（A与B的区别）");
  if (/\bnot only\b.+\bbut also\b/i.test(lower)) features.push("递进结构：not only ... but also ...");
  if (/\bas\s+\w+\s+as\b/i.test(lower)) features.push("同级比较：as ... as ...");
  if (/\bmore\s+.+\s+than\b/i.test(lower)) features.push("比较结构：more ... than ...");

  // Split coordinated clauses on "; ", ", and/but/so ", or " and <subject> <verb>"
  const clauseParts = clean
    .split(/(?:;\s*|,\s+(?=(?:and|but|so|yet|or)\s+)|\s+(?=(?:and|but)\s+(?:answers|people|researchers|students|it|they|we|he|she|this|that)\b))/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const clauses = clauseParts.map((part) => {
    const coordMatch = part.match(/^(and|but|so|yet|or)\s+(.+)$/i);
    if (coordMatch) {
      const subChunks = splitClauseIntoChunks(coordMatch[2], dict, lemmas);
      return {
        raw: part,
        chunks: [
          {
            role: "并列连词",
            color: "purple",
            text: coordMatch[1],
            gloss: FUNCTION_GLOSS[coordMatch[1].toLowerCase()] || "连接分句",
          },
          ...subChunks,
        ],
      };
    }
    return {
      raw: part,
      chunks: splitClauseIntoChunks(part, dict, lemmas),
    };
  });

  return {
    clean,
    sentenceType,
    features,
    chunks: clauses.flatMap((c) => c.chunks),
  };
}
