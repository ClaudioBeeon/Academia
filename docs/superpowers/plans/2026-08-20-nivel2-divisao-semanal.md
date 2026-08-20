# Divisão Semanal (Superior/Inferior) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded "peito only" filter on the Treino tab with a real Superior/Inferior split that rotates every session (not by calendar day), and implement the previously-empty "Divisão" tab to show today's group and a history of recent sessions.

**Architecture:** A pure engine module `js/engine/divisao.js` maps each `musculoPrimario` to `"superior"` or `"inferior"` and decides the next session's group from the most recently logged set — no new IndexedDB state. A new data helper `getUltimaSerieGeral(db)` in `js/data/historico.js` finds that most-recent set across all exercises. `js/screens/treino.js` uses both to replace its hardcoded exercise filter and header title. A new `js/screens/divisao.js` renders the Divisão tab (today's group + recent-sessions history), wired into `js/app.js`.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-nivel2-divisao-semanal-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- No new runtime dependencies.
- No IndexedDB schema changes — the next group is derived entirely from existing `historicoSeries` records, no new store or index.
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead. This applies directly here: `musculoPrimario` is free text (Biblioteca), so any place that renders it (or a value derived from it) must not go through `innerHTML`.
- `musculoPrimario` values outside the fixed `GRUPO_POR_MUSCULO` map must never crash the app or silently hide the exercise — see spec § "Casos de borda".

---

## Task 1: Engine — Divisão (`js/engine/divisao.js`)

**Files:**
- Create: `js/engine/divisao.js`
- Test: `js/engine/divisao.test.js`

**Interfaces:**
- Produces: `GRUPO_POR_MUSCULO` — a plain object mapping the 10 seeded muscle names to `"superior"` or `"inferior"`.
- Produces: `obterGrupoDoMusculo(musculo)` — returns `"superior"`, `"inferior"`, or `null` if `musculo` isn't a key in `GRUPO_POR_MUSCULO`. Never throws.
- Produces: `determinarProximoGrupo(ultimaSerie)` — takes the most recent `historicoSeries` record (an object with at least a `musculo` field) or `null`/`undefined`, returns `"superior"` if there's no record or its muscle isn't mapped, otherwise the opposite of that record's group.

- [ ] **Step 1: Write the failing tests**

Create `js/engine/divisao.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { GRUPO_POR_MUSCULO, obterGrupoDoMusculo, determinarProximoGrupo } from "./divisao.js";

test("GRUPO_POR_MUSCULO mapeia todos os 10 músculos semeados", () => {
  assert.equal(GRUPO_POR_MUSCULO.peito, "superior");
  assert.equal(GRUPO_POR_MUSCULO.costas, "superior");
  assert.equal(GRUPO_POR_MUSCULO.ombro, "superior");
  assert.equal(GRUPO_POR_MUSCULO.biceps, "superior");
  assert.equal(GRUPO_POR_MUSCULO.triceps, "superior");
  assert.equal(GRUPO_POR_MUSCULO.abdomen, "superior");
  assert.equal(GRUPO_POR_MUSCULO.quadriceps, "inferior");
  assert.equal(GRUPO_POR_MUSCULO.posterior_coxa, "inferior");
  assert.equal(GRUPO_POR_MUSCULO.gluteo, "inferior");
  assert.equal(GRUPO_POR_MUSCULO.panturrilha, "inferior");
});

test("obterGrupoDoMusculo retorna o grupo para músculos mapeados", () => {
  assert.equal(obterGrupoDoMusculo("peito"), "superior");
  assert.equal(obterGrupoDoMusculo("quadriceps"), "inferior");
});

test("obterGrupoDoMusculo retorna null para músculo não mapeado, sem lançar erro", () => {
  assert.equal(obterGrupoDoMusculo("core_customizado"), null);
});

test("determinarProximoGrupo retorna superior quando não há série anterior", () => {
  assert.equal(determinarProximoGrupo(null), "superior");
  assert.equal(determinarProximoGrupo(undefined), "superior");
});

test("determinarProximoGrupo alterna com base no músculo da última série", () => {
  assert.equal(determinarProximoGrupo({ musculo: "peito" }), "inferior");
  assert.equal(determinarProximoGrupo({ musculo: "quadriceps" }), "superior");
});

test("determinarProximoGrupo cai em superior quando a última série tem músculo não mapeado", () => {
  assert.equal(determinarProximoGrupo({ musculo: "core_customizado" }), "superior");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/engine/divisao.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/engine/divisao.js`:

```javascript
// js/engine/divisao.js
export const GRUPO_POR_MUSCULO = {
  peito: "superior",
  costas: "superior",
  ombro: "superior",
  biceps: "superior",
  triceps: "superior",
  abdomen: "superior",
  quadriceps: "inferior",
  posterior_coxa: "inferior",
  gluteo: "inferior",
  panturrilha: "inferior",
};

export function obterGrupoDoMusculo(musculo) {
  return GRUPO_POR_MUSCULO[musculo] ?? null;
}

export function determinarProximoGrupo(ultimaSerie) {
  if (!ultimaSerie) return "superior";
  const grupoAnterior = obterGrupoDoMusculo(ultimaSerie.musculo);
  if (grupoAnterior === null) return "superior";
  return grupoAnterior === "superior" ? "inferior" : "superior";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 6 new tests green, full existing suite (95 tests as of the prior plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/divisao.js js/engine/divisao.test.js
git commit -m "Add weekly-split engine (Superior/Inferior rotation by session)"
```

---

## Task 2: Data — Última série geral (`js/data/historico.js`)

**Files:**
- Modify: `js/data/historico.js`
- Modify: `js/data/historico.test.js`

**Interfaces:**
- Consumes: `getAll(db, storeName)` from `./db.js` (already used elsewhere in this file's sibling modules, not yet imported in `historico.js` itself).
- Produces: `getUltimaSerieGeral(db) => Promise<object | undefined>` — the single most recent `historicoSeries` record across every exercise (sorted by `data` desc, `id` desc as tiebreaker, same tiebreak pattern as `getUltimaSerieAnterior` in this same file). Returns `undefined` if the store is empty.

- [ ] **Step 1: Write the failing test**

Append to `js/data/historico.test.js` (check the existing import line at the top of the file and add `getUltimaSerieGeral` to it):

```javascript
test("getUltimaSerieGeral retorna undefined quando não há nenhuma série", async () => {
  const db = await openDatabase();
  const resultado = await getUltimaSerieGeral(db);
  assert.equal(resultado, undefined);
  db.close();
});

test("getUltimaSerieGeral retorna a série mais recente entre todos os exercícios", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "x", data: "2026-08-19", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "y", data: "2026-08-21", musculo: "quadriceps", contribuicao: 1, tipoSerie: "normal", carga: 40, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "z", data: "2026-08-20", musculo: "costas", contribuicao: 1, tipoSerie: "normal", carga: 20, reps: 8, rir: 1 });

  const resultado = await getUltimaSerieGeral(db);
  assert.equal(resultado.data, "2026-08-21");
  assert.equal(resultado.musculo, "quadriceps");
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `getUltimaSerieGeral` is not exported yet.

- [ ] **Step 3: Write the implementation**

In `js/data/historico.js`, change the top import line from:
```javascript
import { put, getAllByIndex } from "./db.js";
```
to:
```javascript
import { put, getAllByIndex, getAll } from "./db.js";
```

Add this function anywhere among the other exported functions:

```javascript
export async function getUltimaSerieGeral(db) {
  const todas = await getAll(db, "historicoSeries");
  if (todas.length === 0) return undefined;
  return todas.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)[0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new tests green, full suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/historico.js js/data/historico.test.js
git commit -m "Add getUltimaSerieGeral to find the most recent logged set overall"
```

---

## Task 3: Screen — Rewire Treino to the split (`js/screens/treino.js`)

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `getUltimaSerieGeral(db)` from `../data/historico.js` (Task 2); `obterGrupoDoMusculo`, `determinarProximoGrupo` from `../engine/divisao.js` (Task 1).

- [ ] **Step 1: Add the imports**

Add `getUltimaSerieGeral` to the existing destructured import from `../data/historico.js` (currently `import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDoDia } from "../data/historico.js";` — extend the list, don't add a new import line).

Add a new import line alongside the other engine imports:
```javascript
import { obterGrupoDoMusculo, determinarProximoGrupo } from "../engine/divisao.js";
```

- [ ] **Step 2: Replace the hardcoded filter and header title**

In `montarTelaTreino`, replace:

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
```

with:

```javascript
export async function montarTelaTreino(db, { onAbrirHistorico } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const ultimaSerieGeral = await getUltimaSerieGeral(db);
  const grupoDeHoje = determinarProximoGrupo(ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";
  const exerciciosHoje = todosExercicios.filter((e) => {
    const grupo = obterGrupoDoMusculo(e.musculoPrimario);
    return grupo === null || grupo === grupoDeHoje;
  });

  const root = document.createElement("div");
  root.className = "tela-treino";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div class="date-label">Sessão de hoje</div>
    <div class="day-title">${tituloGrupo}</div>
  `;
  root.appendChild(header);
```

(`tituloGrupo` is always exactly `"Superior"` or `"Inferior"` — a fixed value produced by our own pure function, never DB-sourced or user-editable text, so interpolating it into `innerHTML` here is consistent with the project's hardening rule, same as the existing PR-toast numbers.)

- [ ] **Step 3: Update the empty-state message**

Replace:
```javascript
  if (exerciciosHoje.length === 0) {
    main.innerHTML = `<p class="vazio">Nenhum exercício de peito cadastrado ainda.</p>`;
  }
```
with:
```javascript
  if (exerciciosHoje.length === 0) {
    main.innerHTML = `<p class="vazio">Nenhum exercício de ${tituloGrupo.toLowerCase()} cadastrado ainda.</p>`;
  }
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 2 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change).

