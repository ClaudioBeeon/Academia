# Nível 3 (fatia 1) — Progressão Dupla + Validação de RIR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-built, already-tested `avaliarProgressao` (double-progression suggestion) and `validarRir` (RIR-declaration cross-check) engines into the Treino screen, so their guidance actually reaches the user.

**Architecture:** No changes to `js/engine/progressao.js` or `js/engine/rir.js` — both are correct and tested. One new data helper in `js/data/historico.js` fetches a whole prior session's sets (not just one). `js/screens/treino.js` calls both engines from `montarCardExercicio`: the progression verdict renders as a live-updating hint (recomputed after every set, same pattern as the session-summary card), and the RIR check fires from inside the existing submit handler, showing a toast (same visual pattern as the existing PR toast) when triggered.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-nivel3-progressao-rir-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — this plan does not modify them at all.
- No new runtime dependencies, no IndexedDB schema changes.
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead. The engine-produced `motivo`/`mensagem` strings used here are fixed Portuguese text templates from `progressao.js`/`rir.js` (never DB-sourced), consistent with how the existing PR-toast messages from `recordes.js` are already handled in this file.
- Never auto-apply a progression/RIR suggestion to any field — both are informational only (guarda-corpo: "IA nunca decide séries, carga, RIR ou deload").

---

## Task 1: Data — Sessão anterior completa (`js/data/historico.js`)

**Files:**
- Modify: `js/data/historico.js`
- Modify: `js/data/historico.test.js`

**Interfaces:**
- Produces: `getSeriesDaUltimaSessaoAnterior(db, exercicioId, dataAtual) => Promise<Array>` — all series logged for `exercicioId` on the most recent date strictly before `dataAtual` (the whole session, not one set). Returns `[]` if there's no prior session for this exercise.

- [ ] **Step 1: Write the failing tests**

Append to `js/data/historico.test.js` (add `getSeriesDaUltimaSessaoAnterior` to the existing import line from `./historico.js`):

```javascript
test("getSeriesDaUltimaSessaoAnterior retorna vazio quando não há sessão anterior", async () => {
  const db = await openDatabase();
  const resultado = await getSeriesDaUltimaSessaoAnterior(db, "nunca-treinado", "2026-08-21");
  assert.deepEqual(resultado, []);
  db.close();
});

test("getSeriesDaUltimaSessaoAnterior retorna todas as séries da sessão anterior mais recente, ignorando sessões mais antigas e a de hoje", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-15", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 8, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-18", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 9, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-18", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 8, rir: 2, serieNumero: 2 });
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 13, reps: 10, rir: 1, serieNumero: 1 });

  const resultado = await getSeriesDaUltimaSessaoAnterior(db, "p", "2026-08-20");
  assert.equal(resultado.length, 2);
  assert.ok(resultado.every((s) => s.data === "2026-08-18"));
  db.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `getSeriesDaUltimaSessaoAnterior` is not exported yet.

- [ ] **Step 3: Write the implementation**

Add to `js/data/historico.js` (the import line already has everything this function needs — `getAllByIndex` is already imported):

```javascript
export async function getSeriesDaUltimaSessaoAnterior(db, exercicioId, dataAtual) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  const anteriores = doExercicio.filter((s) => s.data < dataAtual);
  if (anteriores.length === 0) return [];
  const dataMaisRecente = anteriores.reduce((max, s) => (s.data > max ? s.data : max), anteriores[0].data);
  return anteriores.filter((s) => s.data === dataMaisRecente);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new tests green, full existing suite (106 tests as of the prior plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/historico.js js/data/historico.test.js
git commit -m "Add getSeriesDaUltimaSessaoAnterior to fetch a whole prior session"
```

---

## Task 2: Screen — Live progression hint (`js/screens/treino.js`)

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `getSeriesDaUltimaSessaoAnterior(db, exercicioId, dataAtual)` from `../data/historico.js` (Task 1); `avaliarProgressao({ faixaMin, faixaMax, rirAlvo, sessaoAtual, sessaoAnterior })` from `../engine/progressao.js` (pre-existing, unmodified).

- [ ] **Step 1: Add the imports**

Add `getSeriesDaUltimaSessaoAnterior` to the existing destructured import from `../data/historico.js` (currently ends `...getSeriesDoDia, getUltimaSerieGeral } from "../data/historico.js";` — extend that list).

Add a new import line alongside the other engine imports:
```javascript
import { avaliarProgressao } from "../engine/progressao.js";
```

- [ ] **Step 2: Fetch the prior session and add the live-updating hint**

In `montarCardExercicio`, right after the existing:
```javascript
  const amostras = await getAmostrasRecentesDoExercicio(db, exercicio.id);
  const sugestao = sugerirCarga(amostras, cfg.rirAlvo);
