import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { run } from "../src/cli.js";

const noStdin = () => {
  throw new Error("stdin should not be read");
};

test("clean stdin exits 0", () => {
  const r = run([], () => "plain words, nothing odd here.\n");
  assert.equal(r.code, 0);
  assert.match(r.stdout, /<stdin>: clean/);
});

test("a tell on stdin exits 1 and names the rule", () => {
  const r = run(["-"], () => "let me delve into it");
  assert.equal(r.code, 1);
  assert.match(r.stdout, /\[ai-vocab\] "delve"/);
});

test("--json prints parseable output with the violations", () => {
  const r = run(["--json"], () => "no proof—no close");
  assert.equal(r.code, 1);
  const body = JSON.parse(r.stdout);
  assert.equal(body.file, "<stdin>");
  assert.equal(body.violations[0].rule, "em-dash");
});

test("files are read by path, one result per file", () => {
  const files: Record<string, string> = { "a.md": "fine text", "b.md": "the colour of it" };
  const r = run(["--json", "a.md", "b.md"], noStdin, (p) => files[p]);
  assert.equal(r.code, 1);
  const body = JSON.parse(r.stdout);
  assert.equal(body.length, 2);
  assert.equal(body[0].violations.length, 0);
  assert.equal(body[1].violations[0].rule, "british-spelling");
});

test("an unreadable file exits 2", () => {
  const r = run(["missing.md"], noStdin, () => {
    throw new Error("ENOENT");
  });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /cannot read missing\.md/);
});

test("an unknown option exits 2 with usage", () => {
  const r = run(["--nope"], noStdin);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /Usage:/);
});

test("--help exits 0", () => {
  assert.equal(run(["--help"], noStdin).code, 0);
});

test("end to end: the real CLI process sets the exit code from stdin", () => {
  const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
  const tsx = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
  const dirty = spawnSync(process.execPath, [tsx, cli, "--json"], { input: "I'm humbled to announce", encoding: "utf8" });
  assert.equal(dirty.status, 1, dirty.stderr);
  assert.equal(JSON.parse(dirty.stdout).violations[0].rule, "performative");
  const clean = spawnSync(process.execPath, [tsx, cli], { input: "short and plain.", encoding: "utf8" });
  assert.equal(clean.status, 0, clean.stderr);
});
