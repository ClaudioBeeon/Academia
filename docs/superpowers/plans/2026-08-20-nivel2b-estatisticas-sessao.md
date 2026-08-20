# Nível 2b (fatia 3) — Estatísticas de Sessão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a live-updating "Resumo da sessão" card at the bottom of the Treino tab — total sets, total volume, exercises trained, and muscles trained for today — that redraws immediately after every set the user logs.

**Architecture:** A pure engine module `js/engine/sessao.js` aggregates a day's raw `historicoSeries` rows into the four summary numbers. A one-line data helper `getSeriesDoDia(db, data)` reads via the store's existing `"data"` index. `js/screens/treino.js` gains a summary card and a small `aoRegistrarSerie` callback threaded through the existing per-exercise submit handler, so logging any set anywhere on the page refreshes the one shared summary.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-nivel2b-estatisticas-sessao-design.md`. Third of four independent Nível 2b slices — graphs (done), body measurements (done), this one, then calendar.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- No new runtime dependencies.
- No IndexedDB schema changes — this slice only reads via the existing `"data"` index on `historicoSeries` (added in the very first schema, no bump needed).
- The summary card must always render, even with zero sets logged today (unlike Evolução's sections, which omit cards for metrics with no data — the session-stats card is specifically about "today," so a "0 séries" placeholder is the correct empty state, not an omitted card).

---

## Task 1: Data — Ler as séries do dia (`js/data/historico.js`)

**Files:**
- Modify: `js/data/historico.js`
- Modify: `js/data/historico.test.js`

**Interfaces:**
- Produces: `getSeriesDoDia(db, data) => Promise<Array>` — all `historicoSeries` rows (any exercise) for the given `"YYYY-MM-DD"` date string, unsorted (the engine in Task 2 doesn't need ordering).

- [ ] **Step 1: Write the failing test**

Append to `js/data/historico.test.js`:

```javascript
test("getSeriesDoDia retorna todas as séries de todos os exercícios numa data", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "h", data: "2026-08-21", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "i", data: "2026-08-21", musculo: "costas", contribuicao: 1, tipoSerie: "normal", carga: 20, reps: 8, rir: 1 });
  await registrarSerie(db, { exercicioId: "h", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 9, reps: 10, rir: 2 });

  const seriesDoDia = await getSeriesDoDia(db, "2026-08-21");
  assert.equal(seriesDoDia.length, 2);
  assert.ok(seriesDoDia.every((s) => s.data === "2026-08-21"));
  db.close();
});
```

Add `getSeriesDoDia` to the existing import line at the top of the file:
```javascript
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDoDia } from "./historico.js";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `getSeriesDoDia` is not exported yet.

- [ ] **Step 3: Write the implementation**

In `js/data/historico.js`, add:

```javascript
export function getSeriesDoDia(db, data) {
  return getAllByIndex(db, "historicoSeries", "data", data);
}
```

(Place it anywhere among the other exported functions — file has no particular ordering convention beyond roughly "most specific query first".)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new test green, full existing suite (89 tests as of the prior Nível 2b slice) still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/historico.js js/data/historico.test.js
git commit -m "Add getSeriesDoDia to read all of a day's logged sets"
```

---

## Task 2: Engine — Estatísticas de sessão (`js/engine/sessao.js`)

**Files:**
- Create: `js/engine/sessao.js`
- Test: `js/engine/sessao.test.js`

**Interfaces:**
- Produces: `calcularEstatisticasSessao(seriesDoDia)` — takes an array of series objects from any exercise (each with at least `exercicioId`, `musculo`, `carga`, `reps`, `tipoSerie`) and returns `{ totalSeries: number, volumeTotal: number, exerciciosTreinados: number, musculosTreinados: string[] }`. Excludes `tipoSerie === "aquecimento"` from every metric. `musculosTreinados` is sorted alphabetically (deterministic display order).

- [ ] **Step 1: Write the failing tests**

Create `js/engine/sessao.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularEstatisticasSessao } from "./sessao.js";

test("array vazio retorna os quatro campos zerados", () => {
  const resultado = calcularEstatisticasSessao([]);
  assert.deepEqual(resultado, {
    totalSeries: 0,
    volumeTotal: 0,
    exerciciosTreinados: 0,
    musculosTreinados: [],
  });
});

