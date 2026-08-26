# 003 — Personal-record toast has zero animation

- **Status**: DONE
- **Commit**: 3bb8a0a
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Interruptibility
- **Estimated scope**: 1 file (JS), 1 file (CSS) — ~15 lines added

## Problem

`js/screens/execucao.js:738-752` — the personal-record toast is created,
appended, and removed with no transition at all:

```js
function mostrarToastPR(prs) {
  const toast = document.createElement("div");
  toast.className = "rest-bar toast-flutuante";
  toast.setAttribute("role", "status");
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = `${proximoOffsetToast()}px`;
  toast.style.transform = "translateX(-50%)";
  toast.style.width = "calc(100% - 44px)";
  toast.style.maxWidth = "398px";
  toast.style.zIndex = "10";
  toast.innerHTML = `<div><div class="label">🏆 Recorde pessoal</div><div class="time" style="font-size:1rem;">${prs.map((p) => p.mensagem).join(" ")}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
```

No CSS class matching `.toast-flutuante` exists anywhere in
`css/styles.css` (confirmed: zero matches) — it inherits `.rest-bar`'s
static card styling and nothing else. It appears already fully formed
and disappears with an instant DOM removal.

Why it matters: a PR is exactly the "rare / first-time, high-emotion"
tier the frequency table reserves the delight budget for — right now
it gets *less* motion than routine occasional UI like a dropdown, when
it should get more.

## Target

```js
function mostrarToastPR(prs) {
  const toast = document.createElement("div");
  toast.className = "rest-bar toast-flutuante";
  toast.setAttribute("role", "status");
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = `${proximoOffsetToast()}px`;
  toast.style.width = "calc(100% - 44px)";
  toast.style.maxWidth = "398px";
  toast.style.zIndex = "10";
  toast.innerHTML = `<div><div class="label">🏆 Recorde pessoal</div><div class="time" style="font-size:1rem;">${prs.map((p) => p.mensagem).join(" ")}</div></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("mostrado"));
  setTimeout(() => {
    toast.classList.remove("mostrado");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
```

```css
.toast-flutuante {
  opacity: 0;
  transform: translateX(-50%) translateY(16px) scale(0.96);
  transition: opacity 0.4s var(--ease-out), transform 0.4s var(--ease-out);
}
.toast-flutuante.mostrado {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}
@media (prefers-reduced-motion: reduce) {
  .toast-flutuante { transition: opacity 0.2s ease; transform: translateX(-50%); }
}
```

## Repo conventions to follow

- `--ease-out` is the token introduced in plan `002-press-feedback-curve.md`
  (`css/tokens.css`) — if that plan hasn't run yet, use
  `cubic-bezier(0.23, 1, 0.32, 1)` directly here instead of the var, and
  swap to `var(--ease-out)` once 002 lands.
- Duration: this is a "preventing a jarring change" + "delight" combo on
  a rare event, not routine UI — 400ms is consistent with the modal/drawer
  budget (200–500ms) and matches this app's existing toast-adjacent
  timing (the rest-cronometro carousel transition also uses ~340ms class
  of duration, see `css/styles.css:446`).
- `translateY` + `scale` entrance, never `scale(0)` — follows the same
  shape already used for this app's sheets (`carga-sheet`) and modals.
- Exemplar for the `.mostrado`-class-toggle-with-`requestAnimationFrame`
  pattern: every sheet in this codebase already does
  `requestAnimationFrame(() => overlay.classList.add("aberta"))` — reuse
  that exact idiom (`mostrado` instead of `aberta`) for consistency.

## Steps

1. `css/styles.css` — add the `.toast-flutuante` / `.toast-flutuante.mostrado` / reduced-motion rules from Target, placed near the existing `.rest-bar` block (around line 186-189) since `.toast-flutuante` is always paired with `.rest-bar` in the `className`.
2. `js/screens/execucao.js:738-752` — replace the function body with the Target version: drop the inline `toast.style.transform = "translateX(-50%)"` (now owned by CSS so the class toggle can override it), add the `requestAnimationFrame(() => toast.classList.add("mostrado"))` line after `appendChild`, and change the single `setTimeout(() => toast.remove(), 4000)` into the two-step "remove class, wait for the transition, then remove the element" shown in Target.

## Boundaries

- Do NOT change `proximoOffsetToast()` or the stacking-offset math (`108 + existentes * 64`) — unrelated to this fix.
- Do NOT change the 4000ms display duration — only how it enters/exits changes.
- Do NOT touch `.rest-bar` itself (the real rest-timer card use of that class, not the toast) — only add new rules scoped to `.toast-flutuante`.
- Do NOT add a library — this is a two-class CSS transition, no motion library needed.

## Verification

- **Mechanical**: `node --check js/screens/execucao.js` must exit 0. `node --test "js/**/*.test.js"` must stay at the current passing count (no tested logic touched — this function has no existing test).
- **Feel check**: trigger a PR in the app (any set that beats a previous best) and confirm:
  - The toast rises and fades in over ~400ms instead of appearing instantly.
  - After 4s it fades/drops back out before being removed from the DOM — no instant pop-out.
  - If two PRs stack (two toasts visible), each one's entrance still animates independently and the stacking offset (`proximoOffsetToast`) still positions them correctly mid-animation.
  - Toggle `prefers-reduced-motion` (Rendering panel) and confirm the toast still fades in/out (opacity) but no longer slides or scales.
- **Done when**: `.toast-flutuante` has a defined entrance/exit transition in `css/styles.css`, and `mostrarToastPR` no longer calls `toast.remove()` synchronously inside the first `setTimeout`.
