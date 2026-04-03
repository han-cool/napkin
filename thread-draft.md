# napkin SDK thread

---

**1/**

Just shipped napkin as a proper SDK. It's a knowledge system for AI agents - local-first, file-based, progressively disclosed. Until now it was CLI-only. Now it's one import:

```typescript
import { Napkin } from "napkin-ai";

const n = new Napkin("/path/to/project");

n.overview();                    // vault map with TF-IDF keywords
n.search("authentication");      // BM25 ranked results
n.read("Architecture");          // full file content
n.create({ name: "Decision", content: "# Use Postgres" });
n.dailyAppend("- Reviewed PR #42");
```

One line to initialize. Auto-creates the vault if it doesn't exist. Every method returns typed data and throws on failure. No console.log, no process.exit, no chalk. Pure computation.

---

**2/**

The design principle is progressive disclosure. Agents are terrible at managing their own context window. They either get nothing or everything. Both fail.

napkin gives them four levels to work with:

- L0: NAPKIN.md (~200 tokens) - always-loaded project context
- L1: `n.overview()` (~1-2k tokens) - vault map with keywords per folder
- L2: `n.search(query)` (~2-5k tokens) - ranked results with snippets
- L3: `n.read(file)` (~5-20k tokens) - full file content

The agent starts broad and drills down. Like how you'd actually research something. Most queries resolve at L2 without ever reading a full file.

---

**3/**

The whole thing is just markdown files in a .napkin/ directory. Obsidian-compatible - open the same vault in Obsidian and everything renders. Wikilinks, tags, frontmatter, daily notes, templates, canvas, backlinks. All of it.

```
my-project/
  .obsidian/         # Obsidian config
  .napkin/           # napkin config
  NAPKIN.md          # L0 context
  decisions/         # your notes live here
  architecture/
  daily/
  src/               # your code
```

No database. No embeddings. No vector store. The filesystem is the database.

---

**4/**

We benchmarked this against LongMemEval (ICLR 2025) - 500 questions testing long-term conversational memory. Extraction, multi-session reasoning, knowledge updates, temporal reasoning.

- Oracle (1-6 sessions): 92.0% vs 92.4% best prior
- S (~40 sessions): 91.0% vs 86% best prior
- M (~500 sessions): 83.0% vs 72% best prior

Zero preprocessing. No embeddings, no graphs, no summaries. BM25 search on markdown files. An algorithm from the 90s on files from the 80s, beating systems with actual infrastructure. The boring stack wins again.

---

**5/**

The SDK refactor was architecturally satisfying. Extracted 19 pure core modules from the CLI. Each one takes data in, returns data out. No side effects, no output formatting.

The CLI commands became thin wrappers: instantiate SDK, call method, format for terminal. 50+ methods, 347 tests, every command smoke-tested. The SDK is the source of truth. CLI is just one consumer.

Scaffold a vault with templates for different domains:

```typescript
Napkin.scaffold("/path", { template: "coding" });
// also: personal, research, company, product
```

---

**6/**

Karpathy wrote recently about using LLMs to build personal knowledge bases - raw data compiled into a .md wiki, searchable, incrementally enhanced, all viewable in Obsidian. He said "there is room here for an incredible new product instead of a hacky collection of scripts."

I agree. That's what napkin is. The plumbing between an agent and its knowledge. Files you can see in Obsidian, searched by BM25, with an API so simple there's nothing to learn. The agent reads, searches, writes back what it learns. The knowledge compounds.

---

**7/**

`npm install napkin-ai`

CLI still works. SDK is new. Works with any agent framework - it's just function calls that return data.

https://github.com/Michaelliv/napkin