test("exclui séries de aquecimento de todas as métricas", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 20, reps: 10, tipoSerie: "aquecimento" },
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.equal(resultado.totalSeries, 1);
  assert.equal(resultado.volumeTotal, 600);
});

test("conta exercícios distintos, não séries", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
    { exercicioId: "a", musculo: "peito", carga: 62.5, reps: 8, tipoSerie: "normal" },
    { exercicioId: "b", musculo: "triceps", carga: 20, reps: 12, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.equal(resultado.totalSeries, 3);
  assert.equal(resultado.exerciciosTreinados, 2);
});

test("soma volume como carga vezes reps de cada série", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
    { exercicioId: "b", musculo: "costas", carga: 20, reps: 8, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.equal(resultado.volumeTotal, 760);
});

test("musculosTreinados vem sem duplicatas e ordenado", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
    { exercicioId: "b", musculo: "triceps", carga: 20, reps: 8, tipoSerie: "normal" },
    { exercicioId: "c", musculo: "peito", carga: 40, reps: 10, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.deepEqual(resultado.musculosTreinados, ["peito", "triceps"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/engine/sessao.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/engine/sessao.js`:

```javascript
// js/engine/sessao.js
export function calcularEstatisticasSessao(seriesDoDia) {
  const validas = seriesDoDia.filter((s) => s.tipoSerie !== "aquecimento");

  const totalSeries = validas.length;
  const volumeTotal = validas.reduce((soma, s) => soma + s.carga * s.reps, 0);
  const exercicios = new Set(validas.map((s) => s.exercicioId));
  const musculos = new Set(validas.map((s) => s.musculo));

  return {
    totalSeries,
    volumeTotal,
    exerciciosTreinados: exercicios.size,
    musculosTreinados: [...musculos].sort(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 5 new tests green, full suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/sessao.js js/engine/sessao.test.js
git commit -m "Add session-stats engine (calcularEstatisticasSessao)"
```

---

## Task 3: Screen — Card de resumo de sessão em Treino (`js/screens/treino.js`)

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `getSeriesDoDia(db, data)` from `../data/historico.js` (Task 1); `calcularEstatisticasSessao(seriesDoDia)` from `../engine/sessao.js` (Task 2).
- `montarCardExercicio` gains one new parameter, `aoRegistrarSerie` (an optional callback, invoked with no arguments after a set is successfully registered).

- [ ] **Step 1: Add the imports**

At the top of `js/screens/treino.js`, alongside the existing imports:

```javascript
import { getSeriesDoDia } from "../data/historico.js";
```
(Add it to the existing `import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio } from "../data/historico.js";` line rather than a new line — just extend the destructured list.)

```javascript
import { calcularEstatisticasSessao } from "../engine/sessao.js";
```

- [ ] **Step 2: Add the summary card builder and wire it into `montarTelaTreino`**

Add this new function anywhere alongside `criarPlaceholderDescanso`:

```javascript
function montarCardResumoSessao() {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Resumo da sessão</div></div>
    <div class="prev-hint resumo-texto" style="padding:0 18px 8px;"></div>
    <div class="prev-hint resumo-musculos" style="padding:0 18px 16px;"></div>
  `;
  return card;
}

function atualizarResumoSessao(card, stats) {
  const texto = card.querySelector(".resumo-texto");
  texto.innerHTML = `<b>${stats.totalSeries}</b> séries · <b>${stats.volumeTotal}</b> kg de volume total · <b>${stats.exerciciosTreinados}</b> exercícios`;

  const musculos = card.querySelector(".resumo-musculos");
  if (stats.musculosTreinados.length > 0) {
    musculos.textContent = `Músculos: ${stats.musculosTreinados.join(", ")}`;
  } else {
    musculos.textContent = "Nenhum músculo treinado ainda hoje.";
  }
}
```

Note: `resumo-texto`'s `innerHTML` interpolates only numbers computed by `calcularEstatisticasSessao` (never IndexedDB-derived free text), so it doesn't need `.textContent` hardening — but `resumo-musculos` uses `.textContent` regardless, since `musculosTreinados` entries come from `historicoSeries.musculo`, which is IndexedDB-derived data (per the project's hardening rule, any string sourced from IndexedDB goes through `.textContent`, even one that today only ever holds a small fixed set of muscle-name strings from the seeded exercise library).

- [ ] **Step 3: Wire the card into `montarTelaTreino`, add the live-refresh callback**

Replace the current `montarTelaTreino` body:

```javascript
export async function montarTelaTreino(db, { onAbrirHistorico } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const exerciciosHoje = todosExercicios.filter((e) => e.musculoPrimario === "peito");

  const root = document.createElement("div");
  root.className = "tela-treino";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div class="date-label">Sessão de hoje</div>
    <div class="day-title">Peito</div>
  `;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const resumoCard = montarCardResumoSessao();
  const atualizarResumo = async () => {
    const seriesDoDia = await getSeriesDoDia(db, hoje);
    atualizarResumoSessao(resumoCard, calcularEstatisticasSessao(seriesDoDia));
  };

  for (let i = 0; i < exerciciosHoje.length; i++) {
    const exercicio = exerciciosHoje[i];
    const card = await montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico, equipamento, atualizarResumo);
    main.appendChild(card);
    if (i < exerciciosHoje.length - 1) {
      main.appendChild(criarPlaceholderDescanso());
    }
  }

  if (exerciciosHoje.length === 0) {
    main.innerHTML = `<p class="vazio">Nenhum exercício de peito cadastrado ainda.</p>`;
  }

  await atualizarResumo();
  main.appendChild(resumoCard);

  return root;
}
```

(Only two things changed from the current version: `resumoCard`/`atualizarResumo` are created before the loop, `atualizarResumo` is threaded into every `montarCardExercicio` call as a new final argument, and the card is appended — after being populated once — at the very end, so it always sits below every exercise card regardless of how many there are.)

- [ ] **Step 4: Update `montarCardExercicio`'s signature and its submit handler**

Change the function signature line from:
```javascript
async function montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico, equipamento) {
```
to:
```javascript
async function montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico, equipamento, aoRegistrarSerie) {
```

Inside that function's `setsContainer.addEventListener("submit", ...)` handler, find the closing block:

```javascript
    const prsRelevantes = prs.filter((p) => p.tipo !== "primeira_serie");
    if (prsRelevantes.length > 0) {
      mostrarToastPR(prsRelevantes);
    }
  });
```

Replace it with:

```javascript
    const prsRelevantes = prs.filter((p) => p.tipo !== "primeira_serie");
    if (prsRelevantes.length > 0) {
      mostrarToastPR(prsRelevantes);
    }

    if (aoRegistrarSerie) await aoRegistrarSerie();
  });
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 2 (this task adds no new tests — screens aren't unit tested in this project).

- [ ] **Step 6: Commit**

```bash
git add js/screens/treino.js
git commit -m "Add live session-stats summary card to Treino"
```

---

## Task 4: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 1 new file to `APP_SHELL`, bump the cache version**

Add this entry anywhere in the `APP_SHELL` array:
```javascript
  "./js/engine/sessao.js",
```
(`js/data/historico.js` and `js/screens/treino.js` are already in `APP_SHELL` from earlier plans — only the one brand-new file needs adding.)

Change `const CACHE_NAME = "app-treino-shell-v6";` to `const CACHE_NAME = "app-treino-shell-v7";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 95 tests total (89 pre-existing + 1 new in Task 1 + 5 new in Task 2), all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add sessao.js to service worker cache list, bump to v7"
```

---

## Task 5: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the empty state**

Open Treino on a day with no sets logged yet. Confirm "Resumo da sessão" renders at the bottom showing "0 séries · 0 kg de volume total · 0 exercícios" and "Nenhum músculo treinado ainda hoje."

- [ ] **Step 3: Verify live updates**

Log a set on any exercise card. Confirm the summary card immediately updates its numbers (without a page reload) — series count increments, volume total increases by `carga × reps` of the logged set, the exercise's muscle appears in the muscle list. Log a second set on the same exercise, confirm `exerciciosTreinados` stays at 1 (not 2) while `totalSeries` increments. Log a set on a different exercise (if more than one chest exercise is available in the seeded data), confirm `exerciciosTreinados` becomes 2 and the muscle list still shows no duplicates.

- [ ] **Step 4: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (including the new summary card) still loads and renders fully from cache, and that logging a set still updates the summary while offline (IndexedDB writes work offline already — this just confirms the new code path does too).

- [ ] **Step 5: Report result to the user**

Show the working live session summary. Note that calendar (the last remaining Nível 2b slice) is next.
