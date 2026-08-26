# 005 — Accordions snap open/closed instead of animating

- **Status**: DONE
- **Commit**: 3bb8a0a
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Interruptibility
- **Estimated scope**: 4 usages across 2 CSS blocks + 1 small shared JS helper, ~30 lines

## Problem

Four collapsible sections in the app are native `<details>`/`<summary>`
elements with no `[open]` transition anywhere — the browser's default
behavior, which is an instant show/hide with zero animation:

- `css/styles.css:713-732` — `.fila-aquecimento` (the warm-up card in
  the day's queue), body at `.fila-aquecimento-corpo` (line 732).
- `css/styles.css:740-753` — `.fila-aquec-item` (each warm-up movement,
  built at `js/screens/fila.js:68-69`), content at `> p` (line 751).
- `js/screens/execucao.js:332-333` — `.explicacao-execucao` ("Guia do
  exercício" / "Como executar" details block).
- `css/styles.css:233` — `.bloco-apoio-lista summary` (the same pattern
  reused for another support-info block).

None of these have a `max-height`, `height`, or `grid-template-rows`
transition — confirmed via `grep -n "details\|summary" css/styles.css`
returning only static styling (padding, color, cursor), no transition
property on any of them, and `grep -n "@keyframes" css/styles.css`
returning zero matches app-wide.

Why it matters: this is the "accordions/collapses that snap open" seam
called out explicitly in this skill's own hunt list — content teleports
into existence with no bridge, on an interaction (tapping to see how to
do a warm-up movement, or reading an exercise's guide) that happens
occasionally per session, squarely in the "standard animation" tier.

## Target

A shared, reusable open/close transition for any `<details>` in this
app, driven by measuring the real content height in JS (native `height:
auto` can't be transitioned) — following this skill's own accordion
recipe:

```css
.fila-aquecimento-corpo, .fila-aquec-item > p, .explicacao-execucao > *:not(summary) {
  overflow: hidden;
  transition: height 0.2s var(--ease-out), opacity 0.2s var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .fila-aquecimento-corpo, .fila-aquec-item > p, .explicacao-execucao > *:not(summary) { transition: none; }
}
```

```js
// js/lib/detailsAnimado.js — new shared helper
export function animarDetails(detailsEl, conteudoEl) {
  detailsEl.addEventListener("click", (evento) => {
    const alvo = evento.target.closest("summary");
    if (!alvo) return;
    evento.preventDefault();
    const abrindo = !detailsEl.open;
    if (abrindo) detailsEl.open = true;
    const alturaAlvo = abrindo ? conteudoEl.scrollHeight : 0;
    conteudoEl.style.height = abrindo ? "0px" : `${conteudoEl.scrollHeight}px`;
    requestAnimationFrame(() => {
      conteudoEl.style.height = `${alturaAlvo}px`;
      conteudoEl.style.opacity = abrindo ? "1" : "0";
    });
    conteudoEl.addEventListener("transitionend", function aoTerminar() {
      conteudoEl.removeEventListener("transitionend", aoTerminar);
      if (!abrindo) { detailsEl.open = false; conteudoEl.style.height = ""; }
      else conteudoEl.style.height = "";
    }, { once: true });
  });
}
```

## Repo conventions to follow

- `--ease-out` from plan `002-press-feedback-curve.md` — if that plan
  hasn't landed yet, use `cubic-bezier(0.23, 1, 0.32, 1)` directly.
- 200ms duration matches this app's existing "standard occasional UI"
  budget already used for the rest-cronometro and progress-bar
  transitions (`css/styles.css:290, 431`).
- New shared helper lives in `js/lib/` next to the other framework-free
  utility, `js/lib/spring.js` — this codebase has no motion library and
  isn't introducing one here either (per this skill's own "cheapest tool
  that works" rule; a JS height-measurement helper is the correct tool
  for `<details>`, per this skill's Accordion recipe).
- Height + opacity is the one sanctioned exception to "transform/opacity
  only" for this exact case — the recipe doc explicitly tolerates
  `height` for accordions since there's no transform equivalent.

## Steps

1. Create `js/lib/detailsAnimado.js` with the `animarDetails` export shown in Target.
2. `css/styles.css` — add the transition rules from Target scoped to `.fila-aquecimento-corpo`, `.fila-aquec-item > p`, and `.explicacao-execucao > *:not(summary)`, plus their `prefers-reduced-motion` override, placed next to each element's existing block (lines 732, 751, and near `execucao.js`'s explicacao styling respectively).
3. `js/screens/fila.js` — after constructing the `.fila-aquecimento` details element (around line 34-60) and its body (`corpo`, line 60), call `animarDetails(card, corpo);`. Do the same for each `.fila-aquec-item` (around line 68-69) with its `<p>` content element.
4. `js/screens/execucao.js` — after building the `explicacao` details element (around line 332-349), wrap its non-summary children in a single container element (a `<div>` holding the `h5`/`p` pairs) if one doesn't already exist, and call `animarDetails(explicacao, thatContainer);`.
5. `css/styles.css:233` (`.bloco-apoio-lista summary`) — check what sibling content element holds the list body; apply the same transition rule to it and wire `animarDetails` at its construction site (locate via `grep -rn "bloco-apoio-lista" js/`).

## Boundaries

- Do NOT replace `<details>`/`<summary>` with custom divs — keeps native keyboard/screen-reader semantics; only the height transition is added on top.
- Do NOT animate the warm-up items' "marcar feito" checkbox interaction — the existing code already has a comment (`js/screens/fila.js:92`) noting the box must NOT open/close when marking a movement done; this plan must not regress that (verify the click handler for the checkbox still calls `evento.stopPropagation()` or equivalent so it never reaches `animarDetails`'s summary-click listener).
- Do NOT add a general-purpose accordion library — the helper here is intentionally minimal and specific to this app's four usages.
- Do NOT change what content appears in any of the four accordions — motion only.

## Verification

- **Mechanical**: `node --check js/lib/detailsAnimado.js js/screens/fila.js js/screens/execucao.js` must exit 0. `node --test "js/**/*.test.js"` must stay at the current passing count — check specifically that `js/screens/fila.test.js` (if it exists) still passes, since `fila.js` is edited.
- **Feel check**:
  - Tap the warm-up card summary in the day's queue — the body should grow open smoothly instead of snapping, and collapse the same way in reverse.
  - Tap an individual warm-up movement — same smooth open/close, and confirm tapping its "done" checkmark still does NOT toggle the accordion (per the existing `fila.js:92` comment/behavior).
  - Open "Guia do exercício" on the execution screen — content should ease in, not pop.
  - Toggle `prefers-reduced-motion` and confirm all four still open/close (content still becomes visible/hidden) but with no animated height change.
- **Done when**: all four `<details>` elements visibly animate open/close, the warm-up "done" checkbox interaction is unaffected (confirmed by manual test, not just code read), and `conteudoEl.style.height` is always cleared back to `""` after the transition ends (no leftover inline height locking future content changes, e.g. if the exercise's explanation text is later edited while the details are open).
