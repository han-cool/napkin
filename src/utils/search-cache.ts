import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { listFiles } from "./files.js";

const CACHE_FILE = "search-cache.json";

export interface CachedDoc {
  id: number;
  file: string;
  basename: string;
  mtime: number;
}

export interface SearchCacheData {
  fingerprint: string;
  /** JSON-serialized MiniSearch index */
  index: string;
  /** Doc metadata (without content — content is re-read for snippets) */
  docs: CachedDoc[];
  /** file -> inbound link count */
  backlinkCounts: Record<string, number>;
}

/**
 * Compute a fingerprint of all .md files in the vault based on paths and mtimes.
 * Changes when files are added, removed, or modified.
 */
export function computeFingerprint(
  contentPath: string,
  folder?: string,
): string {
  const files = listFiles(contentPath, { folder, ext: "md" });
  const entries: string[] = [];

  for (const file of files) {
    const stat = fs.statSync(path.join(contentPath, file));
    entries.push(`${file}:${stat.mtimeMs}`);
  }

  return crypto.createHash("md5").update(entries.join("\n")).digest("hex");
}

/**
 * Load cached search index if the fingerprint matches.
 * Returns null if no cache, fingerprint mismatch, or corrupted data.
 */
export function loadSearchCache(
  configPath: string,
  currentFingerprint: string,
): SearchCacheData | null {
  const cachePath = path.join(configPath, CACHE_FILE);
  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const data: SearchCacheData = JSON.parse(raw);
    if (data.fingerprint !== currentFingerprint) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Save search index cache to disk.
 */
export function saveSearchCache(
  configPath: string,
  data: SearchCacheData,
): void {
  fs.writeFileSync(path.join(configPath, CACHE_FILE), JSON.stringify(data));
}
