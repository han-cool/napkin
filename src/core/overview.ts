import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "../utils/config.js";
import { listFiles } from "../utils/files.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { extractHeadings, extractTags } from "../utils/markdown.js";

export interface OverviewFolder {
  path: string;
  notes: number;
  keywords: string[];
  tags: string[];
}

export interface VaultOverview {
  context?: string;
  overview: OverviewFolder[];
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "it",
  "as",
  "be",
  "was",
  "are",
  "this",
  "that",
  "not",
  "has",
  "have",
  "had",
  "will",
  "can",
  "may",
  "do",
  "does",
  "did",
  "been",
  "being",
  "would",
  "could",
  "should",
  "its",
  "my",
  "your",
  "our",
  "their",
  "his",
  "her",
  "we",
  "they",
  "you",
  "he",
  "she",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "than",
  "too",
  "very",
  "just",
  "about",
  "above",
  "after",
  "again",
  "also",
  "any",
  "because",
  "before",
  "between",
  "down",
  "during",
  "even",
  "first",
  "get",
  "how",
  "if",
  "into",
  "like",
  "made",
  "make",
  "many",
  "much",
  "new",
  "no",
  "now",
  "off",
  "old",
  "only",
  "one",
  "out",
  "over",
  "own",
  "same",
  "so",
  "still",
  "then",
  "there",
  "these",
  "those",
  "through",
  "under",
  "up",
  "use",
  "used",
  "using",
  "want",
  "way",
  "well",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "work",
  "see",
  "here",
  "need",
  "etc",
  "two",
  "next",
]); // prettier-ignore

function stripNoise(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    .replace(/https?:\/\/[^\s)>\]]+/g, "")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
    .replace(/\b[a-f0-9]{8,}\b/g, "");
}

function tokenize(text: string): string[] {
  const cleaned = stripNoise(text);
  return (cleaned.toLowerCase().match(/[a-z]{3,}/g) || []).filter(
    (w) => !STOP_WORDS.has(w),
  );
}

function extractBigrams(text: string): string[] {
  const cleaned = stripNoise(text);
  const words = (cleaned.toLowerCase().match(/[a-z]{3,}/g) || []).filter(
    (w) => !STOP_WORDS.has(w),
  );
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

interface WeightedText {
  text: string;
  weight: number;
}

function buildTF(sources: WeightedText[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const { text, weight } of sources) {
    for (const w of tokenize(text)) {
      freq.set(w, (freq.get(w) || 0) + weight);
    }
    for (const b of extractBigrams(text)) {
      freq.set(b, (freq.get(b) || 0) + weight);
    }
  }
  return freq;
}

function extractKeywordsTFIDF(
  folderTF: Map<string, number>,
  documentFrequency: Map<string, number>,
  totalFolders: number,
  maxKeywords: number,
): string[] {
  const scored: [string, number][] = [];
  for (const [term, tf] of folderTF) {
    const isBigram = term.includes(" ");
    if (isBigram) {
      const [a, b] = term.split(" ");
      if (tf < 2 || a === b) continue;
    }

    const df = documentFrequency.get(term) || 1;
    const idf = Math.log(1 + totalFolders / df);
    scored.push([term, tf * idf]);
  }

  const sorted = scored.sort((a, b) => b[1] - a[1]);
  const selected: string[] = [];
  const suppressed = new Set<string>();
  for (const [term] of sorted) {
    if (selected.length >= maxKeywords) break;
    if (suppressed.has(term)) continue;
    selected.push(term);
    if (term.includes(" ")) {
      for (const part of term.split(" ")) {
        suppressed.add(part);
      }
    }
  }
  return selected;
}

function buildOverviewFolders(
  vaultPath: string,
  maxDepth: number,
  maxKeywords: number,
): OverviewFolder[] {
  const files = listFiles(vaultPath, { ext: "md" });

  const folderFiles = new Map<string, string[]>();
  for (const file of files) {
    const dir = path.dirname(file);
    const folder = dir === "." ? "/" : dir;
    if (!folderFiles.has(folder)) folderFiles.set(folder, []);
    folderFiles.get(folder)?.push(file);
  }

  const folderData = new Map<
    string,
    { tf: Map<string, number>; tags: Set<string>; noteCount: number }
  >();

  for (const [folder, folderFileList] of folderFiles) {
    const depth = folder === "/" ? 0 : folder.split("/").length;
    if (depth > maxDepth) continue;

    const allTags = new Set<string>();
    const weightedSources: WeightedText[] = [];

    for (const file of folderFileList) {
      const content = fs.readFileSync(path.join(vaultPath, file), "utf-8");
      const { properties } = parseFrontmatter(content);

      const inlineTags = extractTags(content);
      for (const t of inlineTags) allTags.add(t);
      if (Array.isArray(properties.tags)) {
        for (const t of properties.tags) allTags.add(String(t));
      }

      const headings = extractHeadings(content);
      for (const h of headings) {
        weightedSources.push({ text: h.text, weight: 3 });
      }
      weightedSources.push({
        text: path.basename(file, ".md"),
        weight: 2,
      });
      if (properties.title) {
        weightedSources.push({ text: String(properties.title), weight: 2 });
      }

      const body = content.replace(/^---[\s\S]*?---\n?/, "");
      weightedSources.push({ text: body, weight: 1 });
    }

    folderData.set(folder, {
      tf: buildTF(weightedSources),
      tags: allTags,
      noteCount: folderFileList.length,
    });
  }

  const documentFrequency = new Map<string, number>();
  for (const { tf } of folderData.values()) {
    for (const term of tf.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  const totalFolders = folderData.size;

  const results: OverviewFolder[] = [];
  for (const [folder, data] of [...folderData.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const keywords = extractKeywordsTFIDF(
      data.tf,
      documentFrequency,
      totalFolders,
      maxKeywords,
    );

    results.push({
      path: folder,
      notes: data.noteCount,
      keywords,
      tags: [...data.tags].sort(),
    });
  }

  return results;
}

export function getOverview(
  contentPath: string,
  configPath: string,
  opts?: { depth?: number; keywords?: number },
): VaultOverview {
  const config = loadConfig(configPath);
  const maxDepth = opts?.depth ?? config.overview.depth;
  const maxKeywords = opts?.keywords ?? config.overview.keywords;

  const folders = buildOverviewFolders(contentPath, maxDepth, maxKeywords);

  const contextPath = path.join(contentPath, "NAPKIN.md");
  const context = fs.existsSync(contextPath)
    ? fs.readFileSync(contextPath, "utf-8").trim()
    : undefined;

  return {
    ...(context ? { context } : {}),
    overview: folders,
  };
}
