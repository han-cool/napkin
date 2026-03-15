import * as fs from "node:fs";
import * as path from "node:path";
import { TEMPLATES, type VaultTemplate } from "../templates/index.js";
import {
  bold,
  dim,
  error,
  type OutputOptions,
  output,
  success,
} from "../utils/output.js";

export interface InitOptions extends OutputOptions {
  path?: string;
  template?: string;
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

export async function init(opts: InitOptions) {
  const targetDir = path.resolve(opts.path || process.cwd());
  const napkinDir = path.join(targetDir, ".napkin");
  const obsidianDir = path.join(targetDir, ".obsidian");

  const napkinExists = fs.existsSync(napkinDir);
  const obsidianExists = fs.existsSync(obsidianDir);

  if (napkinExists && obsidianExists && !opts.template) {
    output(opts, {
      json: () => ({
        status: "exists",
        path: targetDir,
        napkin: true,
        obsidian: true,
      }),
      human: () => {
        console.log(
          `${dim("Vault already initialized at")} ${bold(targetDir)}`,
        );
      },
    });
    return;
  }

  if (opts.template && !TEMPLATES[opts.template]) {
    error(
      `Unknown template: ${opts.template}. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
    process.exit(1);
  }

  if (!napkinExists) {
    fs.mkdirSync(napkinDir, { recursive: true });
  }

  if (!obsidianExists) {
    fs.mkdirSync(obsidianDir, { recursive: true });
    fs.writeFileSync(
      path.join(obsidianDir, "app.json"),
      JSON.stringify({ alwaysUpdateLinks: true }, null, 2),
    );
  }

  let templateFiles: string[] = [];
  if (opts.template) {
    templateFiles = scaffoldTemplate(targetDir, TEMPLATES[opts.template]);
  }

  output(opts, {
    json: () => ({
      status: "created",
      path: targetDir,
      napkin: !napkinExists,
      obsidian: !obsidianExists,
      template: opts.template || null,
      files: templateFiles,
    }),
    human: () => {
      console.log(`${dim("Initialized vault at")} ${bold(targetDir)}`);
      if (!napkinExists) console.log(`  ${dim("created")} .napkin/`);
      if (!obsidianExists) console.log(`  ${dim("created")} .obsidian/`);
      if (opts.template) {
        console.log(`  ${dim("template")} ${bold(opts.template)}`);
        for (const f of templateFiles) {
          console.log(`  ${dim("created")} ${f}`);
        }
      }
      console.log("");
      success("Edit NAPKIN.md to set your context.");
    },
  });
}

export async function initTemplates(opts: OutputOptions) {
  const templates = Object.values(TEMPLATES).map((t) => ({
    name: t.name,
    description: t.description,
    dirs: t.dirs,
  }));

  output(opts, {
    json: () => ({ templates }),
    human: () => {
      for (const t of templates) {
        console.log(`${bold(t.name)} — ${t.description}`);
        console.log(`  ${dim("folders:")} ${t.dirs.join(", ")}`);
      }
    },
  });
}
