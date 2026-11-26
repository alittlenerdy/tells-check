import { checkTells, stripEmDashes, normalizeTypography } from "../src/index.js";
import { test } from "node:test";
import assert from "node:assert";

test("flags em-dash used as soft parens", () => {
  const r = checkTells("the fix worked — mostly — but not always");
  assert.ok(r.some((v) => v.rule === "em-dash"));
});

test("flags banned AI vocabulary", () => {
  const r = checkTells("let me delve into how we leverage this to unlock value");
  const rules = r.map((v) => v.rule);
  assert.ok(rules.includes("ai-vocab"));
});

test("flags rule-of-three list padding", () => {
  const r = checkTells("it's faster, cleaner, and simpler.");
  assert.ok(r.some((v) => v.rule === "rule-of-three"));
});

test("flags LinkedIn performative openers", () => {
  const r = checkTells("I'm humbled to announce a small win");
  assert.ok(r.some((v) => v.rule === "performative"));
});

test("flags tidy-bow / engagement-bait closers", () => {
  const r = checkTells("at the end of the day, it just works. Agree? Thoughts?");
  assert.ok(r.some((v) => v.rule === "engagement-bait"));
});

test("clean human draft passes with zero violations", () => {
  const r = checkTells(
    "spent 40 minutes today convinced a client's brand-new site was leaking every lead.\n\nit wasn't. i'd misread the form markup. caught it before it reached him.\n\nthe lesson: verify the scary claim before you raise the alarm.",
  );
  assert.deepStrictEqual(r, []);
});

// ── stripEmDashes ───────────────────────────────────────────────────────────

test("single spaced em-dash becomes a period, matching the fragment voice", () => {
  assert.equal(
    stripEmDashes("the merge succeeded — the log said otherwise"),
    "the merge succeeded. the log said otherwise",
  );
});

test("paired em-dashes become commas, not periods", () => {
  assert.equal(
    stripEmDashes("the fleet — which i rebuilt — logged the wrong thing."),
    "the fleet, which i rebuilt, logged the wrong thing.",
  );
});

test("unspaced em-dash becomes a comma", () => {
  assert.equal(stripEmDashes("no proof—no close"), "no proof, no close");
});

test("preserves line breaks (they control where a post truncates)", () => {
  const input = "first line — broken here\n\nsecond para — also broken";
  const out = stripEmDashes(input);
  assert.equal(out, "first line. broken here\n\nsecond para. also broken");
  assert.equal((out.match(/\n/g) ?? []).length, 2);
});

test("normalizes HTML entity forms so card markup is covered", () => {
  assert.equal(stripEmDashes("commit cd368c2 &mdash; no proof"), "commit cd368c2. no proof");
  assert.equal(stripEmDashes("a &#8212; b"), "a. b");
});

test("leaves text without em-dashes untouched", () => {
  const clean = "build-in-public is a compound, not an em-dash.";
  assert.equal(stripEmDashes(clean), clean);
});

test("output always passes checkTells' em-dash rule", () => {
  const nasty = "a — b — c\nd—e\nf &mdash; g";
  const fixed = stripEmDashes(nasty);
  assert.ok(!fixed.includes("—"), `residual em-dash in: ${JSON.stringify(fixed)}`);
  assert.equal(checkTells(fixed).filter((t) => t.rule === "em-dash").length, 0);
});

test("checkTells now flags an em-dash in any position, not just spaced", () => {
  assert.equal(checkTells("no proof—no close").filter((t) => t.rule === "em-dash").length, 1);
});

// ── US spelling + typography ────────────────────────────────────────────────

test("flags British spelling in a real-world sentence", () => {
  const r = checkTells("@AnthropicAI's Claude Code kept summarising them as healthy.");
  assert.ok(r.some((v) => v.rule === "british-spelling"));
});

test("flags the -our, -re and -ise families", () => {
  for (const bad of ["colour", "behaviour", "centre", "organise", "prioritised", "analyse"]) {
    assert.ok(
      checkTells(`the ${bad} of it`).some((v) => v.rule === "british-spelling"),
      `expected "${bad}" to be flagged`,
    );
  }
});

test("does NOT flag words that are correct in US English", () => {
  // The -ise/-ence families overlap with correct US words. A validator that
  // fires on these is worse than none: it trains the operator to ignore it.
  const safe =
    "the premise was to advertise a compromise. exercise the franchise, seize the enterprise. " +
    "science and experience and audience and silence. i promise the merchandise is precise.";
  assert.deepStrictEqual(
    checkTells(safe).filter((v) => v.rule === "british-spelling"),
    [],
  );
});

test("normalizeTypography converts British spelling, preserving case", () => {
  assert.equal(normalizeTypography("Summarising the Colour"), "Summarizing the Color");
  assert.equal(normalizeTypography("kept summarising them"), "kept summarizing them");
});

test("normalizeTypography strips trailing whitespace before a paragraph break", () => {
  const out = normalizeTypography("@SlackHQ kept posting green cards. \n\n@AnthropicAI's Claude Code");
  assert.equal(out, "@SlackHQ kept posting green cards.\n\n@AnthropicAI's Claude Code");
});

test("normalizeTypography straightens curly apostrophes and quotes", () => {
  assert.equal(normalizeTypography("without error.’"), "without error.'");
  assert.equal(normalizeTypography("Anthropic’s Claude Code"), "Anthropic's Claude Code");
  assert.equal(normalizeTypography("“quoted”"), '"quoted"');
});

test("normalizeTypography collapses runs of 3+ newlines but keeps paragraphs", () => {
  assert.equal(normalizeTypography("a\n\n\n\nb"), "a\n\nb");
  assert.equal(normalizeTypography("a\n\nb"), "a\n\nb");
  assert.equal(normalizeTypography("a\nb"), "a\nb");
});

test("normalizeTypography output passes checkTells' british-spelling rule", () => {
  const nasty = "we organised the colour analysis and kept summarising the behaviour";
  const fixed = normalizeTypography(nasty);
  assert.equal(checkTells(fixed).filter((t) => t.rule === "british-spelling").length, 0);
});

test("normalizeTypography leaves clean copy untouched", () => {
  const clean = "the most dangerous bug isn't the one that crashes.\n\nit's the one that says 'all good'.";
  assert.equal(normalizeTypography(clean), clean);
});
