# Nível 3 (fatia 3) — Alertas de Recuperação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface `protocolo.json`'s reactive-deload/recovery-related conditions (joint/tendon pain, residual soreness, sustained low well-being, a streak of low-quality sessions) as alerts on the Divisão tab, computed purely from the check-in data collected in the prior slice.

**Architecture:** A new data helper `getCheckinsRecentes(db, limite)` in `js/data/checkin.js` reads the N most recent actual check-ins (records that have `qualidadePercebida` set, distinguishing real check-ins from any unrelated future feature's record on the same date). A new pure engine `js/engine/alertasRecuperacao.js` evaluates that list against the four documented rules and returns a list of alert objects. `js/screens/divisao.js` renders an "Alertas" card above the existing "Hoje" card when the list is non-empty, and renders nothing when it's empty.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-nivel3-alertas-recuperacao-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- No new runtime dependencies, no IndexedDB schema changes.
- Alerts are always informational only — never an automatic action (no auto-deload, no auto-volume-change). Consistent with the guarda-corpo "IA nunca decide séries, carga, RIR ou deload."
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead.
- Exact thresholds where `protocolo.json` doesn't give a number (documented rulings, both already made in the spec — do not re-derive or change them here): "sustentada" (bem-estar baixo) = 3 most-recent consecutive check-ins; "sequência" (qualidade percebida) = 2 most-recent consecutive check-ins.

---

## Task 1: Data — Check-ins recentes (`js/data/checkin.js`)

**Files:**
- Modify: `js/data/checkin.js`
- Modify: `js/data/checkin.test.js`

**Interfaces:**
- Produces: `getCheckinsRecentes(db, limite = 14) => Promise<Array>` — records from `registrosDiarios` that have `qualidadePercebida !== undefined` (real check-ins, not unrelated records some other feature may have written), sorted by `data` descending (most recent first), limited to `limite`.

- [ ] **Step 1: Write the failing tests**

Append to `js/data/checkin.test.js` (add `getCheckinsRecentes` to the existing import line from `./checkin.js`):

```javascript
test("getCheckinsRecentes retorna vazio quando não há check-ins", async () => {
  const db = await openDatabase();
  const resultado = await getCheckinsRecentes(db);
  assert.deepEqual(resultado, []);
  db.close();
});

test("getCheckinsRecentes ignora registros sem qualidadePercebida (de outras fatias)", async () => {
  const db = await openDatabase();
  await registrarCheckin(db, "2026-08-19", { caloriasConsumidas: 2100 }); // registro de outra fatia, não é check-in
  await registrarCheckin(db, "2026-08-20", { qualidadePercebida: 4, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false });

  const resultado = await getCheckinsRecentes(db);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].data, "2026-08-20");
  db.close();
});

test("getCheckinsRecentes ordena do mais recente pro mais antigo e respeita o limite", async () => {
  const db = await openDatabase();
  await registrarCheckin(db, "2026-08-18", { qualidadePercebida: 3, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false });
  await registrarCheckin(db, "2026-08-20", { qualidadePercebida: 5, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false });
  await registrarCheckin(db, "2026-08-19", { qualidadePercebida: 4, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false });

  const resultado = await getCheckinsRecentes(db, 2);
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].data, "2026-08-20");
  assert.equal(resultado[1].data, "2026-08-19");
  db.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `getCheckinsRecentes` is not exported yet.

- [ ] **Step 3: Write the implementation**

Change the top import line in `js/data/checkin.js` from:
```javascript
import { get, put } from "./db.js";
```
to:
```javascript
import { get, put, getAll } from "./db.js";
```

Add:
```javascript
export async function getCheckinsRecentes(db, limite = 14) {
  const todos = await getAll(db, "registrosDiarios");
  return todos
    .filter((r) => r.qualidadePercebida !== undefined)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, limite);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 3 new tests green, full existing suite (112 tests as of the prior plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/checkin.js js/data/checkin.test.js
git commit -m "Add getCheckinsRecentes to fetch actual check-ins, most recent first"
```

---

## Task 2: Engine — Alertas de recuperação (`js/engine/alertasRecuperacao.js`)

**Files:**
- Create: `js/engine/alertasRecuperacao.js`
- Test: `js/engine/alertasRecuperacao.test.js`

**Interfaces:**
- Produces: `avaliarAlertasRecuperacao(checkinsRecentes)` — takes an array of check-in records ordered most-recent-first (same shape `getCheckinsRecentes` returns) and returns an array of `{ tipo: string, mensagem: string, principio: string }`. Empty array when no condition fires.

- [ ] **Step 1: Write the failing tests**

Create `js/engine/alertasRecuperacao.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarAlertasRecuperacao } from "./alertasRecuperacao.js";

test("array vazio não gera nenhum alerta", () => {
  assert.deepEqual(avaliarAlertasRecuperacao([]), []);
});

test("dor articular/tendínea no check-in mais recente gera alerta", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 4, bemEstarBaixo: false, dorArticularOuTendinea: true, domsPersistente: false }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].tipo, "dor_articular");
});

