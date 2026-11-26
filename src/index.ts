/**
 * tells-check: a deterministic validator for the patterns that make writing
 * read as machine-generated.
 *
 * `checkTells()` reports violations. `stripEmDashes()` and
 * `normalizeTypography()` fix the subset that has exactly one right answer
 * (em-dashes, British spelling, curly quotes, trailing whitespace), so those
 * never need a rewrite.
 *
 * No dependencies, no network, no model calls. Same input, same output.
 */

export interface TellViolation {
  rule: string;
  match: string;
  hint: string;
}

/**
 * Remove every em-dash, deterministically, preserving readable punctuation.
 *
 * This is a SAFETY NET, not the primary mechanism. Producers should make an
 * em-dash a hard validation error so the model regenerates real prose; this
 * runs last so a stray dash can never reach a draft. Replacement logic:
 *
 *   - A sentence with TWO OR MORE spaced em-dashes is using them as a
 *     parenthetical pair ("the fleet — which I rebuilt — logged wrong"), so
 *     both become commas. Periods there would shred the sentence.
 *   - A sentence with ONE spaced em-dash is a rhetorical break, so it becomes a
 *     period. That suits a short, fragment-heavy register and, unlike a
 *     comma, can never produce a comma splice.
 *   - An unspaced em-dash between words ("no proof—no close") becomes ", ".
 *   - HTML entities (&mdash;, &#8212;, &#x2014;) are normalized first so card
 *     markup is covered too.
 */
export function stripEmDashes(text: string): string {
  // Normalize entity forms so the rules below see a real character.
  let out = text.replace(/&mdash;|&#8212;|&#x2014;/gi, "—");
  if (!out.includes("—")) return out;

  // Process line by line. Social formats depend on their line breaks (they
  // control where a post truncates at "Show more"), so newlines survive intact.
  out = out
    .split("\n")
    .map((line) => {
      if (!line.includes("—")) return line;
      // Within a line, decide per sentence: paired dashes are parenthetical.
      return line
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => {
          const spaced = sentence.match(/\s—\s/g) ?? [];
          const replacement = spaced.length >= 2 ? ", " : ". ";
          return sentence.replace(/\s+—\s+/g, replacement);
        })
        .join(" ")
        // Anything left is unspaced (word—word) or line-trailing.
        .replace(/\s*—\s*/g, ", ");
    })
    .join("\n");

  // Tidy artifacts: doubled punctuation, space before punctuation, and a
  // replacement that landed at the very end of a line.
  return out
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*\./g, ".")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]+([.,!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/[,.]\s*$/gm, (m) => (m.trim() === "," ? "." : m.trim()));
}

/**
 * ── US SPELLING + TYPOGRAPHY ───────────────────────────────────────────────
 *
 * Mixed spelling inside one piece ("summarising" in one variant of a post,
 * "summarizing" in another) is a tell. This module normalizes to US English.
 *
 * EVERY ENTRY BELOW IS A BRITISH-ONLY WORD. The -ise and -ence families
 * overlap heavily with correct US words (premise, advertise, compromise,
 * exercise, franchise, enterprise, science, audience, silence), so nothing here
 * is derived from a bare suffix regex. The stems below generate ONLY suffixed
 * forms, never the bare stem, which is why "emphasis" the noun survives while
 * "emphasise" the verb does not.
 *
 * A spelling checker that fires on correct words is worse than no checker: it
 * teaches the reader to ignore it, and then it catches nothing at all.
 */
const ISE_STEMS = [
  "summaris", "organis", "recognis", "realis", "optimis", "prioritis", "apologis",
  "categoris", "criticis", "minimis", "maximis", "normalis", "standardis",
  "specialis", "utilis", "visualis", "authoris", "customis", "familiaris",
  "personalis", "monetis", "modernis", "publicis", "emphasis", "analys",
  "centralis", "generalis", "legitimis", "stabilis", "sterilis", "symbolis",
];
const OUR_BASES = [
  "colour", "behaviour", "favour", "honour", "labour", "neighbour", "rumour",
  "humour", "endeavour", "flavour", "harbour", "armour", "odour", "valour",
  "splendour", "vapour", "savour", "candour", "clamour", "demeanour",
];
const RE_BASES = [
  "centre", "metre", "litre", "theatre", "fibre", "calibre", "lustre",
  "spectre", "sombre", "meagre", "sceptre",
];
/** Irregulars and one-offs that no generator covers. */
const EXTRA_BRITISH: Record<string, string> = {
  defence: "defense", offence: "offense", pretence: "pretense",
  licence: "license", licenced: "licensed",
  grey: "gray", greyed: "grayed", whilst: "while", amongst: "among",
  programme: "program", programmes: "programs",
  travelled: "traveled", travelling: "traveling", traveller: "traveler",
  cancelled: "canceled", cancelling: "canceling",
  modelling: "modeling", modelled: "modeled",
  labelled: "labeled", labelling: "labeling",
  signalling: "signaling", signalled: "signaled",
  totalled: "totaled", fuelled: "fueled", marvellous: "marvelous",
  catalogue: "catalog", catalogues: "catalogs",
  sceptic: "skeptic", sceptical: "skeptical", scepticism: "skepticism",
  enrolment: "enrollment", fulfil: "fulfill", fulfilment: "fulfillment",
  instalment: "installment", skilful: "skillful", judgement: "judgment",
  storey: "story", storeys: "stories", cheque: "check", kerb: "curb",
  tyre: "tire", plough: "plow", mould: "mold", moulded: "molded",
  aluminium: "aluminum", jewellery: "jewelry", manoeuvre: "maneuver",
  draught: "draft", smoulder: "smolder",
};

