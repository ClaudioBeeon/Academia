# Sequência Semanal de 5 Dias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the binary Superior/Inferior split with the user-provided 5-day named sequence (Peito+Tríceps / Costas+Bíceps / Peito+Ombro / Pernas / Peito+Tríceps), and make the "Treino de hoje" plan card fully clickable (not just its button).

**Architecture:** A new pure engine `js/engine/sequenciaSemanal.js` replaces `js/engine/divisao.js` (deleted). A new data module `js/data/sequenciaSemanal.js` replaces `js/data/grupoForcado.js` (deleted), storing the last-decided day number in the same `config` store under a new key. `js/screens/treino.js` and `js/screens/divisao.js` are rewired to use day numbers/titles instead of superior/inferior. `js/engine/cardio.js`'s `avaliarCardio` signature changes from `grupoDoDia` to `ehDiaDePernas`.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-sequencia-semanal-5dias-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- No new runtime dependencies, no IndexedDB schema changes (the `config` store already exists; this plan only changes which key it stores under).
- A custom exercise (Biblioteca, free-text `musculoPrimario`) whose muscle isn't in ANY of the 5 days' muscle lists must never be hidden from the session — same safety net as the old Superior/Inferior system, re-verified against the new 5-day muscle set.
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead.
- `protocolo.json` is not modified — peito's maintenance-volume status (`musculoEmManutencao`) is untouched; only session frequency/sequencing changes.

---

## Task 1: Engine — Sequência semanal (`js/engine/sequenciaSemanal.js`)

**Files:**
- Create: `js/engine/sequenciaSemanal.js`
- Test: `js/engine/sequenciaSemanal.test.js`

**Interfaces:**
- Produces: `DIAS_SEQUENCIA` — array of 5 `{ numero, titulo, musculos }` objects, in this exact order:
  1. `{ numero: 1, titulo: "Peito + Tríceps", musculos: ["peito", "triceps"] }`
  2. `{ numero: 2, titulo: "Costas + Bíceps", musculos: ["costas", "biceps"] }`
  3. `{ numero: 3, titulo: "Peito + Ombro", musculos: ["peito", "ombro"] }`
  4. `{ numero: 4, titulo: "Pernas", musculos: ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"] }`
  5. `{ numero: 5, titulo: "Peito + Tríceps", musculos: ["peito", "triceps"] }`
- Produces: `obterDiaPorNumero(numero)` — returns the matching object from `DIAS_SEQUENCIA`, or the day-1 object if `numero` doesn't match any (defensive fallback, never `undefined`).
- Produces: `obterMusculosDoDia(numero)` — shortcut for `obterDiaPorNumero(numero).musculos`.
- Produces: `proximoDia(numeroAtual)` — `(numeroAtual % 5) + 1` (wraps 5 → 1).
- Produces: `determinarDiaDaSessao(ultimoRegistro, hoje)` — `ultimoRegistro` is `{ dia, data } | null`. Returns `1` if `ultimoRegistro` is `null`. Returns `ultimoRegistro.dia` if `ultimoRegistro.data === hoje`. Otherwise returns `proximoDia(ultimoRegistro.dia)`.
- Produces: `obterDiaPeloMusculo(musculo)` — returns the FIRST object in `DIAS_SEQUENCIA` order whose `musculos` array includes `musculo`, or `null` if none does.

- [ ] **Step 1: Write the failing tests**

