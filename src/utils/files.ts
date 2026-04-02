import * as fs from "node:fs";
import * as path from "node:path";

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  created: number;
  modified: number;
}

export interface ListFilesOptions {
  folder?: string;
  ext?: string;
}

/**
 * Recursively list files in a vault, skipping .obsidian, .git, .trash, node_modules.
 */
export function listFiles(
  vaultPath: string,
  opts?: ListFilesOptions,
): string[] {
  const results: string[] = [];
  const skipDirs = new Set([
    ".obsidian",
    ".git",
    ".trash",
    ".nanny",
    ".napkin",
    "node_modules",
  ]);
  // Internal napkin files that shouldn't appear in vault content listings
  const skipFiles = new Set(["config.json", "search-cache.json"]);

  const baseDir = opts?.folder ? path.join(vaultPath, opts.folder) : vaultPath;
  if (!fs.existsSync(baseDir)) return results;

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") && skipDirs.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(fullPath);
      } else if (entry.isFile()) {
        // Skip internal config files at vault root
        if (dir === vaultPath && skipFiles.has(entry.name)) continue;
        const rel = path.relative(vaultPath, fullPath);
        if (opts?.ext) {
          if (path.extname(entry.name).slice(1) === opts.ext) {
            results.push(rel);
          }
        } else {
          results.push(rel);
        }
      }
    }
  }

  walk(baseDir);
  return results.sort();
}

/**
 * List folders in a vault, skipping hidden/system dirs.
 */
export function listFolders(
  vaultPath: string,
  parentFolder?: string,
): string[] {
  const results: string[] = [];
  const skipDirs = new Set([
    ".obsidian",
    ".git",
    ".trash",
    ".nanny",
    ".napkin",
    "node_modules",
  ]);

  const baseDir = parentFolder ? path.join(vaultPath, parentFolder) : vaultPath;
  if (!fs.existsSync(baseDir)) return results;

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (skipDirs.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(path.relative(vaultPath, fullPath));
        walk(fullPath);
      }
    }
  }

  walk(baseDir);
  return results.sort();
}

/**
 * Resolve a file reference (wikilink-style name or exact path) to a relative path in the vault.
 * - If fileRef contains '/' or ends with '.md', treat as exact path
 * - Otherwise, search all .md files for a matching basename
 */
export function resolveFile(vaultPath: string, fileRef: string): string | null {
  // Exact path
  if (fileRef.includes("/") || fileRef.endsWith(".md")) {
    const ref = fileRef.endsWith(".md") ? fileRef : `${fileRef}.md`;
    const fullPath = path.join(vaultPath, ref);
    if (fs.existsSync(fullPath)) return ref;
    return null;
  }

  // Wikilink-style: search by basename
  const target = fileRef.toLowerCase();
  const allFiles = listFiles(vaultPath, { ext: "md" });
  for (const file of allFiles) {
    const basename = path.basename(file, ".md").toLowerCase();
    if (basename === target) return file;
  }
  return null;
}

/**
 * Suggest similar filenames when a file isn't found.
 * Returns up to 3 suggestions sorted by similarity.
 */
export function suggestFile(vaultPath: string, fileRef: string): string[] {
  const target = fileRef.toLowerCase();
  const allFiles = listFiles(vaultPath, { ext: "md" });
  const scored = allFiles
    .map((f) => {
      const basename = path.basename(f, ".md").toLowerCase();
      // Simple substring match scoring
      let score = 0;
      if (basename.includes(target) || target.includes(basename)) score += 3;
      // Shared prefix
      let prefix = 0;
      while (
        prefix < basename.length &&
        prefix < target.length &&
        basename[prefix] === target[prefix]
      )
        prefix++;
      score += prefix;
      return { file: f, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map((s) => s.file);
}

/**
 * Read a file's contents, resolving by name or path.
 */
export function readFile(
  vaultPath: string,
  fileRef: string,
): { path: string; content: string } {
  const resolved = resolveFile(vaultPath, fileRef);
  if (!resolved) {
    throw new Error(`File not found: ${fileRef}`);
  }
  const fullPath = path.join(vaultPath, resolved);
  const content = fs.readFileSync(fullPath, "utf-8");
  return { path: resolved, content };
}

/**
 * Get file info for a resolved file path.
 */
export function getFileInfo(vaultPath: string, relativePath: string): FileInfo {
  const fullPath = path.join(vaultPath, relativePath);
  const stat = fs.statSync(fullPath);
  const ext = path.extname(relativePath);
  return {
    path: relativePath,
    name: path.basename(relativePath, ext),
    extension: ext.slice(1),
    size: stat.size,
    created: stat.birthtimeMs,
    modified: stat.mtimeMs,
  };
}
