# 004 — Screen-transition springs ignore prefers-reduced-motion

- **Status**: DONE
- **Commit**: 3bb8a0a
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (JS), ~10 lines added

## Problem

`prefers-reduced-motion` is handled correctly in CSS in several places
(`css/styles.css:312-314`, `458-461`, `553-554`, `627-628`) but the app's
single highest-frequency animation — the spring-driven push/pop that
runs on *every* screen change — is pure JS and checks nothing.

`js/lib/spring.js:31-45` (`animarSpring`) unconditionally runs a
`requestAnimationFrame` physics loop and writes `transform`/`opacity`
every frame, with no awareness of the user's motion setting:

```js
export function animarSpring(elemento, de, para, config = {}) {
  const { rigidez, amortecimento, massa } = { ...IOS_PADRAO, ...config };
  const props = Object.keys(para);
  const passos = Object.fromEntries(
    props.map((p) => [p, simularMola(de[p] ?? (p === "opacity" ? 1 : p === "scale" ? 1 : 0), para[p], { rigidez, amortecimento, massa })])
  );
  ...
```

`js/screens/transicaoTela.js:32, 39` calls it on every single
`trocarConteudo()` — every tab switch, every drill into an exercise,
every back navigation — with a `DESLOCAMENTO_PX = 32` horizontal slide:

```js
animarSpring(atual, { x: 0, opacity: 1 }, { x: saidaX, opacity: 0 }, { rigidez: 420, amortecimento: 38 }).finalizado.then(() => {
...
animarSpring(novaTela, { x: entradaX, opacity: 0 }, { x: 0, opacity: 1 });
```

Confirmed via `grep -rn "prefers-reduced-motion\|matchMedia" js/` —
zero matches anywhere in JS. Someone who has reduced motion turned on
(vestibular sensitivity, motion-triggered migraines) gets the full
32px slide-with-momentum on every navigation in the app, all day, with
no way to opt out short of their OS forcing it.

## Target

`animarSpring` checks the media query once and, when reduced motion is
requested, keeps the opacity crossfade (it aids comprehension — this is
still a screen *change* the user should register) but collapses any
`x`/`y`/`scale` motion straight to the target value instead of animating
through it:

```js
const prefereMenosMovimento =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function animarSpring(elemento, de, para, config = {}) {
  if (prefereMenosMovimento) {
    // Menos movimento não é zero movimento: a opacidade ainda cruza
    // (ajuda a perceber a troca de tela), só o deslocamento/escala vai
    // direto pro valor final sem passar pela física da mola.
    const estadoFinal = { ...de, ...para };
    const transformPartes = [];
    if ("x" in para || "y" in para) transformPartes.push(`translate3d(${para.x ?? 0}px, ${para.y ?? 0}px, 0)`);
    if ("scale" in para) transformPartes.push(`scale(${para.scale ?? 1})`);
    if (transformPartes.length) elemento.style.transform = transformPartes.join(" ");
    if ("opacity" in para) {
      elemento.style.transition = "opacity 0.2s ease";
      requestAnimationFrame(() => { elemento.style.opacity = String(para.opacity); });
    }
    return { parar: () => {}, finalizado: Promise.resolve() };
  }
  const { rigidez, amortecimento, massa } = { ...IOS_PADRAO, ...config };
  // ...rest unchanged
```

## Repo conventions to follow

- Match the existing CSS pattern's intent (gentler, not zero — see
  `css/styles.css:312-314` which keeps state-indication color but drops
  motion) rather than inventing a new philosophy for JS.
- `animarSpring`'s return contract (`{ parar, finalizado }`) must stay
  identical so every call site (`transicaoTela.js`, `seletorCarga.js`,
  and — if plan `001-sheet-entrance-animation.md` has landed — the four
  sheet files) keeps working with zero changes on their end.
- Evaluate `matchMedia` once at module load (`prefereMenosMovimento`
  above), not on every `animarSpring()` call — this matches how the
  existing CSS `@media` rules are static, and avoids a live-toggle edge
  case that no other part of this app handles either (out of scope here).

## Steps

1. `js/lib/spring.js` — add the `prefereMenosMovimento` constant near the top of the file (after the existing `IOS_PADRAO`/epsilon constants, before `simularMola`).
2. `js/lib/spring.js` — at the very start of `animarSpring` (before `const { rigidez, amortecimento, massa } = ...` on line 32), add the reduced-motion branch shown in Target that computes the final transform directly and does a short opacity fade, then returns early with the same `{ parar, finalizado }` shape the rest of the function returns.
3. Leave every call site (`transicaoTela.js`, `seletorCarga.js`, any sheet files) untouched — the fix is fully contained in `spring.js`.

## Boundaries

- Do NOT touch `js/screens/transicaoTela.js` or any sheet/screen file that calls `animarSpring` — this is a single-file fix by design, so every current and future caller gets the accessibility fix for free.
- Do NOT remove the opacity crossfade under reduced motion — only the positional/scale animation is what needs to go.
- Do NOT add a `matchMedia` listener for live toggling mid-session — out of scope; evaluate once at load, consistent with how the rest of the app doesn't re-theme live either.
- Do NOT change `IOS_PADRAO`, `simularMola`, or the normal (non-reduced-motion) code path in any way.

## Verification

- **Mechanical**: `node --check js/lib/spring.js` must exit 0. There's no existing test file for `spring.js` in this repo (confirmed: no `spring.test.js`) — no test suite regression possible, but manually verify `js/screens/transicaoTela.js`'s two `animarSpring` calls still receive an object with `.finalizado` (a `.then()` is called on the exit-animation's return value at `transicaoTela.js:32`) so the early-return object's shape must include a real `finalizado` Promise, not `undefined`.
- **Feel check**:
  - With reduced motion OFF: navigate between screens and confirm nothing changed — same spring slide as before.
  - Toggle `prefers-reduced-motion` in DevTools' Rendering panel to "reduce", then navigate between tabs and drill into an exercise: confirm screens still crossfade (opacity) but no longer visibly slide horizontally.
  - Confirm `finalizado` still resolves promptly under reduced motion — `transicaoTela.js`'s exit animation removes the old screen from the DOM inside `.finalizado.then()`, so if this hangs, screens would stack up. Watch that the outgoing screen is actually removed (inspect the DOM after a couple of navigations — only one screen element should remain).
- **Done when**: with reduced motion enabled, `document.querySelectorAll('[style*="translate3d"]')` during a navigation shows the transform already at its resting value on the first observed frame (no intermediate spring positions), and `grep -n "prefers-reduced-motion\|matchMedia" js/lib/spring.js` shows the new check in place.
