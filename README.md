# tells-check

A deterministic checker for the patterns that make writing read as AI-generated. No model calls, no network, no dependencies. The same input gives the same output every time, so you can run it in CI, in a pre-commit hook, or as the last step of a drafting pipeline.

```bash
$ echo "Thrilled to share how we leverage AI — faster, cleaner, and simpler." | npx tells-check
<stdin>: 4 tell(s)
  [em-dash] "—" -> use a comma, colon, or period instead
  [ai-vocab] "leverage" -> use a plain word
  [performative] "Thrilled to share" -> drop the LinkedIn performance
  [rule-of-three] "faster, cleaner, and simpler" -> two beats or one: three is the AI cadence
```

## What it flags

| Rule | Catches |
|---|---|
| `em-dash` | Any em-dash, in any position, including `&mdash;` entities |
| `ai-vocab` | delve, leverage, unlock, nestled, boast, meticulous, robust, seamless, elevate, testament, landscape, realm, underscore, spearhead |
| `performative` | "I'm humbled to announce", "thrilled to share", "excited to announce" |
| `engagement-bait` | "Agree? Thoughts?", "at the end of the day", "drop a comment", "let that sink in", a closing "What do you think?" |
| `rule-of-three` | "X, Y, and Z" padding with short words |
| `british-spelling` | British-only forms (colour, organise, centre, travelled, judgement and hundreds of generated forms). Correct US words such as *premise*, *advertise*, *exercise* and *science* are deliberately never flagged. |
| `trailing-space` | Whitespace at the end of a line |
| `mixed-apostrophes` | Straight and curly quotes in the same text |

## CLI

```bash
tells-check draft.md                 # one or more files
cat draft.md | tells-check           # stdin (or: tells-check -)
tells-check --json draft.md          # machine-readable
```

| Exit code | Meaning |
|---|---|
| `0` | clean |
| `1` | one or more tells found |
| `2` | usage error or unreadable file |

`--json` with stdin prints `{ "file": "<stdin>", "violations": [...] }`. With files it prints an array, one entry per file. Each violation is `{ rule, match, hint }`.

## Library

```ts
import { checkTells, stripEmDashes, normalizeTypography } from "tells-check";

checkTells("let me delve into it");
// [{ rule: "ai-vocab", match: "delve", hint: "use a plain word" }]

stripEmDashes("the fleet — which I rebuilt — logged the wrong thing.");
// "the fleet, which I rebuilt, logged the wrong thing."

normalizeTypography("Summarising the Colour’s behaviour");
// "Summarizing the Color's behavior"
```

`checkTells` only reports. The two fixers handle the defects that have exactly one right answer, so they never cost you a rewrite:

- **`stripEmDashes`** turns a parenthetical pair of em-dashes into commas, a single spaced em-dash into a period (never a comma splice), and an unspaced one into a comma. Line breaks are preserved.
- **`normalizeTypography`** converts British spelling to US (keeping capitalization), straightens curly quotes, strips trailing whitespace, and collapses three or more newlines to one blank line.

A sensible pipeline is: generate the draft, run both fixers, then run `checkTells` and regenerate only the lines that are still flagged.

## Design notes

- **False positives are the real risk.** A checker that fires on correct words teaches people to ignore it. The spelling list is built only from British-only forms, never a bare suffix regex, and the test suite pins words that must *not* be flagged.
- **Detection and fixing are separate.** Vocabulary and cadence need a human or a model to rewrite. Spelling and punctuation do not.

## Development

```bash
npm install
npm test          # node:test via tsx
npm run typecheck
npm run build     # emits dist/
```

## License

MIT. See [LICENSE](LICENSE).

---

Built by [Playground Giants](https://playgroundgiants.com) · [@j1mmyhackett](https://x.com/j1mmyhackett)