/** Every British-only form → its US spelling. Built once at module load. */
const BRITISH_US: Record<string, string> = (() => {
  const m: Record<string, string> = { ...EXTRA_BRITISH };
  // "practise" is the British VERB; the US spelling is "practice" for both.
  m.practise = "practice";
  m.practised = "practiced";
  m.practising = "practicing";
  for (const stem of ISE_STEMS) {
    const us = stem.replace(/s$/, "z");
    // Suffixed forms ONLY. The bare stem is never added, so "emphasis" and
    // "analys" cannot match while "emphasise"/"analyse" can.
    for (const suf of ["e", "es", "ed", "ing", "ation", "ations"]) {
      m[stem + suf] = us + suf;
    }
  }
  for (const base of OUR_BASES) {
    const us = base.replace(/our$/, "or");
    for (const suf of ["", "s", "ed", "ing", "ful", "fully", "less", "able", "ably", "ite", "ites", "al", "ally", "ist", "ists"]) {
      m[base + suf] = us + suf;
    }
  }
  for (const base of RE_BASES) {
    const us = base.replace(/re$/, "er");
    m[base] = us;
    m[base + "s"] = us + "s";
    m[base + "d"] = us + "ed";
    m[base.slice(0, -1) + "ing"] = us.slice(0, -2) + "ering";
  }
  return m;
})();

const BRITISH_RE = new RegExp(
  `\\b(${Object.keys(BRITISH_US).sort((a, b) => b.length - a.length).join("|")})\\b`,
  "gi",
);

/** Apply the source word's capitalization to the replacement. */
function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/**
 * Deterministically normalize spelling and typography.
 *
 * A SAFETY NET, exactly like stripEmDashes: these are defects that should never
 * burn a regeneration attempt, because there is one correct answer and no
 * judgment involved. If a model writes the draft, still ASK for US spelling in
 * the prompt so its own output is right; this guarantees the artifact is.
 *
 * It deliberately does NOT touch paragraph structure beyond collapsing runs of
 * 3+ newlines. Whether a given break belongs there is an authorial call that a
 * normalizer cannot make; only trailing spaces are removed.
 */
export function normalizeTypography(text: string): string {
  return text
    // Curly → straight. Mixed forms in one post are the tell.
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(BRITISH_RE, (m) => matchCase(m, BRITISH_US[m.toLowerCase()]))
    // Trailing whitespace on any line, including before a paragraph break.
    .replace(/[ \t]+$/gm, "")
    // Runs of blank lines collapse to one. Paragraphs (\n\n) survive intact.
    .replace(/\n{3,}/g, "\n\n");
}

const AI_VOCAB =
  /\b(delve|leverage|unlock|nestled|boast|meticulous|robust|seamless|elevate|testament|landscape|realm|underscore|spearhead)\b/gi;
const PERFORMATIVE =
  /\b(I'?m humbled to announce|thrilled to share|excited to announce|I failed \d+ times)\b/gi;
const ENGAGEMENT_BAIT =
  /(agree\?\s*thoughts\?|what do you think\?\s*$|at the end of the day|drop a comment|let that sink in)/gi;

export function checkTells(draft: string): TellViolation[] {
  const v: TellViolation[] = [];
  const push = (rule: string, m: string, hint: string) =>
    v.push({ rule, match: m.trim(), hint });

  const all = (re: RegExp) => Array.from(draft.matchAll(re));

  // ANY em-dash, in any position, not just the soft-paren usage. Use
  // stripEmDashes() to fix rather than merely flagging. Hyphens in compounds
  // ("build-in-public") are a different character and never match.
  for (const m of all(/—/g))
    push("em-dash", m[0], "use a comma, colon, or period instead");
  for (const m of all(AI_VOCAB))
    push("ai-vocab", m[0], "use a plain word");
  for (const m of all(PERFORMATIVE))
    push("performative", m[0], "drop the LinkedIn performance");
  for (const m of all(ENGAGEMENT_BAIT))
    push("engagement-bait", m[0], "end on a real open question, not bait");

  // US spelling. Use normalizeTypography() to fix rather than regenerating:
  // there is one correct answer and no judgment involved.
  for (const m of all(BRITISH_RE))
    push("british-spelling", m[0], `use US spelling: "${BRITISH_US[m[0].toLowerCase()]}"`);

  // Typography defects. Same fix path.
  for (const m of all(/[ \t]+$/gm))
    push("trailing-space", "(trailing whitespace)", "strip it; it survives into the published post");
  if (/['‘’]/.test(draft) && /[‘’]/.test(draft) && /'/.test(draft))
    push("mixed-apostrophes", "' vs ’", "straighten every quote; mixed forms are the tell");

  // rule-of-three: "X, Y, and Z" short-token padding (the AI cadence). Scoped
  // to short alphabetic tokens so real lists of substantive items don't trip.
  for (const m of all(/\b([a-z]{3,12}),\s+([a-z]{3,12}),\s+and\s+([a-z]{3,12})\b/gi))
    push("rule-of-three", m[0], "two beats or one: three is the AI cadence");

  return v;
}