test("DOMS persistente no check-in mais recente gera alerta", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 4, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: true }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].tipo, "doms_persistente");
});

test("bem-estar baixo em 3 check-ins consecutivos mais recentes gera alerta", () => {
  const base = { qualidadePercebida: 3, dorArticularOuTendinea: false, domsPersistente: false };
  const checkins = [
    { ...base, data: "2026-08-20", bemEstarBaixo: true },
    { ...base, data: "2026-08-19", bemEstarBaixo: true },
    { ...base, data: "2026-08-18", bemEstarBaixo: true },
  ];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(alertas.some((a) => a.tipo === "bem_estar_baixo_sustentado"));
});

test("bem-estar baixo em só 2 dos 3 mais recentes NÃO gera alerta de sustentado", () => {
  const base = { qualidadePercebida: 3, dorArticularOuTendinea: false, domsPersistente: false };
  const checkins = [
    { ...base, data: "2026-08-20", bemEstarBaixo: true },
    { ...base, data: "2026-08-19", bemEstarBaixo: false },
    { ...base, data: "2026-08-18", bemEstarBaixo: true },
  ];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(!alertas.some((a) => a.tipo === "bem_estar_baixo_sustentado"));
});

test("qualidade percebida <= 2 em 2 sessões consecutivas mais recentes gera alerta", () => {
  const base = { bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false };
  const checkins = [
    { ...base, data: "2026-08-20", qualidadePercebida: 2 },
    { ...base, data: "2026-08-19", qualidadePercebida: 1 },
  ];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(alertas.some((a) => a.tipo === "qualidade_baixa_sequencia"));
});

test("qualidade percebida <= 2 em só 1 sessão não gera alerta de sequência", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 2, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(!alertas.some((a) => a.tipo === "qualidade_baixa_sequencia"));
});

