import * as fs from "node:fs";
import * as path from "node:path";
import { TEMPLATES, type VaultTemplate } from "../templates/index.js";
import {
  DEFAULT_CONFIG,
  type NapkinConfig,
  saveConfig,
} from "../utils/config.js";

export interface InitResult {
  status: string;
  path: string;
  napkin?: boolean;
  configCreated?: boolean;
  siblingLayout?: boolean;
  template?: string | null;
  files?: string[];
}

export interface TemplateInfo {
  name: string;
  description: string;
  dirs: string[];
}

function scaffoldTemplate(
  targetDir: string,
  template: VaultTemplate,
): string[] {
  const created: string[] = [];

  for (const dir of template.dirs) {
    const dirPath = path.join(targetDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      created.push(`${dir}/`);
    }
  }

  for (const [filePath, content] of Object.entries(template.files)) {
    const fullPath = path.join(targetDir, filePath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      created.push(filePath);
    }
  }

  const napkinPath = path.join(targetDir, "NAPKIN.md");
  if (!fs.existsSync(napkinPath)) {
    fs.writeFileSync(napkinPath, template.napkinMd);
    created.push("NAPKIN.md");
  }

  return created;
}

export function initVault(opts: {
  path?: string;
  template?: string;
}): InitResult {
  if (!opts.path) {
    throw new Error("No path specified for vault initialization");
  }
  const targetDir = path.resolve(opts.path);
  const napkinDir = path.join(targetDir, ".napkin");
  const existingObsidian = path.join(targetDir, ".obsidian");
  const isSiblingLayout =
    fs.existsSync(existingObsidian) &&
    fs.statSync(existingObsidian).isDirectory();

  const napkinExists = fs.existsSync(napkinDir);
  const configExists = fs.existsSync(path.join(napkinDir, "config.json"));

  if (napkinExists && configExists && !opts.template) {
    return { status: "exists", path: napkinDir };
  }

  if (opts.template && !TEMPLATES[opts.template]) {
    throw new Error(
      `Unknown template: ${opts.template}. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  if (!napkinExists) {
    fs.mkdirSync(napkinDir, { recursive: true });
  }

  if (!fs.existsSync(path.join(napkinDir, "config.json"))) {
    if (isSiblingLayout) {
      const config: NapkinConfig = {
        ...DEFAULT_CONFIG,
        vault: { root: "..", obsidian: "../.obsidian" },
      };
      saveConfig(napkinDir, config, existingObsidian);
    } else {
      saveConfig(napkinDir, DEFAULT_CONFIG);
    }
  }

  const contentRoot = isSiblingLayout ? targetDir : napkinDir;

  let templateFiles: string[] = [];
  if (opts.template) {
    templateFiles = scaffoldTemplate(contentRoot, TEMPLATES[opts.template]);
  }

  return {
    status: "created",
    path: napkinDir,
    napkin: !napkinExists,
    configCreated: !configExists,
    siblingLayout: isSiblingLayout,
    template: opts.template || null,
    files: templateFiles,
  };
}

export function getInitTemplates(): TemplateInfo[] {
  return Object.values(TEMPLATES).map((t) => ({
    name: t.name,
    description: t.description,
    dirs: t.dirs,
  }));
}