Create `js/engine/sequenciaSemanal.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_SEQUENCIA,
  obterDiaPorNumero,
  obterMusculosDoDia,
  proximoDia,
  determinarDiaDaSessao,
  obterDiaPeloMusculo,
} from "./sequenciaSemanal.js";

test("DIAS_SEQUENCIA tem 5 dias na ordem e composição corretas", () => {
  assert.equal(DIAS_SEQUENCIA.length, 5);
  assert.deepEqual(DIAS_SEQUENCIA[0].musculos, ["peito", "triceps"]);
  assert.deepEqual(DIAS_SEQUENCIA[1].musculos, ["costas", "biceps"]);
  assert.deepEqual(DIAS_SEQUENCIA[2].musculos, ["peito", "ombro"]);
  assert.deepEqual(DIAS_SEQUENCIA[3].musculos, ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"]);
  assert.deepEqual(DIAS_SEQUENCIA[4].musculos, ["peito", "triceps"]);
  assert.equal(DIAS_SEQUENCIA[0].titulo, "Peito + Tríceps");
  assert.equal(DIAS_SEQUENCIA[3].titulo, "Pernas");
});

test("obterDiaPorNumero retorna o dia certo, e cai no dia 1 pra número inválido", () => {
  assert.equal(obterDiaPorNumero(3).titulo, "Peito + Ombro");
  assert.equal(obterDiaPorNumero(99).numero, 1);
});

test("obterMusculosDoDia é atalho pra obterDiaPorNumero(numero).musculos", () => {
  assert.deepEqual(obterMusculosDoDia(4), ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"]);
});

test("proximoDia avança na sequência e volta pro 1 depois do 5", () => {
  assert.equal(proximoDia(1), 2);
  assert.equal(proximoDia(4), 5);
  assert.equal(proximoDia(5), 1);
});

test("determinarDiaDaSessao começa no dia 1 sem registro anterior", () => {
  assert.equal(determinarDiaDaSessao(null, "2026-08-21"), 1);
});

test("determinarDiaDaSessao mantém o dia já decidido hoje", () => {
  assert.equal(determinarDiaDaSessao({ dia: 3, data: "2026-08-21" }, "2026-08-21"), 3);
});

test("determinarDiaDaSessao avança pro próximo dia quando o registro é de outra data", () => {
  assert.equal(determinarDiaDaSessao({ dia: 3, data: "2026-08-20" }, "2026-08-21"), 4);
});

test("determinarDiaDaSessao avança do dia 5 pro dia 1 (fecha o ciclo)", () => {
  assert.equal(determinarDiaDaSessao({ dia: 5, data: "2026-08-20" }, "2026-08-21"), 1);
});

test("obterDiaPeloMusculo retorna o primeiro dia da sequência que contém o músculo", () => {
  assert.equal(obterDiaPeloMusculo("peito").numero, 1);
  assert.equal(obterDiaPeloMusculo("ombro").numero, 3);
  assert.equal(obterDiaPeloMusculo("quadriceps").numero, 4);
});

test("obterDiaPeloMusculo retorna null pra músculo não mapeado", () => {
  assert.equal(obterDiaPeloMusculo("core_customizado"), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/engine/sequenciaSemanal.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/engine/sequenciaSemanal.js`:

```javascript
// js/engine/sequenciaSemanal.js
//
// Sequência de 5 dias fornecida pelo usuário (sequenciasemanaltreino.md),
// substituindo a divisão binária Superior/Inferior. Peito aparece 3x por
// ciclo (frequência, não volume — protocolo.json continua controlando o
// volume-alvo via musculoEmManutencao/musculoPriorizadoCrescimento). Dias
// 1 e 5 são idênticos de propósito (mesmo par de músculos), por isso a
// rotação precisa de um número de dia explícito e persistido — não dá pra
// inferir "dia 1 ou dia 5" só olhando o músculo da última série.

export const DIAS_SEQUENCIA = [
  { numero: 1, titulo: "Peito + Tríceps", musculos: ["peito", "triceps"] },
  { numero: 2, titulo: "Costas + Bíceps", musculos: ["costas", "biceps"] },
  { numero: 3, titulo: "Peito + Ombro", musculos: ["peito", "ombro"] },
  { numero: 4, titulo: "Pernas", musculos: ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"] },
  { numero: 5, titulo: "Peito + Tríceps", musculos: ["peito", "triceps"] },
];

export function obterDiaPorNumero(numero) {
  return DIAS_SEQUENCIA.find((d) => d.numero === numero) ?? DIAS_SEQUENCIA[0];
}

export function obterMusculosDoDia(numero) {
  return obterDiaPorNumero(numero).musculos;
}

export function proximoDia(numeroAtual) {
  return (numeroAtual % DIAS_SEQUENCIA.length) + 1;
}

export function determinarDiaDaSessao(ultimoRegistro, hoje) {
  if (!ultimoRegistro) return 1;
  if (ultimoRegistro.data === hoje) return ultimoRegistro.dia;
  return proximoDia(ultimoRegistro.dia);
}

export function obterDiaPeloMusculo(musculo) {
  return DIAS_SEQUENCIA.find((d) => d.musculos.includes(musculo)) ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 10 new tests green, full existing suite (171 tests as of the prior plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/sequenciaSemanal.js js/engine/sequenciaSemanal.test.js
git commit -m "Add 5-day weekly-sequence engine (replaces Superior/Inferior)"
```

