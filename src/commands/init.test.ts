import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { init } from "./init.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "napkin-init-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("init command", () => {
  test("creates .napkin/ and .obsidian/ directories", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    await init({ json: true, path: tmpDir });
    console.log = orig;

    const data = JSON.parse(logs.join(""));
    expect(data.status).toBe("created");
    expect(data.napkin).toBe(true);
    expect(data.obsidian).toBe(true);

    expect(fs.existsSync(path.join(tmpDir, ".napkin"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".obsidian"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".obsidian", "app.json"))).toBe(
      true,
    );
  });

  test("reports exists when already initialized", async () => {
    // First init
    await init({ quiet: true, path: tmpDir });

    // Second init
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    await init({ json: true, path: tmpDir });
    console.log = orig;

    const data = JSON.parse(logs.join(""));
    expect(data.status).toBe("exists");
  });

  test("creates missing .napkin/ when only .obsidian/ exists", async () => {
    // Create only .obsidian/
    fs.mkdirSync(path.join(tmpDir, ".obsidian"));

    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    await init({ json: true, path: tmpDir });
    console.log = orig;

    const data = JSON.parse(logs.join(""));
    expect(data.status).toBe("created");
    expect(data.napkin).toBe(true);
    expect(data.obsidian).toBe(false);
  });

  test("creates missing .obsidian/ when only .napkin/ exists", async () => {
    // Create only .napkin/
    fs.mkdirSync(path.join(tmpDir, ".napkin"));

    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    await init({ json: true, path: tmpDir });
    console.log = orig;

    const data = JSON.parse(logs.join(""));
    expect(data.status).toBe("created");
    expect(data.napkin).toBe(false);
    expect(data.obsidian).toBe(true);
  });

  test("scaffolds template with dirs, files, and NAPKIN.md", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    await init({ json: true, path: tmpDir, template: "coding" });
    console.log = orig;

    const data = JSON.parse(logs.join(""));
    expect(data.status).toBe("created");
    expect(data.template).toBe("coding");
    expect(data.files).toContain("NAPKIN.md");
    expect(data.files).toContain("decisions/");
    expect(data.files).toContain("guides/");

    expect(fs.existsSync(path.join(tmpDir, "NAPKIN.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "decisions"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "guides/_about.md"))).toBe(true);
    // Templates dir with note templates
    expect(fs.existsSync(path.join(tmpDir, "Templates/Decision.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(tmpDir, "Templates/Guide.md"))).toBe(true);
  });

  test("template on existing vault adds template files", async () => {
    await init({ quiet: true, path: tmpDir });
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    await init({ json: true, path: tmpDir, template: "company" });
    console.log = orig;

    const data = JSON.parse(logs.join(""));
    expect(data.status).toBe("created");
    expect(data.template).toBe("company");
    expect(fs.existsSync(path.join(tmpDir, "runbooks"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "NAPKIN.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "Templates/Runbook.md"))).toBe(
      true,
    );
  });
});
