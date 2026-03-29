# napkin

🧻 Knowledge system for agents. Local-first, file-based, progressively disclosed.

Every great idea started on a napkin.

## Install

```bash
npm install -g napkin-ai
```

As a pi package (includes extensions + skills):

```bash
pi install npm:napkin-ai
```

## Quick Start

```bash
# Initialize a vault with a template
napkin init --template coding

# See what's in it
napkin overview

# Search for something
napkin search "authentication"

# Read a file
napkin read "Architecture"
```

## Vault Structure

`.napkin/` is the vault root — all content lives inside it:

```
my-project/
  .napkin/                  # The vault
    NAPKIN.md               # Context note (Level 0)
    config.json             # Unified config (syncs to .obsidian/)
    decisions/              # Template-defined directories
    architecture/
    Templates/              # Note templates
    .obsidian/              # Obsidian compatibility (auto-generated)
  src/                      # Your project (not in vault)
```

## Progressive Disclosure

napkin is designed as a memory system for agents. Instead of dumping the full vault into context, it reveals information gradually:

| Level | Command | Tokens | What it does |
|-------|---------|--------|-------------|
| 0 | `NAPKIN.md` | ~200 | Project context note |
| 1 | `napkin overview` | ~1-2k | L0 + vault map with TF-IDF keywords |
| 2 | `napkin search <query>` | ~2-5k | Ranked results with snippets |
| 3 | `napkin read <file>` | ~5-20k | Full file content |

## Benchmarks