```
add:
```javascript
  const sessaoAnteriorCompleta = await getSeriesDaUltimaSessaoAnterior(db, exercicio.id, hoje);
```

Right after the existing block that appends the "Última vez / Sugestão de hoje" hint (the `if (ultimaAnterior) { ... card.appendChild(hint); }` block), add a new hint element and its updater function:

```javascript
  const progressaoHint = document.createElement("div");
  progressaoHint.className = "prev-hint";
  progressaoHint.style.display = "none";
  card.appendChild(progressaoHint);

  const atualizarProgressao = () => {
    const avaliacao = avaliarProgressao({
      faixaMin: cfg.repsMin,
      faixaMax: cfg.repsMax,
      rirAlvo: cfg.rirAlvo,
      sessaoAtual: seriesHoje,
      sessaoAnterior: sessaoAnteriorCompleta,
    });
    if (avaliacao.acao === "aumentar_carga") {
      progressaoHint.textContent = `📈 ${avaliacao.motivo}`;
      progressaoHint.style.display = "";
    } else if (avaliacao.acao === "reduzir_carga") {
      progressaoHint.textContent = `📉 ${avaliacao.motivo}`;
      progressaoHint.style.display = "";
    } else {
      progressaoHint.style.display = "none";
    }
  };
  atualizarProgressao();
```

(`progressaoHint.textContent` is used, not `innerHTML` — `avaliacao.motivo` is always one of the fixed Portuguese templates from `progressao.js`, never DB-sourced, so either would technically be safe here, but `.textContent` costs nothing and needs no justification, unlike the existing `hint.innerHTML` a few lines above it which needs the bold-tag markup.)

- [ ] **Step 3: Recompute the hint after each set is logged**

Inside the existing `setsContainer.addEventListener("submit", async (event) => { ... })` handler, find this block:

```javascript
    await registrarSerie(db, {
      exercicioId: exercicio.id,
      data: hoje,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir: rirInput === "" || Number.isNaN(rirDigitado) ? cfg.rirAlvo : rirDigitado,
      serieNumero: Number(linha.dataset.numero),
    });
```

Right after it (before the `linha.classList.add("done");` line), add:

```javascript
    seriesHoje.push({
      exercicioId: exercicio.id,
      data: hoje,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir: rirInput === "" || Number.isNaN(rirDigitado) ? cfg.rirAlvo : rirDigitado,
      serieNumero: Number(linha.dataset.numero),
    });
    atualizarProgressao();