---

## Task 2: Data — Sequência semanal (`js/data/sequenciaSemanal.js`)

**Files:**
- Create: `js/data/sequenciaSemanal.js`
- Test: `js/data/sequenciaSemanal.test.js`

**Interfaces:**
- Produces: `getUltimoDiaRegistrado(db) => Promise<{ dia, data } | null>` — reads `config["sequenciaSemanal"]`.
- Produces: `registrarDiaDaSessao(db, dia, data) => Promise<void>` — writes `{ chave: "sequenciaSemanal", dia, data }` to the `config` store.

- [ ] **Step 1: Write the failing tests**

Create `js/data/sequenciaSemanal.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "./sequenciaSemanal.js";

test("getUltimoDiaRegistrado retorna null quando nada foi definido", async () => {
  const db = await openDatabase();
  const resultado = await getUltimoDiaRegistrado(db);
  assert.equal(resultado, null);
  db.close();
});

test("registrarDiaDaSessao grava e getUltimoDiaRegistrado lê de volta", async () => {
  const db = await openDatabase();
  await registrarDiaDaSessao(db, 3, "2026-08-21");
  const resultado = await getUltimoDiaRegistrado(db);
  assert.equal(resultado.dia, 3);
  assert.equal(resultado.data, "2026-08-21");
  db.close();
});

test("registrarDiaDaSessao sobrescreve o valor anterior", async () => {
  const db = await openDatabase();
  await registrarDiaDaSessao(db, 1, "2026-08-20");
  await registrarDiaDaSessao(db, 2, "2026-08-21");
  const resultado = await getUltimoDiaRegistrado(db);
  assert.equal(resultado.dia, 2);
  assert.equal(resultado.data, "2026-08-21");
  db.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/data/sequenciaSemanal.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/data/sequenciaSemanal.js`:

```javascript
import { get, put } from "./db.js";

export async function getUltimoDiaRegistrado(db) {
  const salvo = await get(db, "config", "sequenciaSemanal");
  return salvo ?? null;
}

export function registrarDiaDaSessao(db, dia, data) {
  return put(db, "config", { chave: "sequenciaSemanal", dia, data });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 3 new tests green, full existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/sequenciaSemanal.js js/data/sequenciaSemanal.test.js
git commit -m "Add data layer for the 5-day weekly-sequence state"
```

---

## Task 3: Engine — Cardio's day-check (`js/engine/cardio.js`)

**Files:**
- Modify: `js/engine/cardio.js`
- Modify: `js/engine/cardio.test.js`

**Interfaces:**
- Produces (changed): `avaliarCardio({ modalidade, ehDiaDePernas })` — same return shape as before (`{ tipo, mensagem, principio } | null`), but the second field is now a boolean instead of `"superior"`/`"inferior"`.

- [ ] **Step 1: Rewrite the tests for the new parameter**

