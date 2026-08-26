# 001 — Bottom sheets teleport in instead of sliding up

- **Status**: DONE
- **Commit**: 3bb8a0a
- **Severity**: HIGH
- **Category**: Missed opportunity / Cohesion & tokens
- **Estimated scope**: 4 files, ~10 lines total (JS only — no new CSS)

## Problem

The app has one correctly-animated bottom sheet (the carga/weight picker) and
four that use the exact same `.carga-sheet` / `.carga-sheet-overlay` CSS
classes but skip the entrance animation entirely — the panel just appears
already in its final position while only the backdrop fades in.

Working reference — `js/screens/seletorCarga.js:43-44`:

```js
animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
requestAnimationFrame(() => overlay.classList.add("aberta"));
```

and close, `js/screens/seletorCarga.js:144`:

```js
animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
```

Broken — identical pattern in all four, missing the `animarSpring` calls
entirely:

- `js/screens/cardioPrompt.js:33-38`
```js
document.body.appendChild(overlay);
requestAnimationFrame(() => overlay.classList.add("aberta"));

function fechar(resultado) {
  overlay.classList.remove("aberta");
  setTimeout(() => overlay.remove(), 240);
  resolve(resultado);
}
```
- `js/screens/editorCadencia.js:54, 112-113` (same shape)
- `js/screens/novaAtividade.js:66, 93-94` (same shape)
- `js/screens/perguntasDiarias.js:40, 48-49` (same shape)

`css/styles.css:635` confirms the panel itself carries no transition or
transform — `.carga-sheet { ...; will-change: transform; }` — the
`will-change` hint is already there (copy-pasted from the working sheet)
but nothing ever animates the transform it primes for.

Why it matters: four of these five sheets are the app's most-used
interruption pattern (adjusting cadence, logging a manual activity,
daily check-in questions, the "still need cardio?" prompt) and they cut
straight to their final state — a textbook "preventing a jarring change"
miss, and an internal inconsistency since the fifth sheet already proves
the right pattern exists in this codebase.

## Target

Every sheet using `.carga-sheet-overlay` + `.carga-sheet` slides up from
below the viewport and slides back down on close, exactly like
`seletorCarga.js`, reusing the same spring config so all five feel like
one component:

```js
const sheetEl = overlay.querySelector(".carga-sheet"); // grab a ref to the panel itself
document.body.appendChild(overlay);
animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
requestAnimationFrame(() => overlay.classList.add("aberta"));

function fechar(resultado) {
  overlay.classList.remove("aberta");
  animarSpring(sheetEl, { y: 0 }, { y: sheetEl.getBoundingClientRect().height || 320 }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
    overlay.remove();
  });
  resolve(resultado);
}
```

## Repo conventions to follow

- `animarSpring` already exists at `js/lib/spring.js` and is already
  imported the same way in `seletorCarga.js:2`:
  `import { animarSpring } from "../lib/spring.js";` — add this import to
  each of the four files.
- Reuse the exact spring configs already proven in `seletorCarga.js`:
  open `{ rigidez: 340, amortecimento: 30 }`, close
  `{ rigidez: 420, amortecimento: 36 }` — do not invent new values.
- `animarSpring` already clears its own inline `transform` on settle
  (see `js/lib/spring.js:66-73`), so no cleanup needed beyond removing
  the overlay after `finalizado` resolves.
- Exemplar file: `js/screens/seletorCarga.js:1-50` (open) and
  `:140-146` (close) — copy this shape exactly, only the panel's own
  child structure differs per sheet.

## Steps

1. `js/screens/cardioPrompt.js` — after `document.body.appendChild(overlay)` (line 33), grab `const sheetEl = overlay.querySelector(".carga-sheet");` and call `animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });` before the existing `requestAnimationFrame(...)` line. In `fechar()` (lines 36-39), replace the bare `setTimeout(() => overlay.remove(), 240)` with the spring-out + `.finalizado.then(() => overlay.remove())` shown in Target, and drop the `setTimeout`. Add the `animarSpring` import at the top.
2. `js/screens/editorCadencia.js` — same edit at lines 54 (open) and 112-113 (close).
3. `js/screens/novaAtividade.js` — same edit at lines 66 (open) and 93-94 (close).
4. `js/screens/perguntasDiarias.js` — same edit at lines 40 (open) and 48-49 (close).
5. Leave `css/styles.css:632-635` untouched — `will-change: transform` on `.carga-sheet` is already correct and now finally used.

## Boundaries

- Do NOT touch `js/screens/seletorCarga.js` — it's the reference, already correct.
- Do NOT change the 240ms number anywhere it appears for unrelated purposes (e.g. any other `setTimeout(..., 240)` outside these four `fechar()` functions, if present) — only replace the specific "wait then remove" pattern tied to sheet close.
- Do NOT add a new spring config — reuse the two values from `seletorCarga.js` verbatim so all five sheets feel identical.
- Do NOT touch `.carga-sheet-overlay`'s backdrop fade (`transition: background-color 0.28s ease` at `css/styles.css:632`) — it already works and should keep running in parallel with the new slide.

## Verification

- **Mechanical**: `node --check js/screens/cardioPrompt.js js/screens/editorCadencia.js js/screens/novaAtividade.js js/screens/perguntasDiarias.js` — must exit 0. Then `node --test "js/**/*.test.js"` — must stay at the current passing count (this touches no tested logic, only DOM/animation wiring).
- **Feel check**: open each of the four sheets (cardio prompt after finishing the last exercise with cardio pending; the ritmo/cadence editor from an exercise's execution screen; "+" nova atividade from Início; the daily check-in popup) and confirm:
  - The panel visibly slides up from below the screen edge, not just fades or pops in — same felt speed and weight as the carga/weight picker sheet.
  - Closing it slides back down before disappearing, not an instant cut.
  - In DevTools, set the Animations panel playback to 10% and step through — confirm the panel's `translateY` starts at its full height and eases to 0, matching `seletorCarga.js`'s open in the same slow-motion comparison.
- **Done when**: all four sheets visually match the carga/weight picker's open/close motion, and `overlay.remove()` only ever fires after the close spring's `finalizado` promise resolves (no more bare `setTimeout(..., 240)` next to `.remove()` in these four files).
