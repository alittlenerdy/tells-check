#!/usr/bin/env node
/**
 * tells-check CLI.
 *
 *   tells-check draft.md            check one or more files
 *   cat draft.md | tells-check      check stdin (also: `tells-check -`)
 *   tells-check --json draft.md     machine-readable output
 *
 * Exit codes: 0 clean, 1 one or more tells found, 2 usage or read error.
 */
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkTells, type TellViolation } from "./index.js";

export const USAGE = `Usage: tells-check [--json] [file ...]

Scans text for the patterns that make writing read as machine-generated:
em-dashes, stock AI vocabulary, performative openers, engagement bait,
rule-of-three padding, British spelling, trailing spaces, mixed apostrophes.

With no file (or "-"), reads stdin.

Options:
  --json       print results as JSON
  -h, --help   show this help
  -v, --version

Exit codes: 0 clean, 1 tells found, 2 usage or read error.`;

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface FileResult {
  file: string;
  violations: TellViolation[];
}

/** Pure entry point, so the CLI is testable without spawning a process. */
export function run(
  argv: string[],
  readStdin: () => string = () => readFileSync(0, "utf8"),
  readFile: (path: string) => string = (p) => readFileSync(p, "utf8"),
  version = "0.0.0",
): RunResult {
  let json = false;
  const files: string[] = [];
  for (const arg of argv) {
    if (arg === "--json") json = true;
    else if (arg === "-h" || arg === "--help") return { code: 0, stdout: USAGE + "\n", stderr: "" };
    else if (arg === "-v" || arg === "--version") return { code: 0, stdout: version + "\n", stderr: "" };
    else if (arg === "--") continue;
    else if (arg.startsWith("-") && arg !== "-")
      return { code: 2, stdout: "", stderr: `tells-check: unknown option ${arg}\n\n${USAGE}\n` };
    else files.push(arg);
  }
  if (files.length === 0) files.push("-");

  const results: FileResult[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = file === "-" ? readStdin() : readFile(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { code: 2, stdout: "", stderr: `tells-check: cannot read ${file}: ${msg}\n` };
    }
    results.push({ file: file === "-" ? "<stdin>" : file, violations: checkTells(text) });
  }

  const total = results.reduce((n, r) => n + r.violations.length, 0);
  const code = total > 0 ? 1 : 0;

  if (json) {
    const body = results.length === 1 && files[0] === "-" ? results[0] : results;
    return { code, stdout: JSON.stringify(body, null, 2) + "\n", stderr: "" };
  }

  const lines: string[] = [];
  for (const r of results) {
    if (r.violations.length === 0) {
      lines.push(`${r.file}: clean`);
      continue;
    }
    lines.push(`${r.file}: ${r.violations.length} tell(s)`);
    for (const v of r.violations) lines.push(`  [${v.rule}] "${v.match}" -> ${v.hint}`);
  }
  return { code, stdout: lines.join("\n") + "\n", stderr: "" };
}

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function isMain(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const result = run(process.argv.slice(2), undefined, undefined, packageVersion());
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.code;
}
