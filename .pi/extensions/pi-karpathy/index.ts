/**
 * pi-karpathy - Native pi tools for LLM knowledge bases.
 *
 * Registers napkin SDK methods as first-class pi tools.
 * The LLM gets typed tool calls instead of shelling out to the CLI.
 *
 * Tools:
 *   napkin_overview    - Vault map with keywords (L1)
 *   napkin_search      - BM25 ranked search with snippets (L2)
 *   napkin_read        - Read full file content (L3)
 *   napkin_create      - Create a note
 *   napkin_append      - Append to a note
 *   napkin_prepend     - Prepend to a note
 *   napkin_daily       - Daily note operations
 *   napkin_links       - Backlinks, outgoing, unresolved, orphans, deadends
 *   napkin_lint        - Vault health: orphans, unresolved links, missing properties
 *   napkin_files       - List files, folders, file info
 *   napkin_tags        - List tags with counts
 *   napkin_tasks       - List/toggle tasks
 *   napkin_properties  - Get/set/remove frontmatter properties
 */

import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Napkin } from "../../../src/sdk.js";

function fmt(details: Record<string, unknown>, text: string) {
  return { content: [{ type: "text" as const, text }], details };
}

export default function (pi: ExtensionAPI) {
  let n: Napkin | null = null;

  pi.on("session_start", async (_event, ctx) => {
    try {
      n = new Napkin(ctx.cwd);
    } catch {
      n = null;
    }

    if (!n) {
      if (ctx.hasUI) {
        ctx.ui.setStatus("napkin", ctx.ui.theme.fg("dim", "napkin: no vault"));
      }
      return;
    }

    // Inject vault overview into context
    const overview = n.overview();
    const contextParts: string[] = [];

    if (overview.context) {
      contextParts.push(overview.context);
    }

    if (overview.overview.length > 0) {
      contextParts.push(
        overview.overview
          .map(
            (f) =>
              `${f.path}/\n  keywords: ${f.keywords.join(", ")}\n  notes: ${f.notes}`,
          )
          .join("\n"),
      );
    }

    if (contextParts.length > 0) {
      const entries = ctx.sessionManager.getEntries();
      const alreadyInjected = entries.some(
        (e) =>
          e.type === "message" &&
          e.message.role === "custom" &&
          "customType" in e.message &&
          e.message.customType === "napkin-context",
      );

      if (!alreadyInjected) {
        pi.sendMessage({
          customType: "napkin-context",
          content:
            "## Napkin vault\n\n" +
            "You have napkin tools for this vault. Use napkin_search to find content, " +
            "napkin_read to read files, napkin_create/napkin_append to write.\n\n" +
            contextParts.join("\n\n"),
          display: false,
        });
      }
    }

    if (ctx.hasUI) {
      const theme = ctx.ui.theme;
      const info = n.info();
      ctx.ui.setStatus(
        "napkin",
        theme.fg("dim", `napkin: ${info.files} files`),
      );
    }
  });

  // ── Overview (L1) ─────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_overview",
    label: "Napkin Overview",
    description:
      "Get vault overview with folder map and TF-IDF keywords. Use as the starting point for exploring the vault.",
    promptSnippet: "Vault map with keywords per folder",
    promptGuidelines: [
      "Use napkin_overview first to understand vault structure before searching or reading.",
      "Use napkin_search to find relevant content before reading full files.",
      "When creating notes, use [[wikilinks]] to connect related concepts.",
      "Unresolved links ([[concepts]] that don't exist yet) are candidates for new articles - use napkin_lint to find them.",
      "Append to existing notes instead of creating duplicates - search first.",
      "Use napkin_daily to log discoveries and link them back to relevant notes.",
    ],
    parameters: Type.Object({
      depth: Type.Optional(
        Type.Number({ description: "Max folder depth (default: 3)" }),
      ),
      keywords: Type.Optional(
        Type.Number({
          description: "Max keywords per folder (default: 8)",
        }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");
      const result = n.overview({
        depth: params.depth,
        keywords: params.keywords,
      });
      const lines: string[] = [];
      if (result.context) lines.push(result.context);
      for (const f of result.overview) {
        lines.push(
          `${f.path}/\n  keywords: ${f.keywords.join(", ")}\n  notes: ${f.notes}`,
        );
      }
      return fmt({ overview: result }, lines.join("\n"));
    },
  });

  // ── Search (L2) ───────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_search",
    label: "Napkin Search",
    description:
      "Search the vault using BM25 ranking with backlinks and recency. Returns ranked results with snippets.",
    promptSnippet: "BM25 search with snippets",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      limit: Type.Optional(
        Type.Number({ description: "Max results (default: 30)" }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");
      const results = n.search(params.query, { limit: params.limit });
      if (results.length === 0) {
        return fmt({ results: [] }, `No results for "${params.query}"`);
      }
      const text = results
        .map((r) => {
          const snippets = r.snippets
            .map((s) => `  ${s.line}: ${s.text}`)
            .join("\n");
          return `${r.file} (score: ${r.score}, links: ${r.links})\n${snippets}`;
        })
        .join("\n\n");
      return fmt({ results }, text);
    },
  });

  // ── Read (L3) ─────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_read",
    label: "Napkin Read",
    description: "Read full file content from the vault.",
    promptSnippet: "Read a vault file",
    parameters: Type.Object({
      file: Type.String({
        description: "File name (wikilink-style) or path",
      }),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");
      const result = n.read(params.file);
      return fmt({ path: result.path }, result.content);
    },
  });

  // ── Create ────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_create",
    label: "Napkin Create",
    description:
      "Create a new note in the vault. Use wikilinks ([[Note Name]]) to connect notes.",
    promptSnippet: "Create a vault note",
    parameters: Type.Object({
      name: Type.String({ description: "Note name (without .md)" }),
      content: Type.String({ description: "Markdown content" }),
      folder: Type.Optional(
        Type.String({ description: "Target folder" }),
      ),
      template: Type.Optional(
        Type.String({ description: "Template name to use" }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");
      const pathStr = params.folder
        ? `${params.folder}/${params.name}.md`
        : undefined;
      const result = n.create({
        name: params.name,
        content: params.content,
        path: pathStr,
        template: params.template,
      });
      return fmt({ path: result.path, created: result.created }, `Created ${result.path}`);
    },
  });

  // ── Append ────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_append",
    label: "Napkin Append",
    description: "Append content to an existing note.",
    promptSnippet: "Append to a vault note",
    parameters: Type.Object({
      file: Type.String({ description: "File name or path" }),
      content: Type.String({ description: "Content to append" }),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");
      const filePath = n.append(params.file, params.content);
      return fmt({ path: filePath }, `Appended to ${filePath}`);
    },
  });

  // ── Prepend ───────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_prepend",
    label: "Napkin Prepend",
    description:
      "Prepend content to a note (after frontmatter if present).",
    promptSnippet: "Prepend to a vault note",
    parameters: Type.Object({
      file: Type.String({ description: "File name or path" }),
      content: Type.String({ description: "Content to prepend" }),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");
      const filePath = n.prepend(params.file, params.content);
      return fmt({ path: filePath }, `Prepended to ${filePath}`);
    },
  });

  // ── Daily ─────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_daily",
    label: "Napkin Daily",
    description: "Daily note operations: read, append, prepend, ensure.",
    promptSnippet: "Daily note operations",
    parameters: Type.Object({
      action: StringEnum(["read", "append", "prepend", "ensure"] as const),
      content: Type.Optional(
        Type.String({
          description: "Content for append/prepend",
        }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");

      if (params.action === "ensure") {
        const result = n.dailyEnsure();
        return fmt(
          { path: result.path, created: result.created },
          result.created
            ? `Created daily note: ${result.path}`
            : `Daily note exists: ${result.path}`,
        );
      }
      if (params.action === "read") {
        n.dailyEnsure();
        const result = n.dailyRead();
        return fmt({ path: result.path }, result.content || "(empty)");
      }
      if (params.action === "append") {
        if (!params.content) throw new Error("Content required for append");
        n.dailyEnsure();
        const filePath = n.dailyAppend(params.content);
        return fmt({ path: filePath }, `Appended to ${filePath}`);
      }
      // prepend
      if (!params.content) throw new Error("Content required for prepend");
      n.dailyEnsure();
      const filePath = n.dailyPrepend(params.content);
      return fmt({ path: filePath }, `Prepended to ${filePath}`);
    },
  });

  // ── Links ─────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_links",
    label: "Napkin Links",
    description:
      "Query the link graph: backlinks, outgoing links, unresolved, orphans, deadends.",
    promptSnippet: "Query vault link graph",
    parameters: Type.Object({
      action: StringEnum([
        "back",
        "out",
        "unresolved",
        "orphans",
        "deadends",
      ] as const),
      file: Type.Optional(
        Type.String({
          description: "File name (required for back/out)",
        }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");

      if (params.action === "back") {
        if (!params.file) throw new Error("File required for backlinks");
        const links = n.linksBack(params.file);
        return fmt({ links }, links.length ? links.join("\n") : "No backlinks");
      }
      if (params.action === "out") {
        if (!params.file) throw new Error("File required for outgoing links");
        const links = n.linksOut(params.file);
        return fmt({ links }, links.length ? links.join("\n") : "No outgoing links");
      }
      if (params.action === "unresolved") {
        const unresolved = n.linksUnresolved();
        if (unresolved.length === 0) {
          return fmt({ unresolved: [] }, "No unresolved links");
        }
        const text = unresolved
          .map(
            ([target, sources]) =>
              `[[${target}]] referenced by: ${sources.join(", ")}`,
          )
          .join("\n");
        return fmt({ unresolved }, text);
      }
      if (params.action === "orphans") {
        const orphans = n.orphans();
        return fmt(
          { orphans },
          orphans.length ? orphans.join("\n") : "No orphans",
        );
      }
      // deadends
      const deadends = n.deadends();
      return fmt(
        { deadends },
        deadends.length ? deadends.join("\n") : "No deadends",
      );
    },
  });

  // ── Lint ──────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_lint",
    label: "Napkin Lint",
    description:
      "Vault health check: finds orphan notes, unresolved links, deadend notes, and notes missing specific properties.",
    promptSnippet: "Vault health check",
    parameters: Type.Object({
      requiredProperties: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Properties every note should have (e.g. ['tags', 'status'])",
        }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");

      const orphans = n.orphans();
      const deadends = n.deadends();
      const unresolved = n.linksUnresolved();

      const sections: string[] = [];

      if (unresolved.length > 0) {
        sections.push(
          `## Unresolved links (${unresolved.length})\n` +
            unresolved
              .map(
                ([target, sources]) =>
                  `- [[${target}]] referenced by: ${sources.join(", ")}`,
              )
              .join("\n"),
        );
      }

      if (orphans.length > 0) {
        sections.push(
          `## Orphan notes (${orphans.length})\nNo incoming links:\n` +
            orphans.map((f) => `- ${f}`).join("\n"),
        );
      }

      if (deadends.length > 0) {
        sections.push(
          `## Deadend notes (${deadends.length})\nNo outgoing links:\n` +
            deadends.map((f) => `- ${f}`).join("\n"),
        );
      }

      if (params.requiredProperties && params.requiredProperties.length > 0) {
        const files = n.fileList({ ext: "md" });
        const missing: string[] = [];
        for (const file of files) {
          for (const prop of params.requiredProperties) {
            try {
              const { value } = n.propertyGet(file, prop);
              if (value === undefined || value === null || value === "") {
                missing.push(`- ${file}: missing \`${prop}\``);
              }
            } catch {
              missing.push(`- ${file}: missing \`${prop}\``);
            }
          }
        }
        if (missing.length > 0) {
          sections.push(
            `## Missing properties (${missing.length})\n` +
              missing.join("\n"),
          );
        }
      }

      const text =
        sections.length > 0
          ? sections.join("\n\n")
          : "Vault is clean. No issues found.";

      return fmt(
        {
          orphans: orphans.length,
          deadends: deadends.length,
          unresolved: unresolved.length,
        },
        text,
      );
    },
  });

  // ── Files ─────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_files",
    label: "Napkin Files",
    description: "List files, folders, or get file info and outline.",
    promptSnippet: "List files and folders",
    parameters: Type.Object({
      action: StringEnum(["list", "folders", "info", "outline"] as const),
      file: Type.Optional(
        Type.String({
          description: "File name (for info/outline)",
        }),
      ),
      folder: Type.Optional(
        Type.String({ description: "Filter by folder (for list)" }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");

      if (params.action === "list") {
        const files = n.fileList({ folder: params.folder });
        return fmt(
          { files },
          `${files.length} files:\n${files.join("\n")}`,
        );
      }
      if (params.action === "folders") {
        const folders = n.folders();
        return fmt({ folders }, folders.join("\n"));
      }
      if (params.action === "info") {
        if (!params.file) throw new Error("File required for info");
        const info = n.fileInfo(params.file);
        return fmt(
          { info },
          `path: ${info.path}\nsize: ${info.size}\ncreated: ${info.created}\nmodified: ${info.modified}`,
        );
      }
      // outline
      if (!params.file) throw new Error("File required for outline");
      const headings = n.outline(params.file);
      const text = headings
        .map((h) => `${"  ".repeat(h.level - 1)}${h.text}`)
        .join("\n");
      return fmt({ headings }, text || "No headings");
    },
  });

  // ── Tags ──────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_tags",
    label: "Napkin Tags",
    description: "List all tags in the vault with occurrence counts.",
    promptSnippet: "List vault tags",
    parameters: Type.Object({}),

    async execute() {
      if (!n) throw new Error("No vault found");
      const { tagCounts } = n.tags();
      const entries = Array.from(tagCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      );
      const text = entries
        .map(([tag, count]) => `${tag}: ${count}`)
        .join("\n");
      return fmt(
        { tags: Object.fromEntries(entries) },
        text || "No tags",
      );
    },
  });

  // ── Tasks ─────────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_tasks",
    label: "Napkin Tasks",
    description: "List or toggle tasks across the vault.",
    promptSnippet: "List and manage tasks",
    parameters: Type.Object({
      action: StringEnum(["list", "toggle"] as const),
      filter: Type.Optional(
        StringEnum(["all", "todo", "done"] as const),
      ),
      file: Type.Optional(
        Type.String({
          description: "Filter by file, or target file for toggle",
        }),
      ),
      line: Type.Optional(
        Type.Number({
          description: "Line number (required for toggle)",
        }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");

      if (params.action === "toggle") {
        if (!params.file || !params.line)
          throw new Error("File and line required for toggle");
        const task = n.taskShow(params.file, params.line);
        const newStatus = task.currentStatus === "x" ? " " : "x";
        const result = n.taskUpdate(params.file, params.line, newStatus);
        return fmt(
          { newStatus: result.newStatus, text: result.text },
          `[${result.newStatus}] ${result.text}`,
        );
      }

      // list
      const tasks = n.tasks({
        file: params.file,
        todo: params.filter === "todo",
        done: params.filter === "done",
      });

      if (tasks.length === 0) {
        return fmt({ count: 0 }, "No tasks found");
      }

      const text = tasks
        .map((t) => `[${t.status}] ${t.text} (${t.file}:${t.line})`)
        .join("\n");
      return fmt({ count: tasks.length }, text);
    },
  });

  // ── Properties ────────────────────────────────────────────────

  pi.registerTool({
    name: "napkin_properties",
    label: "Napkin Properties",
    description:
      "Get, set, remove, or list frontmatter properties on vault notes.",
    promptSnippet: "Manage note frontmatter properties",
    parameters: Type.Object({
      action: StringEnum(["get", "set", "remove", "list"] as const),
      file: Type.Optional(
        Type.String({ description: "File name" }),
      ),
      name: Type.Optional(
        Type.String({ description: "Property name" }),
      ),
      value: Type.Optional(
        Type.String({ description: "Property value (for set)" }),
      ),
    }),

    async execute(_id, params) {
      if (!n) throw new Error("No vault found");

      if (params.action === "list") {
        const props = n.properties(params.file);
        const entries = Array.from(props.entries()).sort(
          (a, b) => b[1] - a[1],
        );
        const text = entries
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        return fmt(
          { properties: Object.fromEntries(entries) },
          text || "No properties",
        );
      }
      if (params.action === "get") {
        if (!params.file || !params.name)
          throw new Error("File and name required for get");
        const result = n.propertyGet(params.file, params.name);
        return fmt(
          { property: result.property, value: result.value },
          `${result.property}: ${result.value ?? "(not set)"}`,
        );
      }
      if (params.action === "set") {
        if (!params.file || !params.name || params.value === undefined)
          throw new Error("File, name, and value required for set");
        const result = n.propertySet(params.file, params.name, params.value);
        return fmt(
          { path: result.path, property: result.property, value: result.value },
          `Set ${result.property} = ${result.value} on ${result.path}`,
        );
      }
      // remove
      if (!params.file || !params.name)
        throw new Error("File and name required for remove");
      const result = n.propertyRemove(params.file, params.name);
      return fmt(
        { path: result.path, removed: result.removed },
        `Removed ${result.removed} from ${result.path}`,
      );
    },
  });
}
