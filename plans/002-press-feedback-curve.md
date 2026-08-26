# 002 — Press feedback uses a bouncy overshoot curve on every tap in the app

- **Status**: DONE
- **Commit**: 3bb8a0a
- **Severity**: HIGH
- **Category**: Easing & duration / Frequency-appropriate
- **Estimated scope**: 2 files, ~6 lines changed, 1 new CSS token

## Problem

Every single pressable element in the app — buttons, pills, list rows,
cards, chips — shares one `:active` press-feedback rule, and the bottom
tab bar (the highest-frequency control in the entire app) has its own,
even more exaggerated version of the same thing.

`css/styles.css:68-79`:

```css
button, .swap-pill, .icon-btn, .fila-item, .plano-hero.clicavel,
.exec-carga-pill, .exec-footer-primary, .exec-footer-sq, .exec-serie-chk,
.set-ring, .carga-sheet-acoes button, .habito-chip, .fila-linha {
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out;
  -webkit-tap-highlight-color: transparent;
}
button:active:not(:disabled), .swap-pill:active, .icon-btn:active, .fila-item:active,
.plano-hero.clicavel:active, .exec-carga-pill:active:not(:disabled),
.exec-footer-primary:active, .exec-footer-sq:active, .habito-chip:active,
.fila-linha:active {
  transform: scale(0.96);
  opacity: 0.88;
}
```

`css/styles.css:63-64` — the tab bar, tapped dozens of times a day for
core navigation:

```css
#tab-bar button { transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1); }
#tab-bar button:active { transform: scale(0.86); }
```

Two compounding problems:

1. `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoots past 1 (the `1.56`
   control point) — it's a springy, bouncy curve, not a plain press. That
   reads as playful/exaggerated on a *single* rare button; applied to
   every list row (`.fila-linha`, `.fila-item`) and every tab-bar tap, it
   adds a rubbery wobble to the single most frequent interaction in the
   app — the opposite of what the frequency table calls for
   ("tens of times/day → near-imperceptible only").
2. `#tab-bar button:active { transform: scale(0.86) }` scales down to
   86% — nearly double the recommended press-feedback range of
   `0.95–0.98`. On the app's core navigation, tapped constantly, that's
   a visibly heavy squash every time.

## Target

A plain, subtle `ease-out` press for everything (matches the "Feedback"
purpose, "tens of times/day → fast and subtle" tier), and the tab bar
brought back into the standard range instead of its own exaggerated one:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1); /* strong ease-out for UI — new token in css/tokens.css */
```

```css
button, .swap-pill, .icon-btn, .fila-item, .plano-hero.clicavel,
.exec-carga-pill, .exec-footer-primary, .exec-footer-sq, .exec-serie-chk,
.set-ring, .carga-sheet-acoes button, .habito-chip, .fila-linha {
  transition: transform 0.15s var(--ease-out), opacity 0.15s var(--ease-out);
  -webkit-tap-highlight-color: transparent;
}
button:active:not(:disabled), .swap-pill:active, .icon-btn:active, .fila-item:active,
.plano-hero.clicavel:active, .exec-carga-pill:active:not(:disabled),
.exec-footer-primary:active, .exec-footer-sq:active, .habito-chip:active,
.fila-linha:active {
  transform: scale(0.97);
  opacity: 0.88;
}
```

```css
#tab-bar button { transition: transform 0.15s var(--ease-out); }
#tab-bar button:active { transform: scale(0.97); }
```

## Repo conventions to follow

- `css/tokens.css` currently defines only color/font/radius tokens, no
  easing tokens (confirmed: zero `--ease-*`/`--duration-*` entries exist
  anywhere in the codebase). Add `--ease-out` there, next to the other
  root tokens, so it's the one place any future animation looks for it —
  do not define it locally in `styles.css`.
- Duration stays `0.15s` — that's already within the 100–160ms
  press-feedback budget, only the curve and the two scale values change.
- Exemplar for the token style: `css/tokens.css:1-14` (flat `--name: value;` list under `:root`).

## Steps

1. `css/tokens.css` — add `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` inside the existing `:root { ... }` block.
2. `css/styles.css:71` — replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with `var(--ease-out)` in the shared `transition` line (keep the `opacity 0.15s ease-out` part — already correct).
3. `css/styles.css:78` — change `transform: scale(0.96);` to `transform: scale(0.97);` (this is the only value inside the recommended 0.95–0.98 range that's closest to the current one, minimizing felt change while landing in-spec).
4. `css/styles.css:63` — replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with `var(--ease-out)`.
5. `css/styles.css:64` — change `transform: scale(0.86);` to `transform: scale(0.97);` so the tab bar matches every other pressable element in the app instead of having its own exaggerated rule.

## Boundaries

- Do NOT touch the `opacity 0.15s ease-out` part of the shared rule at line 71 — only the `transform` curve changes.
- Do NOT change the `0.15s` duration anywhere in this plan — it's already correct, only the curve and scale values are the defect.
- Do NOT remove or rename the `cubic-bezier(0.34, 1.56, 0.64, 1)` value if it's used anywhere else for a genuinely rare/delight-tier moment — grep for it after editing to confirm only these two declarations used it (both are in scope here).
- Do NOT touch `#tab-bar button.active { color: var(--accent); }` (line 61) or the focus-visible outline (line 62) — unrelated to press feedback.

## Verification

- **Mechanical**: no build step in this project; open `css/tokens.css` and `css/styles.css` and confirm no CSS syntax errors (e.g. via `npx stylelint css/styles.css css/tokens.css` if available, otherwise a visual diff read-through is sufficient — this is a static CSS file, nothing to typecheck).
- **Feel check**:
  - Tap any list row (Fila do dia) and any tab-bar icon back to back — both should now feel like the same family of press (subtle scale-down, no springy overshoot), where before the tab bar felt noticeably heavier/bouncier.
  - In DevTools, set the Animations panel to 10% playback on a `:active` press — confirm the scale eases straight down and back with no overshoot past the target value (no visible "bounce past 0.97 then settle").
  - Compare a rapid double-tap on a tab-bar icon — the transition should retarget smoothly (it's already a CSS transition, not a keyframe, so this should already hold; confirm no visual glitch).
- **Done when**: `grep -n "cubic-bezier(0.34, 1.56, 0.64, 1)" css/styles.css` returns nothing, `grep -n "scale(0.86)" css/styles.css` returns nothing, and `--ease-out` is defined once in `css/tokens.css` and referenced via `var(--ease-out)` in both places it replaced a hand-typed curve.