- [ ] **Step 5: Commit**

```bash
git add js/screens/treino.js
git commit -m "Rewire Treino to the Superior/Inferior split instead of hardcoded peito"
```

---

## Task 4: Screen — Divisão tab (`js/screens/divisao.js`, `js/app.js`)

**Files:**
- Create: `js/screens/divisao.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `getAll(db, storeName)` from `../data/db.js`; `getUltimaSerieGeral(db)` from `../data/historico.js` (Task 2); `GRUPO_POR_MUSCULO`, `obterGrupoDoMusculo`, `determinarProximoGrupo` from `../engine/divisao.js` (Task 1).
- Produces: `montarTelaDivisao(db) => Promise<HTMLElement>`, same shape as `montarTelaEvolucao(db)` in `js/screens/evolucao.js` (no options object — this screen has no navigation callbacks).

- [ ] **Step 1: Create the screen**

Create `js/screens/divisao.js`:

```javascript
// js/screens/divisao.js
import { getAll } from "../data/db.js";
import { getUltimaSerieGeral } from "../data/historico.js";
import { GRUPO_POR_MUSCULO, obterGrupoDoMusculo, determinarProximoGrupo } from "../engine/divisao.js";

export async function montarTelaDivisao(db) {
  const root = document.createElement("div");
  root.className = "tela-divisao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Divisão de treino</div><div class="day-title">Divisão</div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const [ultimaSerieGeral, todasAsSeries] = await Promise.all([
    getUltimaSerieGeral(db),
    getAll(db, "historicoSeries"),
  ]);

  const grupoDeHoje = determinarProximoGrupo(ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";

  main.appendChild(montarCardHoje(tituloGrupo));
  main.appendChild(montarCardHistorico(todasAsSeries));

  return root;
}