test("múltiplas condições simultâneas geram múltiplos alertas", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 3, bemEstarBaixo: false, dorArticularOuTendinea: true, domsPersistente: true }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.equal(alertas.length, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/engine/alertasRecuperacao.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/engine/alertasRecuperacao.js`:

```javascript
// js/engine/alertasRecuperacao.js
export function avaliarAlertasRecuperacao(checkinsRecentes) {
  const alertas = [];
  const maisRecente = checkinsRecentes[0];

  if (maisRecente?.dorArticularOuTendinea) {
    alertas.push({
      tipo: "dor_articular",
      mensagem: "Você reportou dor articular ou de tendão persistente no último check-in. Considere um deload ou avaliação profissional.",
      principio: "gatilhosDeloadReativo",
    });
  }

  if (maisRecente?.domsPersistente) {
    alertas.push({
      tipo: "doms_persistente",
      mensagem: "Dor muscular do treino anterior ainda presente. Pode ser sinal de recuperação insuficiente.",
      principio: "gatilhosDeloadReativo",
    });
  }

  const ultimosTres = checkinsRecentes.slice(0, 3);
  if (ultimosTres.length === 3 && ultimosTres.every((c) => c.bemEstarBaixo)) {
    alertas.push({
      tipo: "bem_estar_baixo_sustentado",
      mensagem: "Sono, motivação ou humor abaixo do ideal nos últimos 3 check-ins. Considere um deload reativo.",
      principio: "gatilhosDeloadReativo",
    });
  }

  const ultimosDois = checkinsRecentes.slice(0, 2);
  if (ultimosDois.length === 2 && ultimosDois.every((c) => c.qualidadePercebida <= 2)) {
    alertas.push({
      tipo: "qualidade_baixa_sequencia",
      mensagem: "As duas últimas sessões tiveram qualidade percebida baixa. Vale revisar sono, alimentação e volume de treino.",
      principio: "alertas",
    });
  }

  return alertas;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 8 new tests green, full existing suite (112 tests as of the prior plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/alertasRecuperacao.js js/engine/alertasRecuperacao.test.js
git commit -m "Add recovery-alerts engine (gatilhos de deload reativo from check-ins)"
```

---

## Task 3: Screen — Alertas card on Divisão (`js/screens/divisao.js`)

**Files:**
- Modify: `js/screens/divisao.js`

**Interfaces:**
- Consumes: `getCheckinsRecentes(db, limite)` from `../data/checkin.js` (Task 1); `avaliarAlertasRecuperacao(checkinsRecentes)` from `../engine/alertasRecuperacao.js` (Task 2).

- [ ] **Step 1: Add the imports**

Add two new import lines at the top of the file, alongside the existing ones:
```javascript
import { getCheckinsRecentes } from "../data/checkin.js";
import { avaliarAlertasRecuperacao } from "../engine/alertasRecuperacao.js";
```

- [ ] **Step 2: Fetch check-ins and compute alerts, render the card conditionally**

In `montarTelaDivisao`, change:
```javascript
  const [ultimaSerieGeral, todasAsSeries, seriesDeHoje] = await Promise.all([
    getUltimaSerieGeral(db),
    getAll(db, "historicoSeries"),
    getSeriesDoDia(db, hoje),
  ]);

  const grupoDeHoje = determinarGrupoDaSessao(seriesDeHoje, ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";

  main.appendChild(montarCardHoje(tituloGrupo));
  main.appendChild(montarCardHistorico(todasAsSeries));
```
to:
```javascript
  const [ultimaSerieGeral, todasAsSeries, seriesDeHoje, checkinsRecentes] = await Promise.all([
    getUltimaSerieGeral(db),
    getAll(db, "historicoSeries"),
    getSeriesDoDia(db, hoje),
    getCheckinsRecentes(db),
  ]);

  const grupoDeHoje = determinarGrupoDaSessao(seriesDeHoje, ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";
  const alertas = avaliarAlertasRecuperacao(checkinsRecentes);

  if (alertas.length > 0) {
    main.appendChild(montarCardAlertas(alertas));
  }
  main.appendChild(montarCardHoje(tituloGrupo));
  main.appendChild(montarCardHistorico(todasAsSeries));
```

- [ ] **Step 3: Add the alerts card function**

Add this function anywhere alongside `montarCardHoje`/`montarCardHistorico`:

```javascript
function montarCardAlertas(alertas) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Alertas</div></div>`;

  const lista = document.createElement("div");
  lista.className = "sets";
  lista.style.padding = "0 18px 18px";

  for (const alerta of alertas) {
    const linha = document.createElement("div");
    linha.className = "prev-hint";
    linha.textContent = `⚠️ ${alerta.mensagem}`;
    lista.appendChild(linha);
  }

  card.appendChild(lista);
  return card;
}
```

(`linha.textContent` is used — `alerta.mensagem` is always one of the fixed Portuguese templates from `alertasRecuperacao.js`, never DB-sourced, but `.textContent` costs nothing and needs no justification, matching how the rest of this file already treats every per-item dynamic string.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 2 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change).

- [ ] **Step 5: Commit**

```bash
git add js/screens/divisao.js
git commit -m "Show recovery alerts on Divisão when a gatilho de deload reativo fires"
```

---

## Task 4: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 1 new file to `APP_SHELL`, bump the cache version**

Add this entry anywhere in the `APP_SHELL` array:
```javascript
  "./js/engine/alertasRecuperacao.js",
```

Change `const CACHE_NAME = "app-treino-shell-v9";` to `const CACHE_NAME = "app-treino-shell-v10";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 123 tests total (112 pre-existing + 3 new in Task 1 + 8 new in Task 2), all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add alertasRecuperacao.js to service worker cache list, bump to v10"
```

---

## Task 5: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify no alerts by default**

Open the Divisão tab with the existing check-in history (from prior manual testing, a single "Qualidade: 4/5" check-in with no flags set). Confirm no "Alertas" card appears — only "Hoje" and "Sessões recentes" show, same as before this plan.

- [ ] **Step 3: Verify a triggered alert**

Go to Treino, click "Editar" on the check-in card, check "Alguma dor articular ou de tendão persistente?", save. Go to Divisão. Confirm an "Alertas" card now appears above "Hoje", showing the joint/tendon pain message.

- [ ] **Step 4: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (including the alerts card, showing the same triggered state) still loads and renders fully from cache.

- [ ] **Step 5: Report result to the user**

Show the working alerts card. Note this closes fatia 3 of Nível 3 (the check-in-driven half of gatilhos de deload reativo); the historicoSeries-driven half (desempenho caindo, RIR subindo sem carga) and the volume/programação alerts from `protocolo.json.alertas` remain for a future slice, along with registro de cardio (fatia 4 originally planned).