napkin includes agentic retrieval benchmarks in `bench/`. The headline result is [LongMemEval](https://arxiv.org/abs/2410.10813) (ICLR 2025), which tests long-term conversational memory across 500 questions.

| Dataset | Sessions | pi + napkin | Best prior system | GPT-4o full context |
|---------|----------|-------------|-------------------|---------------------|
| Oracle | 1-6 | **92.0%** | 92.4% | 92.4% |
| S | ~40 | **91.0%** | 86% | 64% |
| M | ~500 | **83.0%** | 72% | n/a |

Zero preprocessing. No embeddings, no graphs, no summaries. Just BM25 search on markdown files.

See [`bench/README.md`](bench/README.md) for details and usage.

## Templates

Scaffold a vault with a domain-specific structure:

```bash
napkin init --template coding    # decisions/, architecture/, guides/, changelog/
napkin init --template company   # people/, projects/, runbooks/, infrastructure/
napkin init --template product   # features/, roadmap/, research/, specs/, releases/
napkin init --template personal  # people/, projects/, areas/, references/
napkin init --template research  # papers/, concepts/, questions/, experiments/
```

Each template includes directory structure, `_about.md` files, Obsidian note templates, and a `NAPKIN.md` skeleton.

```bash
napkin init --list               # List available templates
```

## Commands

### Global flags

| Flag | Description |
|---|---|
| `--json` | Output as JSON |
| `-q, --quiet` | Suppress output |
| `--vault <path>` | Vault path (default: auto-detect from cwd) |
| `--copy` | Copy output to clipboard |

### Core

```bash
napkin vault                          # Vault info
napkin overview                       # Vault map with keywords
napkin read <file>                    # Read file contents
napkin create "Note" "Hello"          # Create with content
napkin append "Note" "More text"      # Append to file
napkin prepend "Note" "Top line"      # Prepend after frontmatter
napkin move "Note" Archive            # Move to folder
napkin rename "Note" "Renamed"        # Rename file
napkin delete "Note"                  # Move to .trash
napkin search "meeting"               # Ranked search with snippets
napkin search "TODO" --no-snippets    # Files only
echo "piped content" | napkin append "Note"  # Stdin support
```

### Files & folders — `napkin file`

```bash
napkin file info <name>               # File info (path, size, dates)
napkin file list                      # List all files
napkin file list --ext md             # Filter by extension
napkin file list --folder Projects    # Filter by folder
napkin file folder <path>             # Folder info
napkin file folders                   # List all folders
napkin file outline "note"             # Heading tree
napkin file wordcount "note"          # Word + character count
```

### Daily notes — `napkin daily`

```bash
napkin daily today                    # Create today's daily note
napkin daily path                     # Print daily note path
napkin daily read                     # Print daily note contents
napkin daily append "- [ ] Buy groceries"
napkin daily prepend "## Morning"
```

### Tags — `napkin tag`

```bash
napkin tag list                       # List all tags
napkin tag list --counts              # With occurrence counts
napkin tag list --sort count          # Sort by frequency
napkin tag info --name "project"      # Tag info
napkin tag aliases                    # List all aliases
```

### Properties — `napkin property`

```bash
napkin property list                  # List all properties
napkin property list --file "note"    # Properties for a file
napkin property read --file "note" --name title
napkin property set --file "note" --name status --value done
napkin property remove --file "note" --name status
```

### Tasks — `napkin task`

```bash
napkin task list                      # List all tasks
napkin task list --todo               # Incomplete only
napkin task list --done               # Completed only
napkin task list --daily              # Today's daily note tasks
napkin task show --file "note" --line 3 --toggle
```

### Links — `napkin link`

```bash
napkin link out --file "note"         # Outgoing links
napkin link back --file "note"        # Backlinks
napkin link unresolved                # Broken links
napkin link orphans                   # No incoming links
napkin link deadends                  # No outgoing links
```

### Bases — `napkin base`

```bash
napkin base list                      # List .base files
napkin base views --file "projects"   # List views
napkin base query --file "projects"   # Query default view
napkin base query --file "projects" --view "Active" --format csv
napkin base create --file "projects" --name "New Item"
```

### Canvas — `napkin canvas`

```bash
napkin canvas list                    # List .canvas files
napkin canvas read --file "Board"     # Dump canvas
napkin canvas nodes --file "Board"    # List nodes
napkin canvas create --file "Board"   # Create empty canvas
napkin canvas add-node --file "Board" --type text --text "# Hello"
napkin canvas add-edge --file "Board" --from abc1 --to def2
napkin canvas remove-node --file "Board" --id abc1
```

### Templates — `napkin template`

```bash
napkin template list                  # List note templates
napkin template read --name "Daily Note"
napkin template insert --file "note" --name "Template"
```

### Bookmarks — `napkin bookmark`

```bash
napkin bookmark list                  # List bookmarks
napkin bookmark add --file "note"     # Bookmark a file
```

### Config — `napkin config`

```bash
napkin config show                    # Show full config
napkin config get --key search.limit  # Get a value
napkin config set --key search.limit --value 50
```

See [docs/configuration.md](docs/configuration.md) for all config options.

### Graph — `napkin graph`

```bash
napkin graph                          # Interactive vault graph
```

Force-directed graph of vault notes and wikilinks. Click nodes to read content in a sidebar. On macOS, opens in a native window (Glimpse). On other platforms, opens in the browser. Configure with `graph.renderer` in config.

## File Resolution

Files can be referenced two ways:
- **By name** (wikilink-style): `--file "Active Projects"` — searches all `.md` files by basename
- **By path**: `--file "Projects/Active Projects.md"` — exact path from vault root

## Pi Extensions

napkin ships as a pi package with two extensions:

### napkin-context
Injects the vault overview (Level 0 + Level 1) into the agent's system prompt on session start. The agent gets NAPKIN.md and the vault map with keywords for free.

### napkin-distill
Forks the current session and spawns a sub-agent to distill knowledge into the vault. The sub-agent inherits the full conversation, uses napkin tools to read templates and create structured notes. Runs in the background.

```bash
napkin config set --key distill.enabled --value true    # Enable auto-distill
```

Or trigger manually in pi: `/distill`

## Development

```bash
bun install
bun run dev -- vault --json
bun test
bun run check
```

## License

MIT
