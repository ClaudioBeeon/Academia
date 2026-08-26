# 006 — "Ferramentas" panel (anilhas/aquecimento) pops in with no transition

- **Status**: DONE
- **Commit**: 3bb8a0a
- **Severity**: LOW
- **Category**: Missed opportunity
- **Estimated scope**: 1 file, ~10 lines

## Problem

`js/screens/execucao.js:125-163` — for barbell exercises, tapping
"Ferramentas" reveals a panel with plate-loading math and warm-up ramp
info via a bare `display` toggle:

```js
const painelFerramentas = document.createElement("div");
painelFerramentas.className = "sets";
painelFerramentas.style.display = "none";
painelFerramentas.style.padding = "0 0 12px";
main.appendChild(painelFerramentas);

ferramentasPill.addEventListener("click", () => {
  const abrindo = painelFerramentas.style.display === "none";
  painelFerramentas.style.display = abrindo ? "flex" : "none";
  if (abrindo) {
    ...
    painelFerramentas.innerHTML = `...`;
  }
});
```

No transition anywhere on `.sets` (confirmed: the only `.sets`-related
rule in `css/styles.css` is layout, no `transition`). The panel's text
content (anilhas needed per side, warm-up ladder) appears and disappears
instantly, pushing the rest of the screen down/up with no bridge.

## Target

```css
.sets {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.25s var(--ease-out), opacity 0.2s var(--ease-out);
}
.sets.aberto {
  max-height: 240px;
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .sets { transition: opacity 0.2s ease; }
}
```

```js
const painelFerramentas = document.createElement("div");
painelFerramentas.className = "sets";
painelFerramentas.style.padding = "0 0 12px";
main.appendChild(painelFerramentas);

ferramentasPill.addEventListener("click", () => {
  const abrindo = !painelFerramentas.classList.contains("aberto");
  if (abrindo) {
    // ...existing anilhas/aquecimento calculation and innerHTML assignment, unchanged...
  }
  painelFerramentas.classList.toggle("aberto", abrindo);
});
```

## Repo conventions to follow

- `--ease-out` from plan `002-press-feedback-curve.md` (fallback to
  `cubic-bezier(0.23, 1, 0.32, 1)` if that plan hasn't landed).
- `max-height` + `opacity` (not `height`) is the pragmatic choice here
  because this panel's content is dynamically generated (`innerHTML`
  set only when opening) — a fixed `max-height` cap of `240px` is
  simpler than JS height-measurement for a panel with only two short
  text blocks, and this skill's own guidance tolerates `height`-family
  properties specifically for accordion-shaped reveals where there's no
  transform equivalent.
- Toggling a class (`aberto`) instead of reading `style.display` back
  matches the pattern already used everywhere else in this codebase for
  open/close state (`overlay.classList.add("aberta")` in every sheet,
  `.exec-cronometro[data-estado]`, etc.) rather than inline styles.

## Steps

1. `css/styles.css` — add the `.sets` / `.sets.aberto` / reduced-motion rules from Target near the existing `.sets` class definition (locate via `grep -n "\.sets " css/styles.css`).
2. `js/screens/execucao.js:134` — delete `painelFerramentas.style.display = "none";` (the CSS default of `max-height: 0; opacity: 0;` now owns the closed state).
3. `js/screens/execucao.js:138-140` — replace the `abrindo`/`style.display` lines with the `classList.toggle("aberto", ...)` version shown in Target, keeping the existing `if (abrindo) { ... }` block (lines 141-160, the anilhas/aquecimento calculation and `innerHTML` assignment) exactly as-is inside it.

## Boundaries

- Do NOT touch the anilhas/aquecimento calculation logic (`calcularAnilhas`, `gerarEscadaAquecimento`, the template string) — motion and the open/close mechanism only.
- Do NOT change the `240px` cap without checking real content first — if the aquecimento ladder text can wrap to more lines on a narrow phone and get clipped, raise the cap accordingly during the feel check rather than guessing here.
- Do NOT apply this same `.sets` change anywhere else `.sets` might be used for a *different* purpose — grep for other `.sets` usages first and scope the new rules to this specific "Ferramentas" panel only if `.sets` is shared with something unrelated.

## Verification

- **Mechanical**: `node --check js/screens/execucao.js` must exit 0.
- **Feel check**:
  - On a barbell exercise, tap "Ferramentas" — the panel should grow open with the text easing in, not pop.
  - Tap it again to close — should ease shut, not vanish.
  - Confirm the calculated anilhas/aquecimento text is not clipped by the `240px` cap on the longest realistic content (e.g. an exercise with a multi-step warm-up ladder) — increase the cap if it is.
  - Toggle `prefers-reduced-motion` and confirm the panel still opens/closes (visibility toggles) without the grow animation.
- **Done when**: `painelFerramentas.style.display` no longer appears anywhere in `execucao.js`, and the panel is driven entirely by the `aberto` class.
