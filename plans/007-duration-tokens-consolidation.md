# 007 — No shared duration/easing tokens; near-identical values hand-typed everywhere

- **Status**: DONE
- **Commit**: 3bb8a0a
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (CSS tokens) + ~10 call sites in `css/styles.css`

## Problem

`css/tokens.css` defines color, font, and radius tokens but zero motion
tokens (confirmed: no `--ease-*` or `--duration-*` entries anywhere
before this plan — plans `002` and later introduce the first one,
`--ease-out`). Every duration in `css/styles.css` is a hand-typed literal,
and several are near-duplicates doing the same conceptual job:

- State-indication fades: `0.2s` (`carrossel-dots`, line 150), `0.25s`
  (`exec-lt-barra i`, line 323; the cronometro background/color swap,
  line 431), `0.3s` (`meta-barra-preenchida`, line 290; `fila-barra
  .trilho i`, line 709; `sc-anel-progresso`, line 533).
- Backdrop fades: `0.28s` (`carga-sheet-overlay`, line 632).
- Ring/progress sweeps: `0.3s linear` (`sc-anel-progresso`, line 533)
  vs. `0.4s linear` (`cardio-anel .progresso`, line 579) — two
  countdown rings in the same app, same visual language, different
  speeds for no stated reason.

None of this is broken — each individual value is within a reasonable
range — but five to six near-identical numbers scattered across the
file is exactly the "five hand-typed cubic-beziers that almost match"
consolidation finding this skill's own audit checklist calls out, and it
makes future changes (e.g. "make all state-indication fades feel
snappier") a many-file find-and-replace instead of a one-line token
edit.

## Target

```css
/* css/tokens.css — additions, alongside --ease-out from plan 002 */
--duration-fast: 0.2s;    /* small state-indication changes: dots, thin bars */
--duration-standard: 0.3s; /* occasional UI: sheets, rings, backdrops */
```

Then each site references the token instead of its literal, snapping
the near-duplicates onto one of the two values rather than inventing a
third:

```css
.carrossel-dots i { transition: width var(--duration-fast) ease, background var(--duration-fast) ease; }
.meta-barra-preenchida { transition: width var(--duration-standard) ease; }
.exec-lt-barra i { transition: background var(--duration-fast) ease; }
.fila-barra .trilho i { transition: background var(--duration-standard) ease; }
.carga-sheet-overlay { transition: background-color var(--duration-standard) ease; }
.sc-anel-progresso { transition: stroke-dashoffset var(--duration-standard) linear; }
.cardio-anel .progresso { transition: stroke-dashoffset var(--duration-standard) linear; }
```

## Repo conventions to follow

- This plan intentionally does NOT touch the two spring-driven
  animations (`js/lib/spring.js` rigidez/amortecimento configs) or the
  `--ease-out`/`--ease-drawer`-style curve tokens beyond what `002`
  already introduces — springs aren't duration-based, and inventing more
  curve tokens without a second real use case would be exactly the
  "adding a parallel system" defect this skill warns against.
- Two duration tiers only (`--duration-fast`, `--duration-standard`) —
  do not add a third unless a genuine third category is found; matching
  the existing two clusters of values is enough here.
- This plan should run after `002-press-feedback-curve.md` (which adds
  `--ease-out` to the same file) to avoid a merge conflict in
  `css/tokens.css` — see `plans/README.md` for order.

## Steps

1. `css/tokens.css` — add `--duration-fast: 0.2s;` and `--duration-standard: 0.3s;` to the `:root` block.
2. `css/styles.css:150` — `carrossel-dots i` transition durations `0.2s` → `var(--duration-fast)` (both instances in the line).
3. `css/styles.css:290` — `meta-barra-preenchida` `0.3s` → `var(--duration-standard)`.
4. `css/styles.css:323` — `exec-lt-barra i` `0.25s` → `var(--duration-fast)`.
5. `css/styles.css:632` — `carga-sheet-overlay` `0.28s` → `var(--duration-standard)`.
6. `css/styles.css:709` — `fila-barra .trilho i` `0.3s` → `var(--duration-standard)`.
7. `css/styles.css:533` — `sc-anel-progresso` `0.3s` → `var(--duration-standard)` (keep `linear`, only the number changes).
8. `css/styles.css:579` — `cardio-anel .progresso` `0.4s` → `var(--duration-standard)` (this is the one real behavior change in this plan: the cardio countdown ring speeds up from 400ms to 300ms per tick to match the cadence-guide ring it visually echoes — call this out explicitly in the PR/commit message).
9. Leave `css/styles.css:431` (`exec-cronometro` background/color swap, `0.25s`) and `:446` (`0.32s cubic-bezier(0.32, 0, 0.2, 1)`, the carousel transform) as literals — they're a matched pair tuned together for one specific carousel effect, not part of the generic state-indication cluster; forcing them onto a shared token would be exactly the "re-litigating a settled decision" this skill warns against without a real duplicate to justify it.

## Boundaries

- Do NOT change any curve/easing value in this plan — durations only.
- Do NOT touch `js/lib/spring.js` rigidez/amortecimento numbers — those aren't durations and are out of scope.
- Do NOT introduce a third duration tier "just in case" — if a value doesn't cleanly map to fast (0.2s) or standard (0.3s), leave it as a literal and note it for a future finding rather than forcing a bad fit.
- Do NOT touch `.exec-cronometro` (line 431/446) or the toast/reduced-motion additions from plans `003`/`004`/`005`/`006` — if those plans have already landed, their new rules may already reference `--ease-out`/introduce their own values; this plan only touches the pre-existing literals listed in Steps.

## Verification

- **Mechanical**: open `css/tokens.css` and `css/styles.css` after editing and confirm no syntax errors (unmatched braces, missing semicolons) via a read-through or `npx stylelint` if available.
- **Feel check**:
  - Compare the cadence-guide rest ring (`sc-anel-progresso`, in the full-screen série timer) against the cardio countdown ring (`cardio-anel`, in the cardio timer) side by side — they should now feel like the same speed of sweep.
  - Spot-check two or three of the changed elements (carousel dots, fila trilho, sheet backdrop) to confirm nothing visibly sped up or slowed down enough to feel different from before — this plan should be imperceptible except for the one called-out cardio-ring change.
- **Done when**: `grep -n "0\.2s\|0\.25s\|0\.28s\|0\.3s\|0\.4s" css/styles.css` shows only the two intentionally-excluded lines (431, 446) still using literals — every other match now reads `var(--duration-fast)` or `var(--duration-standard)`.
