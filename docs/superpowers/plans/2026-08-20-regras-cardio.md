# Regras de Cardio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `avaliarCardio` to cover the user-provided cardio rules that are actually checkable from existing data: any moderate/intense cardio (not just running) on leg day, and exceeding 4 intense/moderate cardio sessions in the trailing 7 days — plus record whether each cardio session happened on a training day, for future use.

**Architecture:** `js/engine/cardio.js`'s `avaliarCardio` changes from returning `object | null` to returning an array of 0+ alert objects, adding two new checkable conditions. A new data helper `getCardioDesde(db, dataCorte)` in `js/data/cardio.js` mirrors the existing `getSeriesDesde` pattern. `js/screens/divisao.js` computes the trailing-7-day intense-cardio count, passes it into `avaliarCardio`, records `mesmoDiaDeTreino` automatically (from data already fetched, never asked of the user), and renders a list of alerts instead of a single conditional one.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-regras-cardio-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- No new runtime dependencies, no IndexedDB schema changes (`mesmoDiaDeTreino` is just a new field on the existing `registrosCardio` records, no new store/index).
- Never phrase any cardio guidance as "compensating" for diet, and never claim localized fat loss — already confirmed clean via audit; do not introduce new copy that violates this.
- `mesmoDiaDeTreino` is always computed by the app from data it already has (`seriesDeHoje.length > 0`), never a form field the user fills in.
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead.

---

## Task 1: Engine — Expand `avaliarCardio` (`js/engine/cardio.js`)

**Files:**
- Modify: `js/engine/cardio.js`
- Modify: `js/engine/cardio.test.js`