function montarCardHoje(tituloGrupo) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Hoje: ${tituloGrupo}</div></div>
    <div class="prev-hint" style="padding:0 18px 18px;">Rotação por sessão: o grupo alterna a cada treino registrado, não por dia fixo da semana.</div>
  `;
  return card;
}

function montarCardHistorico(todasAsSeries) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Sessões recentes</div></div>`;

  const musculoPorData = new Map();
  for (const serie of todasAsSeries) {
    if (!musculoPorData.has(serie.data)) musculoPorData.set(serie.data, serie.musculo);
  }

  const datasOrdenadas = [...musculoPorData.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 14);

  const lista = document.createElement("div");
  lista.className = "sets";
  lista.style.padding = "0 18px 18px";

  if (datasOrdenadas.length === 0) {
    lista.innerHTML = `<p class="vazio">Nenhuma sessão registrada ainda.</p>`;
  } else {
    for (const data of datasOrdenadas) {
      const grupo = obterGrupoDoMusculo(musculoPorData.get(data));
      const rotulo = grupo === "superior" ? "Superior" : grupo === "inferior" ? "Inferior" : "Grupo não identificado";
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.style.gridColumn = "1/-1";
      linha.textContent = `${data} — ${rotulo}`;
      lista.appendChild(linha);
    }
  }

  card.appendChild(lista);
  return card;
}
```

(`linha.textContent` is used for every per-day row because `data` and the muscle-derived label both ultimately trace back to `historicoSeries` records — even though `data` is always an app-generated `"YYYY-MM-DD"` string today, using `.textContent` here costs nothing and matches the project's blanket hardening rule instead of relying on that assumption holding forever.)

- [ ] **Step 2: Wire the tab in `js/app.js`**

Add the import alongside the other screen imports:
```javascript
import { montarTelaDivisao } from "./screens/divisao.js";
```

Add a new branch inside `renderTab`, alongside the existing `if (tabName === "evolucao")` branch:
```javascript
      if (tabName === "divisao") {
        content.textContent = "";
        content.appendChild(await montarTelaDivisao(db));
        return;
      }
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 2 (no new tests — screens aren't unit tested in this project).

- [ ] **Step 4: Commit**

```bash
git add js/screens/divisao.js js/app.js
git commit -m "Implement Divisão tab: today's group + recent-sessions history"
```

---

## Task 5: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 2 new files to `APP_SHELL`, bump the cache version**

Add these two entries anywhere in the `APP_SHELL` array:
```javascript
  "./js/engine/divisao.js",
  "./js/screens/divisao.js",
```

Change `const CACHE_NAME = "app-treino-shell-v7";` to `const CACHE_NAME = "app-treino-shell-v8";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 103 tests total (95 pre-existing + 6 new in Task 1 + 2 new in Task 2), all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add divisao.js files to service worker cache list, bump to v8"
```

---

## Task 6: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the Treino tab shows the correct group**

Open the Treino tab. Confirm the header shows "Superior" or "Inferior" (not "Peito"), and the exercise list matches: superior → peito/costas/ombro/bíceps/tríceps/abdômen exercises; inferior → quadríceps/posterior de coxa/glúteo/panturrilha exercises.

- [ ] **Step 3: Verify alternation**

Log a set on any exercise in today's group. Reload the app (or navigate away from Treino and back). Confirm the group flips to the opposite one, and the exercise list changes accordingly.

- [ ] **Step 4: Verify the Divisão tab**

Open the Divisão tab. Confirm it shows "Hoje: Superior" or "Hoje: Inferior" matching what Treino currently shows, and a "Sessões recentes" list with the dates and groups of sets logged so far (most recent first).

- [ ] **Step 5: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (including the Divisão tab) still loads and renders fully from cache, and that the correct group still displays offline.

- [ ] **Step 6: Report result to the user**

Show the working split rotation and the new Divisão tab. Note that this closes out the remaining Nível 2 items (supersets was the other one listed in the roadmap — confirm with the user whether it's still wanted, since supersets weren't part of this plan's spec).