```

(This mirrors the exact object just passed to `registrarSerie` — `seriesHoje` is the same array `avaliarProgressao`'s `sessaoAtual` reads on every call, so it must reflect every set logged so far in this render, not just what existed at mount time. `registrarSerie` doesn't return the stored record with a generated `id`, and `avaliarProgressao` never reads `id`, so the pushed object not having one is fine.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 1 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change).

- [ ] **Step 5: Commit**

```bash
git add js/screens/treino.js
git commit -m "Show live progression guidance (aumentar/reduzir/manter carga) on Treino"
```

---

## Task 3: Screen — RIR cross-validation toast (`js/screens/treino.js`)

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `validarRir({ rirDeclarado, repsSerieAtual, repsSerieSeguinte, cargaIgual })` from `../engine/rir.js` (pre-existing, unmodified).
- Produces: `mostrarToastRir(mensagem)` — a private helper in this file, same visual pattern as the existing `mostrarToastPR(prs)`.

- [ ] **Step 1: Add the import**

Add a new import line alongside the other engine imports:
```javascript
import { validarRir } from "../engine/rir.js";
```

- [ ] **Step 2: Check the previous set right after registering a new one**

Inside the same submit handler, right after the `seriesHoje.push(...)` block added in Task 2's Step 3 (before `atualizarProgressao();`), add:

```javascript
    const numeroAtual = Number(linha.dataset.numero);
    const serieAnteriorMesmoExercicio = seriesHoje.find((s) => s.serieNumero === numeroAtual - 1);
    if (serieAnteriorMesmoExercicio && serieAnteriorMesmoExercicio.carga === carga) {
      const validacao = validarRir({
        rirDeclarado: serieAnteriorMesmoExercicio.rir,
        repsSerieAtual: serieAnteriorMesmoExercicio.reps,
        repsSerieSeguinte: reps,
        cargaIgual: true,
      });
      if (validacao.suspeitaSuperestimado) {
        mostrarToastRir(validacao.mensagem);
      }
    }
```

(`seriesHoje.find` looks at the array as it stood BEFORE this task's own push in Step 3 of Task 2 was reached in execution order — since this new block is placed after that push, `seriesHoje` at this point already includes the just-logged set too, but `.find((s) => s.serieNumero === numeroAtual - 1)` only ever matches the immediately preceding set number, never the one just pushed, so this is safe regardless of exact placement relative to the push.)

- [ ] **Step 3: Add the toast helper**

Add this function near the existing `mostrarToastPR` function (same file, module scope — not inside `montarCardExercicio`):

```javascript
function mostrarToastRir(mensagem) {
  const toast = document.createElement("div");
  toast.className = "rest-bar";
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = "108px";
  toast.style.transform = "translateX(-50%)";
  toast.style.width = "calc(100% - 44px)";
  toast.style.maxWidth = "398px";
  toast.style.zIndex = "10";
  toast.innerHTML = `<div><div class="label">💡 Calibração de RIR</div><div class="time" style="font-size:1rem;">${mensagem}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
```

(`mensagem` here is always one of the two fixed strings `validarRir` can return — either the exact calibration message or `null`, and this function is only ever called when it's the non-null message — never DB-sourced, matching the existing `mostrarToastPR` pattern that interpolates `p.mensagem` from `recordes.js` the same way.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 1 (no new tests — screens aren't unit tested in this project).

- [ ] **Step 5: Commit**

```bash
git add js/screens/treino.js
git commit -m "Add RIR calibration toast when a declared RIR looks overestimated"
```

---

## Task 4: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the progression hint's three states**

On an exercise with no prior session, confirm no progression hint shows
(state "manter", hidden). Log 3 sets all at or above the exercise's max
rep target with RIR at or above the target — confirm a "📈" hint appears
immediately after the 3rd set, without reloading. On a different exercise
where a prior session exists with reps below the minimum target, log a
set also below the minimum — confirm a "📉" hint appears (requires two
consecutive under-minimum sessions per the rule; may need to log a first
under-minimum session, then reload as if it were a new day, or verify via
the automated test's coverage of this exact rule and treat visual
confirmation of the "aumentar_carga" case as sufficient live evidence,
noting the "reduzir_carga" case is already covered by
`js/engine/progressao.test.js`).

- [ ] **Step 3: Verify the RIR toast**

Log a set with RIR declared as 1 or 2. Immediately log the next set on
the same exercise with the same carga and more reps than the previous
one. Confirm the "💡 Calibração de RIR" toast appears with the expected
message, and auto-dismisses after a few seconds. Log a set with a
different carga than the previous one — confirm no RIR toast fires (cargas
differ, the check should skip).

- [ ] **Step 4: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server,
reload, confirm the app still loads and renders fully from cache
(no `sw.js` change was needed this plan since no new files were added),
and that both hints/toasts still work offline.

- [ ] **Step 5: Report result to the user**

Show the working progression guidance and RIR calibration feedback. Note
this closes the "wire up dormant engines" half of Nível 3 fatia 1; next is
the subjective check-in (fatia 2).