**Interfaces:**
- Produces (changed): `avaliarCardio({ modalidade, intensidadePercebida, ehDiaDePernas, cardiosIntensosUltimos7Dias }) => Array<{ tipo, mensagem, principio }>`. Returns `[]` when nothing fires — never `null`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `js/engine/cardio.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarCardio } from "./cardio.js";

test("nenhum alerta quando tudo está dentro dos limites", () => {
  const alertas = avaliarCardio({ modalidade: "caminhada", intensidadePercebida: 1, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 1 });
  assert.deepEqual(alertas, []);
});

test("corrida em dia de pernas sempre alerta, mesmo com intensidade baixa", () => {
  const alertas = avaliarCardio({ modalidade: "corrida", intensidadePercebida: 1, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(alertas.some((a) => a.tipo === "modalidade_nao_recomendada"));
});

test("corrida fora de dia de pernas não alerta por modalidade", () => {
  const alertas = avaliarCardio({ modalidade: "corrida", intensidadePercebida: 1, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(!alertas.some((a) => a.tipo === "modalidade_nao_recomendada"));
});

test("bicicleta intensa (>=3) em dia de pernas alerta por intensidade", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 3, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(alertas.some((a) => a.tipo === "intenso_dia_pernas"));
});

test("bicicleta leve (<3) em dia de pernas não alerta por intensidade", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 2, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(!alertas.some((a) => a.tipo === "intenso_dia_pernas"));
});

test("4 ou mais sessões intensas em 7 dias alerta por frequência", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 3, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 4 });
  assert.ok(alertas.some((a) => a.tipo === "frequencia_alta"));
});

test("3 sessões intensas em 7 dias não alerta por frequência", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 3, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 3 });
  assert.ok(!alertas.some((a) => a.tipo === "frequencia_alta"));
});

test("múltiplos alertas podem disparar juntos", () => {
  const alertas = avaliarCardio({ modalidade: "corrida", intensidadePercebida: 4, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 5 });
  assert.equal(alertas.length, 2);
  assert.ok(alertas.some((a) => a.tipo === "modalidade_nao_recomendada"));
  assert.ok(alertas.some((a) => a.tipo === "frequencia_alta"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `avaliarCardio` still returns a single object/null and doesn't accept `intensidadePercebida`/`cardiosIntensosUltimos7Dias`.

- [ ] **Step 3: Write the implementation**

Replace the full contents of `js/engine/cardio.js`:

```javascript
// js/engine/cardio.js
// Sem hora-do-dia registrada em historicoSeries (só data), não dá pra
// calcular regrasCardio.separacaoTemporalHoras (6h) nem a ordem
// musculação-antes-de-cardio com precisão — fora de escopo por falta de
// dado. Cobre: modalidade a evitar em dia de pernas (corrida, sempre —
// dano por impacto independe da intensidade percebida), qualquer
// modalidade moderada/intensa (>=3) em dia de pernas, e frequência
// semanal de cardio moderado/intenso acima da faixa recomendada (3-4x).
export function avaliarCardio({ modalidade, intensidadePercebida, ehDiaDePernas, cardiosIntensosUltimos7Dias }) {
  const alertas = [];

  if (modalidade === "corrida" && ehDiaDePernas) {
    alertas.push({
      tipo: "modalidade_nao_recomendada",
      mensagem: "Corrida pode interferir na recuperação de pernas hoje; bicicleta, elíptico ou escada são as opções preferidas.",
      principio: "regrasCardio",
    });
  } else if (intensidadePercebida >= 3 && ehDiaDePernas) {
    alertas.push({
      tipo: "intenso_dia_pernas",
      mensagem: "Cardio moderado ou intenso no dia de pernas pode competir pela recuperação do único dia de treino desse grupo na semana — considere reduzir a intensidade hoje.",
      principio: "regrasCardio",
    });
  }

  if (cardiosIntensosUltimos7Dias >= 4) {
    alertas.push({
      tipo: "frequencia_alta",
      mensagem: "Você já tem 4 ou mais sessões de cardio moderado/intenso nos últimos 7 dias — a faixa recomendada é 3-4x por semana.",
      principio: "regrasCardio",
    });
  }

  return alertas;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 8 tests green, full existing suite (171 tests as of the prior plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/cardio.js js/engine/cardio.test.js
git commit -m "Expand avaliarCardio: any intense cardio on leg day, weekly frequency cap"
```

---

## Task 2: Data — Cardio desde uma data (`js/data/cardio.js`)

**Files:**
- Modify: `js/data/cardio.js`
- Test: `js/data/cardio.test.js` (new file — this data module has no test file yet)

**Interfaces:**
- Produces: `getCardioDesde(db, dataCorte) => Promise<Array>` — all `registrosCardio` records with `data >= dataCorte`, mirroring `getSeriesDesde` in `js/data/historico.js`.

- [ ] **Step 1: Write the failing tests**

Create `js/data/cardio.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { registrarCardio, getCardioDesde } from "./cardio.js";

test("getCardioDesde retorna vazio quando não há registros", async () => {
  const db = await openDatabase();
  const resultado = await getCardioDesde(db, "2026-08-14");
  assert.deepEqual(resultado, []);
  db.close();
});

test("getCardioDesde retorna só registros na data de corte ou depois", async () => {
  const db = await openDatabase();
  await registrarCardio(db, { data: "2026-08-10", modalidade: "bicicleta", duracaoMinutos: 30, intensidadePercebida: 2 });
  await registrarCardio(db, { data: "2026-08-15", modalidade: "corrida", duracaoMinutos: 25, intensidadePercebida: 4 });
  await registrarCardio(db, { data: "2026-08-20", modalidade: "elíptico", duracaoMinutos: 20, intensidadePercebida: 3 });

  const resultado = await getCardioDesde(db, "2026-08-14");
  assert.equal(resultado.length, 2);
  assert.ok(resultado.every((r) => r.data >= "2026-08-14"));
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `getCardioDesde` is not exported yet.

- [ ] **Step 3: Write the implementation**

In `js/data/cardio.js`, add:

```javascript
export async function getCardioDesde(db, dataCorte) {
  const todos = await getAll(db, "registrosCardio");
  return todos.filter((r) => r.data >= dataCorte);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 2 new tests green, full existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/cardio.js js/data/cardio.test.js
git commit -m "Add getCardioDesde to fetch cardio records from a cutoff date"
```

---

## Task 3: Screen — Wire the expanded rules into Divisão (`js/screens/divisao.js`)

**Files:**
- Modify: `js/screens/divisao.js`

**Interfaces:**
- Consumes: `getCardioDesde(db, dataCorte)` from `../data/cardio.js` (Task 2); `avaliarCardio({ modalidade, intensidadePercebida, ehDiaDePernas, cardiosIntensosUltimos7Dias })` (Task 1's new signature).

- [ ] **Step 1: Add the import and a date-math helper**

Add `getCardioDesde` to the existing import line from `../data/cardio.js`:
```javascript
import { registrarCardio, getCardioRecente, getCardioDesde } from "../data/cardio.js";
```

(`subtrairDias` already exists in this file for the volume-alerts 7-day window — reuse it, don't add a second copy.)

- [ ] **Step 2: Update `renderizarCardio`'s submit handler**

Find the submit handler inside `renderizarCardio`:
```javascript
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const modalidade = form.modalidade.value;
    const duracaoMinutos = Number(form.duracaoMinutos.value) || undefined;
    const intensidadePercebida = Number(form.intensidadePercebida.value);

    await registrarCardio(db, { data: hoje, modalidade, duracaoMinutos, intensidadePercebida });

    const avisoCardio = avaliarCardio({ modalidade, ehDiaDePernas: diaInfo.musculos.includes("quadriceps") });
    const atualizado = await getCardioRecente(db);
    renderizarCardio(corpo, db, hoje, diaInfo, atualizado, avisoCardio);
  });
```

Replace it with (this needs `renderizarCardio`'s own signature to also receive `seriesDeHoje`, and `avisoRecente` to become `avisosRecentes`, an array — see Step 3):
```javascript
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const modalidade = form.modalidade.value;
    const duracaoMinutos = Number(form.duracaoMinutos.value) || undefined;
    const intensidadePercebida = Number(form.intensidadePercebida.value);
    const mesmoDiaDeTreino = seriesDeHoje.length > 0;

    await registrarCardio(db, { data: hoje, modalidade, duracaoMinutos, intensidadePercebida, mesmoDiaDeTreino });

    const seteDiasAtras = subtrairDias(hoje, 6);
    const cardiosRecentes = await getCardioDesde(db, seteDiasAtras);
    const cardiosIntensosUltimos7Dias = cardiosRecentes.filter((r) => r.intensidadePercebida >= 3).length;

    const avisosCardio = avaliarCardio({
      modalidade,
      intensidadePercebida,
      ehDiaDePernas: diaInfo.musculos.includes("quadriceps"),
      cardiosIntensosUltimos7Dias,
    });
    const atualizado = await getCardioRecente(db);
    renderizarCardio(corpo, db, hoje, diaInfo, atualizado, avisosCardio, seriesDeHoje);
  });
```

- [ ] **Step 3: Update `renderizarCardio` and `montarCardCardio` signatures for the array of alerts and `seriesDeHoje`**

Change:
```javascript
function montarCardCardio(db, hoje, diaInfo, cardioRecente) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Cardio</div></div>`;

  const corpo = document.createElement("div");
  card.appendChild(corpo);
  renderizarCardio(corpo, db, hoje, diaInfo, cardioRecente, null);

  return card;
}

function renderizarCardio(corpo, db, hoje, diaInfo, cardioRecente, avisoRecente) {
```
to:
```javascript
function montarCardCardio(db, hoje, diaInfo, cardioRecente, seriesDeHoje) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Cardio</div></div>`;

  const corpo = document.createElement("div");
  card.appendChild(corpo);
  renderizarCardio(corpo, db, hoje, diaInfo, cardioRecente, [], seriesDeHoje);

  return card;
}

function renderizarCardio(corpo, db, hoje, diaInfo, cardioRecente, avisosRecentes, seriesDeHoje) {
```

Find where `montarCardCardio` is called in `montarTelaDivisao`:
```javascript
  main.appendChild(montarCardCardio(db, hoje, diaInfo, cardioRecente));
```
change to:
```javascript
  main.appendChild(montarCardCardio(db, hoje, diaInfo, cardioRecente, seriesDeHoje));
```

- [ ] **Step 4: Render a list of alerts instead of one**

Find this block inside `renderizarCardio`:
```javascript
  if (avisoRecente) {
    const aviso = document.createElement("div");
    aviso.className = "prev-hint";
    aviso.style.padding = "0 18px 18px";
    aviso.textContent = `⚠️ ${avisoRecente.mensagem}`;
    corpo.appendChild(aviso);
  }
```
replace with:
```javascript
  for (const aviso of avisosRecentes) {
    const linhaAviso = document.createElement("div");
    linhaAviso.className = "prev-hint";
    linhaAviso.style.padding = "0 18px 18px";
    linhaAviso.textContent = `⚠️ ${aviso.mensagem}`;
    corpo.appendChild(linhaAviso);
  }
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 2 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change).

- [ ] **Step 6: Commit**

```bash
git add js/screens/divisao.js
git commit -m "Wire expanded cardio rules and mesmoDiaDeTreino into Divisão"
```

---

## Task 4: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the new leg-day intensity alert**

On the day-4 (Pernas) session, register a bicicleta cardio session with intensidade 3 or higher. Confirm the "⚠️ Cardio moderado ou intenso no dia de pernas..." alert appears (not the running-specific one, since modalidade isn't corrida). Register one with intensidade 1-2 instead — confirm no alert for that reason.

- [ ] **Step 3: Verify the weekly-frequency alert**

Register 4 cardio sessions with intensidade >= 3 within the same browser session (any modalidade/day). Confirm the "⚠️ Você já tem 4 ou mais sessões..." alert appears on the 4th one. Confirm multiple alerts can show together (e.g., the 4th intense session also happens to be on leg day).

- [ ] **Step 4: Verify `mesmoDiaDeTreino` is recorded**

After registering a cardio session on a day where a set was already logged, inspect IndexedDB (`registrosCardio` store) directly and confirm the record has `mesmoDiaDeTreino: true`. Register one on a day with no sets logged yet — confirm `mesmoDiaDeTreino: false`.

- [ ] **Step 5: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app still loads and renders fully from cache with the cardio card working.

- [ ] **Step 6: Report result to the user**

Show the expanded cardio alerts working.
