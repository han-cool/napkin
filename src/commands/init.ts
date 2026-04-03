import { Napkin } from "../sdk.js";
import { EXIT_ERROR } from "../utils/exit-codes.js";
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

export async function init(opts: InitOptions) {
  let result: ReturnType<typeof Napkin.init>;
  try {
    result = Napkin.init({
      path: opts.path || process.cwd(),
      template: opts.template,
    });
  } catch (e: unknown) {
    error((e as Error).message);
    process.exit(EXIT_ERROR);
  }

  if (result.status === "exists") {
    output(opts, {
      json: () => result,
      human: () => {
        console.log(
          `${dim("Vault already initialized at")} ${bold(result.path)}`,
        );
      },
    });
    return;
  }

  output(opts, {
    json: () => result,
    human: () => {
      console.log(`${dim("Initialized vault at")} ${bold(result.path)}`);
      if (result.napkin) console.log(`  ${dim("created")} .napkin/`);
      if (result.configCreated) console.log(`  ${dim("created")} config.json`);
      if (result.siblingLayout)
        console.log(
          `  ${dim("layout")}  sibling (existing .obsidian/ detected)`,
        );
      if (result.template) {
        console.log(`  ${dim("template")} ${bold(result.template)}`);
        for (const f of result.files || []) {
          console.log(`  ${dim("created")} ${f}`);
        }
      }
      console.log("");
      const napkinMdPath = result.siblingLayout
        ? "NAPKIN.md"
        : ".napkin/NAPKIN.md";
      success(`Edit ${napkinMdPath} to set your context.`);
    },
  });
}

export async function initTemplates(opts: OutputOptions) {
  const templates = Napkin.initTemplates();

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