Replace the full contents of `js/engine/cardio.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarCardio } from "./cardio.js";

test("corrida em dia de pernas retorna aviso de modalidade não recomendada", () => {
  const aviso = avaliarCardio({ modalidade: "corrida", ehDiaDePernas: true });
  assert.ok(aviso);
  assert.equal(aviso.tipo, "modalidade_nao_recomendada");
});

test("corrida fora de dia de pernas não gera aviso", () => {
  const aviso = avaliarCardio({ modalidade: "corrida", ehDiaDePernas: false });
  assert.equal(aviso, null);
});

test("bicicleta em dia de pernas não gera aviso", () => {
  const aviso = avaliarCardio({ modalidade: "bicicleta", ehDiaDePernas: true });
  assert.equal(aviso, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `avaliarCardio` still expects `grupoDoDia`, so `ehDiaDePernas: true` won't trigger the warning.

- [ ] **Step 3: Update the implementation**

Replace the full contents of `js/engine/cardio.js`:

```javascript
// js/engine/cardio.js
// Sem hora-do-dia registrada em historicoSeries (só data), não dá pra
// calcular regrasCardio.separacaoTemporalHoras (6h) com precisão — fora de
// escopo por falta de dado. Só verifica a modalidade a evitar em dia de
// foco em pernas.
export function avaliarCardio({ modalidade, ehDiaDePernas }) {
  if (modalidade === "corrida" && ehDiaDePernas) {
    return {
      tipo: "modalidade_nao_recomendada",
      mensagem: "Corrida pode interferir na recuperação de pernas hoje; bicicleta, elíptico ou escada são as opções preferidas.",
      principio: "regrasCardio",
    };
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 3 tests green, full existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/cardio.js js/engine/cardio.test.js
git commit -m "Change avaliarCardio's grupoDoDia to ehDiaDePernas (5-day sequence)"
```

---

## Task 4: Screen — Treino rewired to the 5-day sequence (`js/screens/treino.js`)

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `obterDiaPorNumero`, `obterMusculosDoDia`, `determinarDiaDaSessao`, `DIAS_SEQUENCIA` from `../engine/sequenciaSemanal.js` (Task 1); `getUltimoDiaRegistrado`, `registrarDiaDaSessao` from `../data/sequenciaSemanal.js` (Task 2).

- [ ] **Step 1: Replace the divisao/grupoForcado imports**

Change:
```javascript
import { getGrupoForcado, definirGrupoForcado } from "../data/grupoForcado.js";
```
to:
```javascript
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
```

Change:
```javascript
import { obterGrupoDoMusculo, determinarGrupoDaSessao } from "../engine/divisao.js";
```
to:
```javascript
import { DIAS_SEQUENCIA, obterDiaPorNumero, obterMusculosDoDia, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
```

- [ ] **Step 2: Replace the grupo computation with the day computation**

Change the `Promise.all` destructuring and the fetch call:
```javascript
  const [ultimaSerieGeral, seriesDeHoje, todasAsSeries, grupoForcado, cardioRecente] = await Promise.all([
    getUltimaSerieGeral(db),
    getSeriesDoDia(db, hoje),
    getAll(db, "historicoSeries"),
    getGrupoForcado(db, hoje),
    getCardioRecente(db, 1),
  ]);
```
to:
```javascript
  const [seriesDeHoje, todasAsSeries, ultimoDiaRegistrado, cardioRecente] = await Promise.all([
    getSeriesDoDia(db, hoje),
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getCardioRecente(db, 1),
  ]);
```

(`getUltimaSerieGeral` is no longer needed — the new day derivation only reads the persisted `{ dia, data }` record, not the raw series history. Remove it from the `historico.js` import line too, in Step 5 below.)

Replace:
```javascript
  const grupoDeHoje = grupoForcado ?? determinarGrupoDaSessao(seriesDeHoje, ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";
```
with:
```javascript
  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  if (!ultimoDiaRegistrado || ultimoDiaRegistrado.data !== hoje) {
    await registrarDiaDaSessao(db, diaDaSessao, hoje);
  }
  const diaInfo = obterDiaPorNumero(diaDaSessao);
```

(This persists the decided day the first time it's computed for a new date — same "decide once, stay stable all day" property the old `determinarGrupoDaSessao` had, but now via an explicit write instead of inference, because days 1 and 5 can't be told apart by muscle alone.)

- [ ] **Step 3: Update the exercise filter and rotation-offset calculation**

Change:
```javascript
  const exerciciosDoGrupo = todosExercicios.filter((e) => {
    const grupo = obterGrupoDoMusculo(e.musculoPrimario);
    return grupo === null || grupo === grupoDeHoje;
  });
  const sessoesAnterioresDoGrupo = new Set(
    todasAsSeries
      .filter((s) => s.data !== hoje && obterGrupoDoMusculo(s.musculo) === grupoDeHoje)
      .map((s) => s.data)
  ).size;
```
to:
```javascript
  const TODOS_MUSCULOS_MAPEADOS = new Set(DIAS_SEQUENCIA.flatMap((d) => d.musculos));
  const exerciciosDoGrupo = todosExercicios.filter((e) => {
    return diaInfo.musculos.includes(e.musculoPrimario) || !TODOS_MUSCULOS_MAPEADOS.has(e.musculoPrimario);
  });
  const sessoesAnterioresDoGrupo = new Set(
    todasAsSeries
      .filter((s) => s.data !== hoje && diaInfo.musculos.includes(s.musculo))
      .map((s) => s.data)
  ).size;
```

- [ ] **Step 4: Update every remaining use of `grupoDeHoje`/`tituloGrupo`**

Replace every remaining `tituloGrupo` reference in the function with `diaInfo.titulo`:

In the `planoCard.innerHTML` template, change `<h2>${tituloGrupo}</h2>` to `<h2>${diaInfo.titulo}</h2>`.

Replace the empty-state message:
```javascript
  if (exerciciosHoje.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = `Nenhum exercício de ${tituloGrupo.toLowerCase()} cadastrado ainda.`;
    main.appendChild(vazio);
  }
```
with:
```javascript
  if (exerciciosHoje.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = `Nenhum exercício de ${diaInfo.titulo} cadastrado ainda.`;
    main.appendChild(vazio);
  }
```

- [ ] **Step 5: Replace the manual-override link with a day picker, and make the whole card clickable**

Replace this whole block:
```javascript
  if (seriesDeHoje.length === 0) {
    const grupoOposto = grupoDeHoje === "superior" ? "inferior" : "superior";
    const tituloOposto = grupoOposto === "superior" ? "Superior" : "Inferior";
    const trocarBtn = document.createElement("button");
    trocarBtn.type = "button";
    trocarBtn.className = "trocar-grupo-link";
    trocarBtn.style.cssText = "background:none;border:none;color:var(--ink-2);text-decoration:underline;font-size:0.85rem;padding:8px 0 0;cursor:pointer;display:block;";
    trocarBtn.textContent = `Não é isso? Trocar para ${tituloOposto}`;
    trocarBtn.addEventListener("click", async () => {
      await definirGrupoForcado(db, hoje, grupoOposto);
      window.location.reload();
    });
    planoCard.insertBefore(trocarBtn, planoCard.querySelector("button"));
  }
```
with:
```javascript
  if (seriesDeHoje.length === 0) {
    const seletorDia = document.createElement("select");
    seletorDia.className = "trocar-dia-select";
    seletorDia.style.cssText = "background:var(--accent-ink); color:var(--accent); border:none; border-radius:8px; font-size:0.85rem; padding:6px 8px; margin-top:8px; cursor:pointer; font-family:inherit;";
    seletorDia.innerHTML = DIAS_SEQUENCIA.map((d) =>
      `<option value="${d.numero}">Dia ${d.numero}: ${d.titulo}</option>`
    ).join("");
    seletorDia.value = String(diaDaSessao);
    seletorDia.addEventListener("click", (event) => event.stopPropagation());
    seletorDia.addEventListener("change", async () => {
      await registrarDiaDaSessao(db, Number(seletorDia.value), hoje);
      window.location.reload();
    });
    planoCard.insertBefore(seletorDia, planoCard.querySelector("button"));
  }
```

(`event.stopPropagation()` on the `<select>`'s own click keeps the new whole-card click handler from Step 6 out of the way when the user is just opening the dropdown — otherwise every tap on the select would also trigger the "scroll to first exercise" behavior.)

- [ ] **Step 6: Make the whole plan card clickable**

Change:
```javascript
  planoCard.querySelector("button").addEventListener("click", () => {
    main.querySelector(".exercise-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
```
to:
```javascript
  planoCard.classList.add("clicavel");
  planoCard.addEventListener("click", () => {
    main.querySelector(".exercise-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
```

(This moves the listener from the inner button to the card itself — a click on the button still triggers it, since the click event bubbles up from the button to `planoCard`. No duplicate listener is needed on the button.)

- [ ] **Step 5b: Update the `historico.js` import line**

Since `getUltimaSerieGeral` is no longer used in this file (per Step 2's note), remove it from the top import line:
```javascript
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDoDia, getUltimaSerieGeral, getSeriesDaUltimaSessaoAnterior } from "../data/historico.js";
```
becomes:
```javascript
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDoDia, getSeriesDaUltimaSessaoAnterior } from "../data/historico.js";
```
(Do not remove `getUltimaSerieGeral` from `js/data/historico.js` itself — `js/screens/divisao.js`, modified in Task 5, still needs it for the "Sessões recentes" list, which is unrelated to day derivation.)

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 3 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change).

- [ ] **Step 8: Commit**

```bash
git add js/screens/treino.js
git commit -m "Rewire Treino to the 5-day sequence; make the plan card fully clickable"
```

---

## Task 5: Screen — Divisão rewired to the 5-day sequence (`js/screens/divisao.js`)

**Files:**
- Modify: `js/screens/divisao.js`

**Interfaces:**
- Consumes: `obterDiaPorNumero`, `obterDiaPeloMusculo`, `determinarDiaDaSessao` from `../engine/sequenciaSemanal.js` (Task 1); `getUltimoDiaRegistrado` from `../data/sequenciaSemanal.js` (Task 2); `avaliarCardio({ modalidade, ehDiaDePernas })` (Task 3's new signature).

- [ ] **Step 1: Replace the divisao/grupoForcado imports**

Change:
```javascript
import { obterGrupoDoMusculo, determinarGrupoDaSessao } from "../engine/divisao.js";
```
to:
```javascript
import { obterDiaPorNumero, obterDiaPeloMusculo, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
```

Change:
```javascript
import { getGrupoForcado } from "../data/grupoForcado.js";
```
to:
```javascript
import { getUltimoDiaRegistrado } from "../data/sequenciaSemanal.js";
```

- [ ] **Step 2: Replace the grupo computation with the day computation**

Change:
```javascript
  const [ultimaSerieGeral, todasAsSeries, seriesDeHoje, checkinsRecentes, sessoesPorExercicio, seriesUltimos7Dias, exercicios, cardioRecente, grupoForcado] = await Promise.all([
    getUltimaSerieGeral(db),
    getAll(db, "historicoSeries"),
    getSeriesDoDia(db, hoje),
    getCheckinsRecentes(db),
    getUltimasSessoesPorExercicio(db),
    getSeriesDesde(db, subtrairDias(hoje, 6)),
    getAll(db, "exercicios"),
    getCardioRecente(db),
    getGrupoForcado(db, hoje),
  ]);

  const grupoDeHoje = grupoForcado ?? determinarGrupoDaSessao(seriesDeHoje, ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";
```
to:
```javascript
  const [ultimaSerieGeral, todasAsSeries, seriesDeHoje, checkinsRecentes, sessoesPorExercicio, seriesUltimos7Dias, exercicios, cardioRecente, ultimoDiaRegistrado] = await Promise.all([
    getUltimaSerieGeral(db),
    getAll(db, "historicoSeries"),
    getSeriesDoDia(db, hoje),
    getCheckinsRecentes(db),
    getUltimasSessoesPorExercicio(db),
    getSeriesDesde(db, subtrairDias(hoje, 6)),
    getAll(db, "exercicios"),
    getCardioRecente(db),
    getUltimoDiaRegistrado(db),
  ]);

  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);
```

(`ultimaSerieGeral` stays in the fetch list — nothing else in this file used it for day derivation before, it's still fetched for consistency with the rest of the file's data shape and because removing it would require re-checking every other use site in this same `Promise.all`; if it turns out truly unused after this change, that's a one-line cleanup, not a correctness issue, and is NOT worth blocking this task on. Do not spend time hunting for other uses — leave the fetch in place.)

- [ ] **Step 3: Update `montarCardHoje` and its caller**

Change:
```javascript
  main.appendChild(montarCardHoje(tituloGrupo));
```
to:
```javascript
  main.appendChild(montarCardHoje(diaInfo));
```

Change:
```javascript
function montarCardHoje(tituloGrupo) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Hoje: ${tituloGrupo}</div></div>
    <div class="prev-hint" style="padding:0 18px 18px;">Rotação por sessão: o grupo alterna a cada treino registrado, não por dia fixo da semana.</div>
  `;
  return card;
}
```
to:
```javascript
function montarCardHoje(diaInfo) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Hoje: Dia ${diaInfo.numero} — ${diaInfo.titulo}</div></div>
    <div class="prev-hint" style="padding:0 18px 18px;">Rotação por sessão: o dia avança a cada treino registrado, não por dia fixo da semana.</div>
  `;
  return card;
}
```

(`diaInfo.titulo` is always one of the 5 fixed strings from `DIAS_SEQUENCIA`, never DB-sourced or user-editable, so interpolating it into `innerHTML` here is safe, matching how the project already treats other engine-produced fixed strings.)

- [ ] **Step 4: Update the cardio card's call to `avaliarCardio`**

Change:
```javascript
  main.appendChild(montarCardCardio(db, hoje, grupoDeHoje, cardioRecente));
```
to:
```javascript
  main.appendChild(montarCardCardio(db, hoje, diaInfo, cardioRecente));
```

Change the `montarCardCardio` and `renderizarCardio` function signatures and the `avaliarCardio` call inside:
```javascript
function montarCardCardio(db, hoje, grupoDeHoje, cardioRecente) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Cardio</div></div>`;

  const corpo = document.createElement("div");
  card.appendChild(corpo);
  renderizarCardio(corpo, db, hoje, grupoDeHoje, cardioRecente, null);

  return card;
}

function renderizarCardio(corpo, db, hoje, grupoDeHoje, cardioRecente, avisoRecente) {
```
to:
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

Inside `renderizarCardio`'s submit handler, change:
```javascript
    await registrarCardio(db, { data: hoje, modalidade, duracaoMinutos, intensidadePercebida });

    const avisoCardio = avaliarCardio({ modalidade, grupoDoDia: grupoDeHoje });
    const atualizado = await getCardioRecente(db);
    renderizarCardio(corpo, db, hoje, grupoDeHoje, atualizado, avisoCardio);
```
to:
```javascript
    await registrarCardio(db, { data: hoje, modalidade, duracaoMinutos, intensidadePercebida });

    const avisoCardio = avaliarCardio({ modalidade, ehDiaDePernas: diaInfo.musculos.includes("quadriceps") });
    const atualizado = await getCardioRecente(db);
    renderizarCardio(corpo, db, hoje, diaInfo, atualizado, avisoCardio);
```

- [ ] **Step 5: Update the history card's group labeling**

Change:
```javascript
    for (const data of datasOrdenadas) {
      const grupo = obterGrupoDoMusculo(musculoPorData.get(data));
      const rotulo = grupo === "superior" ? "Superior" : grupo === "inferior" ? "Inferior" : "Grupo não identificado";
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.textContent = `${data} — ${rotulo}`;
      lista.appendChild(linha);
    }
```
to:
```javascript
    for (const data of datasOrdenadas) {
      const diaEncontrado = obterDiaPeloMusculo(musculoPorData.get(data));
      const rotulo = diaEncontrado ? diaEncontrado.titulo : "Dia não identificado";
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.textContent = `${data} — ${rotulo}`;
      lista.appendChild(linha);
    }
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 3 (this task adds no new tests — screens aren't unit tested in this project).

- [ ] **Step 7: Commit**

```bash
git add js/screens/divisao.js
git commit -m "Rewire Divisão to the 5-day sequence"
```

---

## Task 6: Cleanup — Delete the old Superior/Inferior system, update service worker

**Files:**
- Delete: `js/engine/divisao.js`
- Delete: `js/engine/divisao.test.js`
- Delete: `js/data/grupoForcado.js`
- Delete: `js/data/grupoForcado.test.js`
- Modify: `sw.js`

- [ ] **Step 1: Confirm nothing else imports the files being deleted**

Run (from the repo root): search the `js/` directory for any remaining import of `engine/divisao.js` or `data/grupoForcado.js`. Expected: no matches, since Task 4 and Task 5 already removed the only two importers (`js/screens/treino.js` and `js/screens/divisao.js`).

- [ ] **Step 2: Delete the four files**

```bash
git rm js/engine/divisao.js js/engine/divisao.test.js js/data/grupoForcado.js js/data/grupoForcado.test.js
```

- [ ] **Step 3: Update `sw.js`'s `APP_SHELL`**

Remove these two lines from the `APP_SHELL` array:
```javascript
  "./js/engine/divisao.js",
```
```javascript
  "./js/data/grupoForcado.js",
```

Add these two lines anywhere in the array:
```javascript
  "./js/engine/sequenciaSemanal.js",
```
```javascript
  "./js/data/sequenciaSemanal.js",
```

Bump the cache version: change `const CACHE_NAME = "app-treino-shell-v15";` to `const CACHE_NAME = "app-treino-shell-v16";`.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — 184 tests total (171 pre-existing + 10 new in Task 1 + 3 new in Task 2, cardio.test.js's 3 tests replaced not added — net +13), all green. (If the exact number differs slightly from a miscount here, the important thing is: no failures, and the count reflects deletions of the 2 old divisao.js tests plus the additions, not a net negative surprise.)

- [ ] **Step 5: Commit**

```bash
git add sw.js
git commit -m "Delete Superior/Inferior system, update service worker cache list to v16"
```

---

## Task 7: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the day sequence on Treino**

Reload the app. Confirm the "Treino de hoje" card shows one of the 5 day titles (not "Superior"/"Inferior"), with the corresponding muscle-appropriate exercises listed below.

- [ ] **Step 3: Verify the whole card is clickable**

Click anywhere on the "Treino de hoje" card body (not just the "Começar treino" button) — confirm it scrolls to the first exercise card. Click the day-picker `<select>` (visible since no sets are logged yet today) — confirm it does NOT also trigger the scroll (the `stopPropagation` from Task 4 Step 5).

- [ ] **Step 4: Verify the day picker and persistence**

Change the day picker to a different day. Confirm the page reloads and now shows that day's title and exercises. Log a set. Reload the page again — confirm the SAME day still shows (doesn't advance mid-day). Simulate a new day by using the browser console to clear today's `historicoSeries` records and change the persisted `sequenciaSemanal` date to yesterday, then reload — confirm the day advances by exactly one step (wrapping from 5 to 1 if applicable).

- [ ] **Step 5: Verify Divisão**

Open the Divisão tab. Confirm "Hoje: Dia N — Título" matches Treino's card. Confirm "Sessões recentes" shows day titles (not "Superior"/"Inferior"/"Grupo não identificado" — unless a genuinely unmapped custom exercise is the only thing logged on some date). Log a cardio "Corrida" entry on the day-4 (Pernas) day — confirm the "modalidade não recomendada" warning appears; log it on any other day — confirm no warning.

- [ ] **Step 6: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app still loads and renders fully from cache with the new day-sequence system working.

- [ ] **Step 7: Report result to the user**

Show the working 5-day sequence and the clickable plan card.
