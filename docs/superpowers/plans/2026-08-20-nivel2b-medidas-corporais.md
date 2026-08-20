# Nível 2b (fatia 2) — Medidas Corporais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user log new body-measurement points (weight, waist, body-fat %) and see each metric's trend as a line chart in the Evolução tab, building on the existing seeded baseline in `perfil.json` without ever touching the seed/reseed mechanism.

**Architecture:** A new IndexedDB store `medidasCorporais` (own store, never merged into the seeded `perfil` document — see spec §3 for why). A pure engine module `js/engine/medidas.js` extracts a generic `{data, valor}` time series for any of the three metrics. `js/screens/evolucao.js` gains a third section (form + three line charts), reusing the line-chart SVG helper from the graphs slice after a small generalization (it was hardcoded to the `carga1RM` field name).

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests, tokens from `css/tokens.css`.

**Spec:** `docs/superpowers/specs/2026-08-20-nivel2b-medidas-corporais-design.md`. Third of four independent Nível 2b slices — graphs (done), this one, then session stats, then calendar.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- Any string interpolated into `innerHTML` that originates from user input or IndexedDB must go through `.textContent` instead.
- No new runtime dependencies.
- User-registered measurement points must NEVER live inside the `perfil` IndexedDB document — `js/data/seed.js:23` unconditionally overwrites that whole document on any reseed. They live in their own store, `medidasCorporais`, exactly like `js/data/equipamento.js` keeps user-editable settings out of anything the seed overwrites.
- IndexedDB schema changes must stay non-destructive: only add stores/indexes, never remove or rename existing ones (same discipline already in `js/data/db.js`'s upgrade handler).

---

## Task 1: Data — Add `medidasCorporais` store to the schema (`js/data/db.js`)

**Files:**
- Modify: `js/data/db.js`
- Modify: `js/data/db.test.js`

**Interfaces:**
- Produces: a new IndexedDB store `medidasCorporais` with `{ keyPath: "id", autoIncrement: true }`, plus a `"data"` index on it (same shape as `historicoSeries`). `DB_VERSION` bumped from `2` to `3`.

- [ ] **Step 1: Write the failing tests**

In `js/data/db.test.js`, update the two existing `assert.deepEqual(nomes, [...])` / `assert.deepEqual(names, [...])` arrays (lines 42-45 and 52-55) to include `"medidasCorporais"` in alphabetical position:

```javascript
  assert.deepEqual(nomes, [
    "cargas", "config", "dietaBase", "exercicios",
    "historicoSeries", "medidasCorporais", "perfil", "protocolo", "registrosDiarios",
  ]);
```
(apply the same array change to both occurrences — the v1-upgrade test at the top and the "creates all expected object stores" test).

Then append two new tests at the end of the file:

```javascript
test("medidasCorporais store has a data index", async () => {
  const db = await openDatabase();
  const tx = db.transaction("medidasCorporais", "readonly");
  const store = tx.objectStore("medidasCorporais");
  assert.ok(store.indexNames.contains("data"));
  db.close();
});

test("um banco academiaDB criado na v2 (sem medidasCorporais) ganha a store nova ao abrir com a openDatabase() real, sem perder dados", async () => {
  // Fecha o banco global "academiaDB" que os testes anteriores deste
  // arquivo já abriram na versão atual, para simular de verdade um
  // navegador que só tinha a v2.
  const dbAtual = await openDatabase();
  dbAtual.close();
  indexedDB.deleteDatabase("academiaDB");

  const dbV2 = await new Promise((resolve, reject) => {
    const req = indexedDB.open("academiaDB", 2);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("perfil", { keyPath: "versao" });
      req.result.createObjectStore("historicoSeries", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = dbV2.transaction("perfil", "readwrite");
    tx.objectStore("perfil").add({ versao: "1.0", dadosBasicos: { peso_kg: 71 } });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  dbV2.close();

  const dbNovo = await openDatabase();
  assert.ok(dbNovo.objectStoreNames.contains("medidasCorporais"));
  const perfilRegistros = await new Promise((resolve, reject) => {
    const req = dbNovo.transaction("perfil", "readonly").objectStore("perfil").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert.equal(perfilRegistros.length, 1);
  assert.equal(perfilRegistros[0].dadosBasicos.peso_kg, 71);
  dbNovo.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — the two updated `deepEqual` assertions fail (missing `"medidasCorporais"` in the actual store list), and the new tests fail (`medidasCorporais` store doesn't exist / transaction fails).

- [ ] **Step 3: Write the implementation**

In `js/data/db.js`, change:
```javascript
const DB_VERSION = 2;
```
to:
```javascript
const DB_VERSION = 3;
```

Add `medidasCorporais` to the `STORES` object:
```javascript
const STORES = {
  perfil: "versao",
  protocolo: "versao",
  exercicios: "id",
  dietaBase: "versao",
  historicoSeries: { keyPath: "id", autoIncrement: true },
  medidasCorporais: { keyPath: "id", autoIncrement: true },
  cargas: "exercicioId",
  registrosDiarios: "data",
  config: "chave",
};
```

In the `onupgradeneeded` handler, extend the `if (name === "historicoSeries")` index-creation block to also cover `medidasCorporais` (it needs the same single `"data"` index, no `"exercicioId"` index):
```javascript
        if (name === "historicoSeries") {
          if (!store.indexNames.contains("exercicioId")) {
            store.createIndex("exercicioId", "exercicioId", { unique: false });
          }
          if (!store.indexNames.contains("data")) {
            store.createIndex("data", "data", { unique: false });
          }
        }
        if (name === "medidasCorporais") {
          if (!store.indexNames.contains("data")) {
            store.createIndex("data", "data", { unique: false });
          }
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `db.test.js` green, plus the full existing suite (74 tests from before this plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/db.js js/data/db.test.js
git commit -m "Add medidasCorporais store to IndexedDB schema, bump to v3"
```

---

## Task 2: Engine — Série temporal genérica (`js/engine/medidas.js`)

**Files:**
- Create: `js/engine/medidas.js`
- Test: `js/engine/medidas.test.js`

**Interfaces:**
- Produces: `prepararSerieTemporal(linhas, campo)` — takes an array of row objects (each with at least `data` (string `"YYYY-MM-DD"`) and, optionally, the field named by `campo`) and a field name string. Returns an array of `{ data, valor }` sorted by `data` ascending, containing only rows where `linha[campo] != null`.

- [ ] **Step 1: Write the failing tests**

Create `js/engine/medidas.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararSerieTemporal } from "./medidas.js";

test("filtra linhas sem o campo pedido", () => {
  const linhas = [
    { data: "2026-08-01", peso_kg: 71 },
    { data: "2026-08-05", cintura_cm: 61 },
    { data: "2026-08-10", peso_kg: 70.5 },
  ];
  const resultado = prepararSerieTemporal(linhas, "peso_kg");
  assert.deepEqual(resultado, [
    { data: "2026-08-01", valor: 71 },
    { data: "2026-08-10", valor: 70.5 },
  ]);
});

test("ordena por data ascendente mesmo com entrada fora de ordem", () => {
  const linhas = [
    { data: "2026-08-10", peso_kg: 70.5 },
    { data: "2026-08-01", peso_kg: 71 },
  ];
  const resultado = prepararSerieTemporal(linhas, "peso_kg");
  assert.deepEqual(resultado.map((p) => p.data), ["2026-08-01", "2026-08-10"]);
});

test("funciona igualmente para qualquer nome de campo", () => {
  const linhas = [{ data: "2026-08-01", percentualGordura: 20 }];
  const resultado = prepararSerieTemporal(linhas, "percentualGordura");
  assert.deepEqual(resultado, [{ data: "2026-08-01", valor: 20 }]);
});

test("array vazio retorna array vazio", () => {
  assert.deepEqual(prepararSerieTemporal([], "peso_kg"), []);
});

test("campo presente mas null é tratado como ausente", () => {
  const linhas = [{ data: "2026-08-01", peso_kg: null }, { data: "2026-08-02", peso_kg: 70 }];
  const resultado = prepararSerieTemporal(linhas, "peso_kg");
  assert.deepEqual(resultado, [{ data: "2026-08-02", valor: 70 }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/engine/medidas.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/engine/medidas.js`:

```javascript
// js/engine/medidas.js
export function prepararSerieTemporal(linhas, campo) {
  return linhas
    .filter((linha) => linha[campo] != null)
    .map((linha) => ({ data: linha.data, valor: linha[campo] }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 5 new tests green, full suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/medidas.js js/engine/medidas.test.js
git commit -m "Add generic time-series engine for body measurements"
```

---

## Task 3: Data — Registrar e ler medidas corporais (`js/data/medidas.js`)

**Files:**
- Create: `js/data/medidas.js`
- Test: `js/data/medidas.test.js`

**Interfaces:**
- Consumes: `get`, `getAll`, `put` from `./db.js` (existing).
- Produces: `getMedidas(db) => Promise<Array<{id, data, peso_kg?, cintura_cm?, percentualGordura?}>>` and `registrarMedida(db, {data, peso_kg?, cintura_cm?, percentualGordura?}) => Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `js/data/medidas.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, put, clearStore } from "./db.js";
import { getMedidas, registrarMedida } from "./medidas.js";

function perfilFixture() {
  return {
    versao: "1.0",
    dataAtualizacao: "2026-08-19",
    dadosBasicos: { peso_kg: 71 },
    composicaoCorporal: { historico: [{ data: "2026-08-19", percentualGordura: 20 }] },
    medidas: { cintura_cm: { historico: [{ data: "2026-08-19", valor: 62 }] } },
  };
}

test("getMedidas faz bootstrap de uma linha inicial a partir do perfil salvo, na primeira chamada", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());

  const linhas = await getMedidas(db);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].data, "2026-08-19");
  assert.equal(linhas[0].peso_kg, 71);
  assert.equal(linhas[0].percentualGordura, 20);
  assert.equal(linhas[0].cintura_cm, 62);
  db.close();
});

test("getMedidas não repete o bootstrap numa segunda chamada", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());

  await getMedidas(db);
  const linhas = await getMedidas(db);
  assert.equal(linhas.length, 1);
  db.close();
});

test("registrarMedida grava uma linha nova e getMedidas passa a incluí-la", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());
  await getMedidas(db); // consome o bootstrap antes do teste

  await registrarMedida(db, { data: "2026-08-25", peso_kg: 70.5 });
  const linhas = await getMedidas(db);
  assert.equal(linhas.length, 2);
  const nova = linhas.find((l) => l.data === "2026-08-25");
  assert.equal(nova.peso_kg, 70.5);
  db.close();
});

test("registrar duas medidas no mesmo dia mantém as duas linhas", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());
  await getMedidas(db);

  await registrarMedida(db, { data: "2026-08-26", peso_kg: 70 });
  await registrarMedida(db, { data: "2026-08-26", cintura_cm: 60 });
  const linhas = await getMedidas(db);
  const doDia = linhas.filter((l) => l.data === "2026-08-26");
  assert.equal(doDia.length, 2);
  db.close();
});

test("getMedidas retorna array vazio sem lançar erro se não houver perfil salvo", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");

  const linhas = await getMedidas(db);
  assert.deepEqual(linhas, []);
  db.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/data/medidas.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/data/medidas.js`:

```javascript
// js/data/medidas.js
import { getAll, put } from "./db.js";

export async function getMedidas(db) {
  const existentes = await getAll(db, "medidasCorporais");
  if (existentes.length > 0) return existentes;

  const perfis = await getAll(db, "perfil");
  if (perfis.length === 0) return [];
  const perfil = perfis[0];

  const linhaInicial = { data: perfil.dataAtualizacao };
  if (perfil.dadosBasicos?.peso_kg != null) {
    linhaInicial.peso_kg = perfil.dadosBasicos.peso_kg;
  }
  const gordura = perfil.composicaoCorporal?.historico?.[0];
  if (gordura?.percentualGordura != null) {
    linhaInicial.percentualGordura = gordura.percentualGordura;
  }
  const cintura = perfil.medidas?.cintura_cm?.historico?.[0];
  if (cintura?.valor != null) {
    linhaInicial.cintura_cm = cintura.valor;
  }

  await put(db, "medidasCorporais", linhaInicial);
  return getAll(db, "medidasCorporais");
}

export function registrarMedida(db, { data, peso_kg, cintura_cm, percentualGordura }) {
  const linha = { data };
  if (peso_kg != null) linha.peso_kg = peso_kg;
  if (cintura_cm != null) linha.cintura_cm = cintura_cm;
  if (percentualGordura != null) linha.percentualGordura = percentualGordura;
  return put(db, "medidasCorporais", linha);
}
```

Note: `medidasCorporais` uses `autoIncrement: true` on `id` — `put` without an `id` field always inserts a new row (never overwrites), which is exactly the "log an entry" semantics this store needs (same as `historicoSeries`/`registrarSerie`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 5 new tests green, full suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/medidas.js js/data/medidas.test.js
git commit -m "Add medidas corporais data layer (bootstrap from perfil + registrarMedida)"
```

---

## Task 4: Screen — Seção de medidas corporais em Evolução (`js/screens/evolucao.js`)

**Files:**
- Modify: `js/screens/evolucao.js`

**Interfaces:**
- Consumes: `getMedidas(db)`, `registrarMedida(db, {...})` from `../data/medidas.js` (Task 3); `prepararSerieTemporal(linhas, campo)` from `../engine/medidas.js` (Task 2).
- Modifies the existing `criarSvgLinha` function's expected point shape from `{data, carga1RM}` to generic `{data, valor}` — its only existing caller (`montarSecaoCarga`) is updated in the same task to map before calling it.

- [ ] **Step 1: Generalize `criarSvgLinha` to accept `{data, valor}` points**

In `js/screens/evolucao.js`, inside `criarSvgLinha`, replace every reference to `p.carga1RM` with `p.valor`:

```javascript
function criarSvgLinha(pontos) {
  const largura = 320;
  const altura = 140;
  const margem = 24;

  const valores = pontos.map((p) => p.valor);
  const minValor = Math.min(...valores);
  const maxValor = Math.max(...valores);
  const faixa = maxValor - minValor || 1;
  const folga = faixa * 0.1;
  const min = minValor - folga;
  const max = maxValor + folga;

  const escalaX = (i) => margem + (i / Math.max(pontos.length - 1, 1)) * (largura - margem * 2);
  const escalaY = (valor) => altura - margem - ((valor - min) / (max - min)) * (altura - margem * 2);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura + 20}`);
  svg.setAttribute("width", "100%");
  svg.style.display = "block";

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute(
    "points",
    pontos.map((p, i) => `${escalaX(i)},${escalaY(p.valor)}`).join(" ")
  );
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "var(--accent)");
  polyline.setAttribute("stroke-width", "2");
  svg.appendChild(polyline);

  pontos.forEach((p, i) => {
    const circulo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circulo.setAttribute("cx", escalaX(i));
    circulo.setAttribute("cy", escalaY(p.valor));
    circulo.setAttribute("r", "3");
    circulo.setAttribute("fill", "var(--accent)");
    svg.appendChild(circulo);
  });

  const passoRotulo = Math.max(1, Math.ceil(pontos.length / 6));
  pontos.forEach((p, i) => {
    if (i % passoRotulo !== 0 && i !== pontos.length - 1) return;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", escalaX(i));
    label.setAttribute("y", altura + 14);
    label.setAttribute("font-size", "9");
    label.setAttribute("fill", "var(--ink-faint)");
    label.setAttribute("text-anchor", "middle");
    label.textContent = formatarDataCurta(p.data);
    svg.appendChild(label);
  });

  return svg;
}
```

- [ ] **Step 2: Update `montarSecaoCarga`'s `desenhar` function to map before calling `criarSvgLinha`**

Find this block inside `montarSecaoCarga`:

```javascript
  const desenhar = (exercicioId) => {
    const seriesDoExercicio = todasAsSeries.filter((s) => s.exercicioId === exercicioId);
    const pontos = calcularProgressao1RM(seriesDoExercicio);
    container.innerHTML = "";
    if (pontos.length === 0) {
      container.innerHTML = `<p class="prev-hint">Sem dados suficientes para este exercício.</p>`;
      return;
    }
    container.appendChild(criarSvgLinha(pontos));
  };
```

Replace the last line with a mapping step:

```javascript
  const desenhar = (exercicioId) => {
    const seriesDoExercicio = todasAsSeries.filter((s) => s.exercicioId === exercicioId);
    const pontos = calcularProgressao1RM(seriesDoExercicio);
    container.innerHTML = "";
    if (pontos.length === 0) {
      container.innerHTML = `<p class="prev-hint">Sem dados suficientes para este exercício.</p>`;
      return;
    }
    container.appendChild(criarSvgLinha(pontos.map((p) => ({ data: p.data, valor: p.carga1RM }))));
  };
```

- [ ] **Step 3: Add the imports**

At the top of `js/screens/evolucao.js`, alongside the existing imports:

```javascript
import { getMedidas, registrarMedida } from "../data/medidas.js";
import { prepararSerieTemporal } from "../engine/medidas.js";
```

- [ ] **Step 4: Add the new section, called from `montarTelaEvolucao`**

In `montarTelaEvolucao`, after the existing `montarSecaoCarga(main, exercicios, todasAsSeries);` and `montarSecaoVolume(main, todasAsSeries);` calls, add a third:

```javascript
  const linhasMedidas = await getMedidas(db);
  montarSecaoMedidas(main, db, linhasMedidas);
```

(This means `montarTelaEvolucao`'s existing early return on `todasAsSeries.length === 0` must NOT skip this — body measurements are independent of training history. Move the `montarSecaoMedidas` call so it always runs, including in the empty-training-history case. Concretely: relocate the `if (todasAsSeries.length === 0) { ...; return root; }` early-return block so it only skips the two training-data sections, not the whole function. The full updated `montarTelaEvolucao` should read:)

```javascript
export async function montarTelaEvolucao(db) {
  const root = document.createElement("div");
  root.className = "tela-evolucao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Progressão</div><div class="day-title">Evolução</div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const [exercicios, todasAsSeries, linhasMedidas] = await Promise.all([
    getAll(db, "exercicios"),
    getAll(db, "historicoSeries"),
    getMedidas(db),
  ]);

  if (todasAsSeries.length === 0) {
    main.innerHTML = `<p class="vazio">Sem treinos registrados ainda.</p>`;
  } else {
    montarSecaoCarga(main, exercicios, todasAsSeries);
    montarSecaoVolume(main, todasAsSeries);
  }

  montarSecaoMedidas(main, db, linhasMedidas);

  return root;
}
```

- [ ] **Step 5: Add `montarSecaoMedidas`**

Add this new function anywhere alongside `montarSecaoCarga`/`montarSecaoVolume`:

```javascript
function montarSecaoMedidas(main, db, linhasIniciais) {
  let linhas = linhasIniciais;

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Medidas corporais</div></div>
    <form class="sets medidas-form" style="padding:0 18px 18px;">
      <div class="set-field">
        <label>Data</label>
        <input name="data" type="date" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
      </div>
      <div class="set-field">
        <label>Peso (kg)</label>
        <input name="peso_kg" type="number" step="0.1" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
      </div>
      <div class="set-field">
        <label>Cintura (cm)</label>
        <input name="cintura_cm" type="number" step="0.5" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
      </div>
      <div class="set-field">
        <label>% Gordura</label>
        <input name="percentualGordura" type="number" step="0.1" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
      </div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1;">Registrar</button>
      <div class="prev-hint medidas-status" style="grid-column:1/-1;"></div>
    </form>
    <div class="sets medidas-graficos" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:16px;"></div>
  `;
  main.appendChild(card);

  const form = card.querySelector(".medidas-form");
  form.querySelector('input[name="data"]').valueAsDate = new Date();
  const status = card.querySelector(".medidas-status");
  const graficosContainer = card.querySelector(".medidas-graficos");

  const METRICAS = [
    { campo: "peso_kg", titulo: "Peso (kg)" },
    { campo: "cintura_cm", titulo: "Cintura (cm)" },
    { campo: "percentualGordura", titulo: "% Gordura" },
  ];

  const desenharGraficos = () => {
    graficosContainer.innerHTML = "";
    for (const { campo, titulo } of METRICAS) {
      const pontos = prepararSerieTemporal(linhas, campo);
      if (pontos.length === 0) continue;
      const subCard = document.createElement("div");
      const rotulo = document.createElement("div");
      rotulo.className = "exercise-name";
      rotulo.style.fontSize = "0.85rem";
      rotulo.style.marginBottom = "6px";
      rotulo.textContent = titulo;
      subCard.appendChild(rotulo);
      subCard.appendChild(criarSvgLinha(pontos));
      graficosContainer.appendChild(subCard);
    }
  };
  desenharGraficos();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = form.querySelector('input[name="data"]').value;
    const peso_kg = form.querySelector('input[name="peso_kg"]').value;
    const cintura_cm = form.querySelector('input[name="cintura_cm"]').value;
    const percentualGordura = form.querySelector('input[name="percentualGordura"]').value;

    if (!data || (!peso_kg && !cintura_cm && !percentualGordura)) {
      status.textContent = "Preencha a data e ao menos uma medida.";
      return;
    }

    await registrarMedida(db, {
      data,
      peso_kg: peso_kg ? Number(peso_kg) : undefined,
      cintura_cm: cintura_cm ? Number(cintura_cm) : undefined,
      percentualGordura: percentualGordura ? Number(percentualGordura) : undefined,
    });

    linhas = await getMedidas(db);
    status.textContent = "Medida registrada.";
    form.querySelector('input[name="peso_kg"]').value = "";
    form.querySelector('input[name="cintura_cm"]').value = "";
    form.querySelector('input[name="percentualGordura"]').value = "";
    desenharGraficos();
  });
}
```

Note: `getAll` must already be imported in this file from Task 3 of the graphs plan (`import { getAll } from "../data/db.js";`) — it is, no new import needed for that.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 3 (this task adds no tests — screen modules aren't unit tested in this project, per established convention).

- [ ] **Step 7: Commit**

```bash
git add js/screens/evolucao.js
git commit -m "Add body-measurements section to Evolução: log form + 3 trend charts"
```

---

## Task 5: Backup/restore — Include `medidasCorporais`

**Files:**
- Modify: `js/data/exportImport.js:5`
- Modify: `js/data/exportImport.test.js`

**Interfaces:**
- No new exports — `medidasCorporais` becomes one more entry in the existing `STORES_EXPORTAVEIS` array, already consumed generically by `exportarTudo`/`importarTudo`.

- [ ] **Step 1: Write the failing test**

Append to `js/data/exportImport.test.js`:

```javascript
test("exportarTudo inclui medidasCorporais", async () => {
  const db = await openDatabase();
  await clearStore(db, "medidasCorporais");
  await put(db, "medidasCorporais", { data: "2026-08-20", peso_kg: 70 });

  const backup = await exportarTudo(db);
  assert.equal(backup.dados.medidasCorporais.length, 1);
  assert.equal(backup.dados.medidasCorporais[0].peso_kg, 70);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `backup.dados.medidasCorporais` is `undefined` (`.length` throws or the assertion fails).

- [ ] **Step 3: Write the implementation**

In `js/data/exportImport.js`, change:
```javascript
const STORES_EXPORTAVEIS = [
  "perfil", "protocolo", "exercicios", "dietaBase",
  "historicoSeries", "cargas", "registrosDiarios", "config",
];
```
to:
```javascript
const STORES_EXPORTAVEIS = [
  "perfil", "protocolo", "exercicios", "dietaBase",
  "historicoSeries", "medidasCorporais", "cargas", "registrosDiarios", "config",
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new test green, full suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/exportImport.js js/data/exportImport.test.js
git commit -m "Include medidasCorporais in backup export/import"
```

---

## Task 6: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 2 new files to `APP_SHELL`, bump the cache version**

Add these entries anywhere in the `APP_SHELL` array:
```javascript
  "./js/engine/medidas.js",
  "./js/data/medidas.js",
```
Change `const CACHE_NAME = "app-treino-shell-v5";` to `const CACHE_NAME = "app-treino-shell-v6";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 87 tests total (74 pre-existing + 2 new in Task 1 + 5 new in Task 2 + 5 new in Task 3 + 1 new in Task 5), all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add medidas corporais files to service worker cache list, bump to v6"
```

---

## Task 7: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the bootstrap and the seeded baseline point**

Open Evolução on a fresh/existing profile. Confirm the "Medidas corporais" section shows three mini charts (Peso, Cintura, % Gordura), each with exactly one point matching `data/perfil.json`'s seeded values (71 kg, 62 cm, 20%) dated 2026-08-19, if no measurement has been logged since.

- [ ] **Step 3: Verify registering a new measurement**

Fill in today's date, a new weight, and submit. Confirm the status message shows a confirmation, the Peso chart now shows 2 points, and the Cintura/% Gordura charts are unaffected (still 1 point each, since those fields were left blank).

- [ ] **Step 4: Verify the empty-form guard**

Submit the form with the date filled but all three measurement fields blank. Confirm the status message asks for at least one measurement and no new point is added (chart point counts unchanged).

- [ ] **Step 5: Verify backup/export includes the new data**

Use the existing "Exportar backup (JSON)" button in Config, confirm the downloaded/generated backup includes a `medidasCorporais` array with the points logged in Step 3.

- [ ] **Step 6: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (including the new Medidas corporais section) still loads and renders fully from cache.

- [ ] **Step 7: Report result to the user**

Show the working measurement log + trend charts. Note that session stats and calendar (the remaining two Nível 2b slices) are next.
