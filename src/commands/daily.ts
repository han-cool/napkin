import { Napkin } from "../sdk.js";
import { EXIT_NOT_FOUND, EXIT_USER_ERROR } from "../utils/exit-codes.js";
import { error, type OutputOptions, output, success } from "../utils/output.js";

export async function daily(opts: OutputOptions & { vault?: string }) {
  const n = new Napkin({ vault: opts.vault });
  const result = n.dailyEnsure();

  output(opts, {
    json: () => result,
    human: () => success(`Daily note: ${result.path}`),
  });
}

export async function dailyPath(opts: OutputOptions & { vault?: string }) {
  const n = new Napkin({ vault: opts.vault });
  const dp = n.dailyPath();

  output(opts, {
    json: () => ({ path: dp }),
    human: () => console.log(dp),
  });
}

export async function dailyRead(opts: OutputOptions & { vault?: string }) {
  const n = new Napkin({ vault: opts.vault });

  let result: { path: string; content: string };
  try {
    result = n.dailyRead();
  } catch (e: unknown) {
    error((e as Error).message);
    process.exit(EXIT_NOT_FOUND);
  }

  output(opts, {
    json: () => result,
    human: () => console.log(result.content),
  });
}

export async function dailyAppend(
  opts: OutputOptions & { vault?: string; content?: string; inline?: boolean },
) {
  const n = new Napkin({ vault: opts.vault });
  if (!opts.content) {
    error("No content specified. Use --content <text>");
    process.exit(EXIT_USER_ERROR);
  }

  const dp = n.dailyAppend(opts.content, opts.inline);

  output(opts, {
    json: () => ({ path: dp, appended: true }),
    human: () => success(`Appended to ${dp}`),
  });
}

export async function dailyPrepend(
  opts: OutputOptions & { vault?: string; content?: string; inline?: boolean },
) {
  const n = new Napkin({ vault: opts.vault });
  if (!opts.content) {
    error("No content specified. Use --content <text>");
    process.exit(EXIT_USER_ERROR);
  }

  const dp = n.dailyPrepend(opts.content, opts.inline);

  output(opts, {
    json: () => ({ path: dp, prepended: true }),
    human: () => success(`Prepended to ${dp}`),
  });
}
