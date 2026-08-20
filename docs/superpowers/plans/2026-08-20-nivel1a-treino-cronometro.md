# Nível 1a — Registro de Treino + Cronômetro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core session-logging loop — the most critical screen in the app per the spec — with the rest timer, instant exercise substitution, and load suggestion engine, replacing the placeholder "Treino" tab with a real, working screen. Exercise library management, per-exercise history browsing, and JSON/CSV export/import are explicitly out of scope for this plan (they become "Nível 1b"). The automatic weekly-split builder is also out of scope — this plan reads today's exercises via a simple filter (peito, the user's priority muscle) as a stand-in; the real weekly-split algorithm is future work.

**Architecture:** Two new pure engine modules (`cargas.js`, `substituicao.js`) extend `/js/engine/`. A new pure countdown module (`timer.js`) separates timer logic from `setInterval`/Wake Lock side effects. A new data module (`historico.js`) wraps `db.js` with domain-specific queries. `treino.js` is the first real screen module — it owns DOM rendering and wires the pure/data modules together. Visual tokens are extracted from the approved `prototypes/3-abril.html` prototype into `css/tokens.css`.

**Tech Stack:** Same as the foundation — vanilla JS ES modules, no build step, `node --test` for engine/data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-19-app-treino-design.md` (visual direction: see the "Decisão tomada (2026-08-20)" note in §8, and `prototypes/3-abril.html`)

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`. (spec §5)
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`. (spec §7, established in the foundation plan)
- All engine functions return `{ ..., principio, secao }` provenance fields, matching the contract established in `progressao.js`/`volume.js`/`rir.js`. (foundation plan final-review fix)
- Visual tokens (`--paper`, `--card`, `--accent`, etc.) come from `css/tokens.css`, extracted from `prototypes/3-abril.html` — no ad-hoc colors in screen CSS.
- Séries do tipo `"aquecimento"` nunca contam no volume (already enforced by `volume.js`; `treino.js` must tag warm-up sets correctly when logging them).
- RIR-alvo padrão é 2 (protocolo.json `tiposDeExercicio`), nunca falha total em compostos.

---

## Task 1: Extract design tokens from the approved prototype

**Files:**
- Create: `css/tokens.css`
- Modify: `css/styles.css`
- Modify: `index.html`
- Test: none (static CSS; visually verified in Task 8)

**Interfaces:**
- Produces: CSS custom properties consumed by all screen CSS going forward — `--paper`, `--card`, `--card-2`, `--ink`, `--ink-dim`, `--ink-faint`, `--accent`, `--accent-ink`, `--line`, `--radius`.

- [ ] **Step 1: Write `css/tokens.css`** (values copied verbatim from `prototypes/3-abril.html`)

```css
:root {
  --paper: oklch(13% 0.012 145);
  --card: oklch(18% 0.014 145);
  --card-2: oklch(23% 0.016 145);
  --ink: oklch(97% 0.006 145);
  --ink-dim: oklch(72% 0.014 145);
  --ink-faint: oklch(50% 0.012 145);
  --accent: oklch(89% 0.21 128);
  --accent-ink: oklch(19% 0.05 128);
  --line: oklch(27% 0.016 145);
  --radius: 26px;
}
```

- [ ] **Step 2: Update `css/styles.css`** to use the tokens for the base page background/text, and add the shared tab-bar chrome (currently `index.html` has no styled `#tab-bar` — this task gives it the floating-pill treatment from the prototype)

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow-x: clip; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: "SF Pro Text", -apple-system, "Inter", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  padding-bottom: env(safe-area-inset-bottom);
  padding-top: env(safe-area-inset-top);
}

#tab-content {
  max-width: 430px;
  margin: 0 auto;
  padding: 0 22px 148px;
}

#tab-bar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 18px;
  width: calc(100% - 32px);
  max-width: 398px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 999px;
  display: flex;
  padding: 8px;
  box-shadow: 0 24px 50px -18px oklch(0% 0 0 / 0.7);
}
#tab-bar button {
  flex: 1;
  background: none;
  border: none;
  color: var(--ink-faint);
  font-size: 0.64rem;
  font-weight: 800;
  padding: 9px 4px;
  cursor: pointer;
  border-radius: 999px;
}
#tab-bar button.active {
  background: var(--accent);
  color: var(--accent-ink);
}
#tab-bar button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Treino screen component classes (consumed by js/screens/treino.js) */
.top { padding: 30px 0 0; }
.date-label { font-size: 0.8rem; font-weight: 700; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.06em; }
.day-title { font-size: 2.1rem; font-weight: 900; letter-spacing: -0.03em; margin-top: 6px; }
.vazio { color: var(--ink-faint); padding: 20px 0; }

main { padding: 18px 0 0; display: flex; flex-direction: column; gap: 12px; }

.exercise-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.exercise-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 14px; }
.exercise-name { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.015em; }
.exercise-meta { font-size: 0.78rem; color: var(--ink-faint); font-weight: 600; margin-top: 3px; }
.swap-pill { background: var(--card-2); border: 1px solid var(--line); color: var(--ink-dim); font-size: 0.74rem; font-weight: 700; padding: 7px 13px; border-radius: 999px; cursor: pointer; }
.swap-pill:hover { color: var(--accent); }
.swap-pill:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.sets { padding: 0 18px 18px; display: flex; flex-direction: column; gap: 8px; }
.set-row { display: grid; grid-template-columns: 40px 1fr 1fr 1fr; align-items: center; gap: 10px; padding: 8px; border-radius: 14px; }
.set-row.done { background: color-mix(in oklch, var(--accent) 12%, transparent); }
.set-ring { width: 34px; height: 34px; border-radius: 50%; background: var(--card-2); display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 800; color: var(--ink-faint); }
.set-row.done .set-ring { background: var(--accent); color: var(--accent-ink); }
.set-field label { font-size: 0.62rem; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; display: block; margin-bottom: 3px; }
.set-field input { background: var(--card-2); border: 1px solid var(--line); color: var(--ink); border-radius: 10px; padding: 8px 10px; font-size: 0.95rem; font-weight: 700; width: 100%; font-variant-numeric: tabular-nums; }
.set-field input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.set-field input:disabled { opacity: 0.7; }

.prev-hint { padding: 0 18px 16px; font-size: 0.78rem; color: var(--ink-faint); font-weight: 600; }
.prev-hint b { color: var(--ink); font-weight: 800; font-variant-numeric: tabular-nums; }

.rest-bar { display: flex; align-items: center; justify-content: space-between; background: var(--accent); color: var(--accent-ink); border-radius: var(--radius); padding: 16px 20px; box-shadow: 0 24px 48px -24px color-mix(in oklch, var(--accent) 55%, black); }
.rest-bar.rest-bar-hidden { opacity: 0.35; pointer-events: none; }
.rest-bar .label { font-size: 0.78rem; font-weight: 800; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.05em; }
.rest-bar .time { font-size: 1.9rem; font-weight: 900; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.rest-ctl { display: flex; gap: 8px; }
.rest-ctl button { background: color-mix(in oklch, var(--accent-ink) 15%, transparent); border: none; color: var(--accent-ink); border-radius: 999px; padding: 7px 12px; font-size: 0.78rem; font-weight: 800; cursor: pointer; }
.rest-ctl button:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 1px; }
```

- [ ] **Step 3: Update `index.html`** to link `css/tokens.css` before `css/styles.css`, and add `data-tab` labels matching the prototype's 5 tabs (already present from the foundation plan — verify, don't duplicate)

```html
<link rel="stylesheet" href="css/tokens.css" />
<link rel="stylesheet" href="css/styles.css" />
```

(Insert this line immediately before the existing `<link rel="stylesheet" href="css/styles.css" />` in `<head>`.)

- [ ] **Step 4: Commit**

```bash
git add css/tokens.css css/styles.css index.html
git commit -m "Extract design tokens from approved Abril prototype; style tab bar"
```

---

## Task 2: Engine — sugestão de carga (`js/engine/cargas.js`)

**Files:**
- Create: `js/engine/cargas.js`
- Test: `js/engine/cargas.test.js`

**Interfaces:**
- Produces: `sugerirCarga(amostras, rirAlvo): { cargaSugerida: number|null, confianca: "nenhuma"|"baixa"|"media"|"alta", principio: string, secao: string }`
  where `amostras` is an array of `{ carga: number, reps: number, rir_relatado: number }` for one exercise (oldest sample order doesn't matter).

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/cargas.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirCarga } from "./cargas.js";

test("sem amostras, não sugere carga (confiança nenhuma)", () => {
  const resultado = sugerirCarga([], 2);
  assert.equal(resultado.cargaSugerida, null);
  assert.equal(resultado.confianca, "nenhuma");
});

test("com uma amostra, ajusta pela distância entre o RIR relatado e o RIR-alvo", () => {
  const resultado = sugerirCarga([{ carga: 15, reps: 10, rir_relatado: 3 }], 2);
  assert.equal(resultado.cargaSugerida, 14.5);
  assert.equal(resultado.confianca, "baixa");
});

test("com duas amostras, sugere carga entre elas ajustada pelo RIR-alvo", () => {
  const resultado = sugerirCarga(
    [
      { carga: 14, reps: 10, rir_relatado: 4.5 },
      { carga: 16, reps: 8, rir_relatado: 0.5 },
    ],
    2
  );
  assert.ok(resultado.cargaSugerida > 14 && resultado.cargaSugerida < 16);
  assert.equal(resultado.confianca, "media");
});

test("com 4+ amostras, confiança é alta", () => {
  const resultado = sugerirCarga(
    [
      { carga: 14, reps: 10, rir_relatado: 4 },
      { carga: 15, reps: 10, rir_relatado: 3 },
      { carga: 16, reps: 9, rir_relatado: 1.5 },
      { carga: 16, reps: 8, rir_relatado: 1 },
    ],
    2
  );
  assert.equal(resultado.confianca, "alta");
});

test("todas as amostras com a mesma carga: sugere essa carga sem divisão por zero", () => {
  const resultado = sugerirCarga(
    [
      { carga: 15, reps: 10, rir_relatado: 2 },
      { carga: 15, reps: 9, rir_relatado: 1.5 },
    ],
    2
  );
  assert.equal(resultado.cargaSugerida, 15);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/cargas.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/cargas.js`**

```javascript
// js/engine/cargas.js
function arredondarMeioKg(carga) {
  return Math.round(carga * 2) / 2;
}

export function sugerirCarga(amostras, rirAlvo) {
  if (!amostras || amostras.length === 0) {
    return { cargaSugerida: null, confianca: "nenhuma", principio: "cargas", secao: "prompt-original" };
  }

  if (amostras.length === 1) {
    const amostra = amostras[0];
    const diffRir = rirAlvo - amostra.rir_relatado;
    const carga = amostra.carga * (1 + diffRir * 0.05);
    return {
      cargaSugerida: arredondarMeioKg(carga),
      confianca: "baixa",
      principio: "cargas",
      secao: "prompt-original",
    };
  }

  const n = amostras.length;
  const mediaCarga = amostras.reduce((soma, a) => soma + a.carga, 0) / n;
  const mediaRir = amostras.reduce((soma, a) => soma + a.rir_relatado, 0) / n;

  let numerador = 0;
  let denominador = 0;
  for (const a of amostras) {
    numerador += (a.carga - mediaCarga) * (a.rir_relatado - mediaRir);
    denominador += (a.carga - mediaCarga) ** 2;
  }

  const confianca = n >= 4 ? "alta" : "media";

  if (denominador === 0) {
    return { cargaSugerida: arredondarMeioKg(mediaCarga), confianca, principio: "cargas", secao: "prompt-original" };
  }

  const inclinacao = numerador / denominador;
  const intercepto = mediaRir - inclinacao * mediaCarga;
  const carga = (rirAlvo - intercepto) / inclinacao;

  return { cargaSugerida: arredondarMeioKg(carga), confianca, principio: "cargas", secao: "prompt-original" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/cargas.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/cargas.js js/engine/cargas.test.js
git commit -m "Add load suggestion engine (effort-load memory, prompt original spec)"
```

---

## Task 3: Engine — substituição instantânea (`js/engine/substituicao.js`)

**Files:**
- Create: `js/engine/substituicao.js`
- Test: `js/engine/substituicao.test.js`

**Interfaces:**
- Produces: `sugerirSubstitutos(exercicioAtualId, exercicios, limite = 3): Array<exercicio>`
  where `exercicios` is the array shape from `data/exercicios.json`'s `exercicios` field (each item has `id`, `musculoPrimario`, `tipo`, `nome`, ...). Returns up to `limite` exercises with the same `musculoPrimario` and `tipo`, excluding the current one, in array order.

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/substituicao.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirSubstitutos } from "./substituicao.js";

const exercicios = [
  { id: "supino_inclinado_halteres", musculoPrimario: "peito", tipo: "composto_moderado" },
  { id: "supino_reto_maquina", musculoPrimario: "peito", tipo: "maquina" },
  { id: "crucifixo_cabo_cross", musculoPrimario: "peito", tipo: "isolador" },
  { id: "rosca_direta_barra_w", musculoPrimario: "biceps", tipo: "isolador" },
  { id: "outro_isolador_peito", musculoPrimario: "peito", tipo: "isolador" },
];

test("retorna alternativas do mesmo músculo e tipo, excluindo o próprio exercício", () => {
  const resultado = sugerirSubstitutos("crucifixo_cabo_cross", exercicios);
  const ids = resultado.map((e) => e.id);
  assert.ok(!ids.includes("crucifixo_cabo_cross"));
  assert.ok(ids.includes("outro_isolador_peito"));
  assert.ok(!ids.includes("rosca_direta_barra_w"));
});

test("respeita o limite informado", () => {
  const resultado = sugerirSubstitutos("crucifixo_cabo_cross", exercicios, 1);
  assert.equal(resultado.length, 1);
});

test("exercício inexistente retorna lista vazia", () => {
  const resultado = sugerirSubstitutos("nao_existe", exercicios);
  assert.deepEqual(resultado, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/substituicao.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/substituicao.js`**

```javascript
// js/engine/substituicao.js
export function sugerirSubstitutos(exercicioAtualId, exercicios, limite = 3) {
  const atual = exercicios.find((e) => e.id === exercicioAtualId);
  if (!atual) return [];

  return exercicios
    .filter(
      (e) =>
        e.id !== atual.id &&
        e.musculoPrimario === atual.musculoPrimario &&
        e.tipo === atual.tipo
    )
    .slice(0, limite);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/substituicao.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/substituicao.js js/engine/substituicao.test.js
git commit -m "Add instant exercise substitution (no AI required, spec section 7)"
```

---

## Task 4: Cronômetro puro (`js/screens/timer.js`)

**Files:**
- Create: `js/screens/timer.js`
- Test: `js/screens/timer.test.js`

**Interfaces:**
- Produces: `criarCronometro({ duracaoInicialSegundos, aoAtualizar, aoFinalizar }): { iniciar(setIntervalImpl?), parar(clearIntervalImpl?), ajustar(deltaSegundos), tick(), obterRestante() }`
  `tick()` is exposed specifically so it's testable without real timers — `iniciar()` just wires it to `setInterval`.

- [ ] **Step 1: Write the failing test**

```javascript
// js/screens/timer.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarCronometro } from "./timer.js";

test("tick decrementa o restante e chama aoAtualizar", () => {
  const atualizacoes = [];
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 5,
    aoAtualizar: (restante) => atualizacoes.push(restante),
    aoFinalizar: () => {},
  });
  cronometro.tick();
  assert.equal(cronometro.obterRestante(), 4);
  assert.deepEqual(atualizacoes, [4]);
});

test("chama aoFinalizar quando chega a zero", () => {
  let finalizou = false;
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 1,
    aoAtualizar: () => {},
    aoFinalizar: () => { finalizou = true; },
  });
  cronometro.tick();
  assert.equal(cronometro.obterRestante(), 0);
  assert.equal(finalizou, true);
});

test("ajustar soma segundos e nunca deixa negativo", () => {
  const atualizacoes = [];
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 10,
    aoAtualizar: (restante) => atualizacoes.push(restante),
    aoFinalizar: () => {},
  });
  cronometro.ajustar(30);
  assert.equal(cronometro.obterRestante(), 40);
  cronometro.ajustar(-100);
  assert.equal(cronometro.obterRestante(), 0);
  assert.deepEqual(atualizacoes, [40, 0]);
});

test("iniciar usa a implementação de setInterval injetada", () => {
  let callback = null;
  let intervalMs = null;
  const fakeSetInterval = (cb, ms) => { callback = cb; intervalMs = ms; return 123; };
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 5,
    aoAtualizar: () => {},
    aoFinalizar: () => {},
  });
  cronometro.iniciar(fakeSetInterval);
  assert.equal(intervalMs, 1000);
  assert.equal(typeof callback, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/screens/timer.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/screens/timer.js`**

```javascript
// js/screens/timer.js
export function criarCronometro({ duracaoInicialSegundos, aoAtualizar, aoFinalizar }) {
  let restante = duracaoInicialSegundos;
  let intervalId = null;

  function tick() {
    restante -= 1;
    aoAtualizar(restante);
    if (restante <= 0) {
      parar();
      aoFinalizar();
    }
  }

  function iniciar(setIntervalImpl = globalThis.setInterval) {
    if (intervalId) return;
    intervalId = setIntervalImpl(tick, 1000);
  }

  function parar(clearIntervalImpl = globalThis.clearInterval) {
    if (intervalId) {
      clearIntervalImpl(intervalId);
      intervalId = null;
    }
  }

  function ajustar(deltaSegundos) {
    restante = Math.max(0, restante + deltaSegundos);
    aoAtualizar(restante);
  }

  return { iniciar, parar, ajustar, tick, obterRestante: () => restante };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/screens/timer.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/screens/timer.js js/screens/timer.test.js
git commit -m "Add pure countdown timer module (testable without real timers)"
```

---

## Task 5: Camada de histórico (`js/data/historico.js`)

**Files:**
- Create: `js/data/historico.js`
- Test: `js/data/historico.test.js`

**Interfaces:**
- Consumes: `get`, `getAll`, `put` from `js/data/db.js` (Task 2 of the foundation plan)
- Produces:
  - `registrarSerie(db, serie): Promise<number>` — `serie` shape: `{ exercicioId, data (ISO date string), musculo, contribuicao, tipoSerie, carga, reps, rir }`. Writes into `historicoSeries` (autoIncrement key) and returns the new id.
  - `getSeriesDoExercicioNaData(db, exercicioId, data): Promise<Array<serie>>` — series for one exercise on one date.
  - `getUltimaSerieAnterior(db, exercicioId, dataAtual): Promise<serie|null>` — the most recent logged set for that exercise strictly before `dataAtual`, or `null` if none exists. Used for the "última vez" hint.
  - `getAmostrasRecentesDoExercicio(db, exercicioId, limite = 5): Promise<Array<{carga, reps, rir_relatado}>>` — the `limite` most recent logged sets for that exercise (any date), reshaped for `js/engine/cargas.js`'s `sugerirCarga` (its `rir` field renamed to `rir_relatado`). Most-recent-first is irrelevant to the caller — `sugerirCarga` doesn't care about order.

- [ ] **Step 1: Write the failing test**

```javascript
// js/data/historico.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio } from "./historico.js";

test("registrarSerie grava e getSeriesDoExercicioNaData filtra por exercício e data", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "a", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 15, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "a", data: "2026-08-19", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "b", data: "2026-08-20", musculo: "costas", contribuicao: 1, tipoSerie: "normal", carga: 20, reps: 8, rir: 1 });

  const seriesHoje = await getSeriesDoExercicioNaData(db, "a", "2026-08-20");
  assert.equal(seriesHoje.length, 1);
  assert.equal(seriesHoje[0].carga, 15);
  db.close();
});

test("getUltimaSerieAnterior retorna a série mais recente antes da data atual", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "c", data: "2026-08-13", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 3 });
  await registrarSerie(db, { exercicioId: "c", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2 });

  const ultima = await getUltimaSerieAnterior(db, "c", "2026-08-27");
  assert.equal(ultima.data, "2026-08-20");
  assert.equal(ultima.carga, 14);
  db.close();
});

test("getUltimaSerieAnterior retorna null quando não há histórico", async () => {
  const db = await openDatabase();
  const ultima = await getUltimaSerieAnterior(db, "nunca_registrado", "2026-08-20");
  assert.equal(ultima, null);
  db.close();
});

test("getAmostrasRecentesDoExercicio reshapes séries em amostras (rir_relatado) e respeita o limite", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "d", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 3 });
  await registrarSerie(db, { exercicioId: "d", data: "2026-08-08", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "d", data: "2026-08-15", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 9, rir: 1 });

  const amostras = await getAmostrasRecentesDoExercicio(db, "d", 2);
  assert.equal(amostras.length, 2);
  assert.ok("rir_relatado" in amostras[0]);
  assert.ok(!("rir" in amostras[0]));
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/data/historico.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/data/historico.js`**

```javascript
// js/data/historico.js
import { put, getAll } from "./db.js";

export function registrarSerie(db, serie) {
  return put(db, "historicoSeries", serie);
}

export async function getSeriesDoExercicioNaData(db, exercicioId, data) {
  const todas = await getAll(db, "historicoSeries");
  return todas.filter((s) => s.exercicioId === exercicioId && s.data === data);
}

export async function getUltimaSerieAnterior(db, exercicioId, dataAtual) {
  const todas = await getAll(db, "historicoSeries");
  const anteriores = todas
    .filter((s) => s.exercicioId === exercicioId && s.data < dataAtual)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  return anteriores.length > 0 ? anteriores[0] : null;
}

export async function getAmostrasRecentesDoExercicio(db, exercicioId, limite = 5) {
  const todas = await getAll(db, "historicoSeries");
  return todas
    .filter((s) => s.exercicioId === exercicioId)
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .slice(0, limite)
    .map((s) => ({ carga: s.carga, reps: s.reps, rir_relatado: s.rir }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/data/historico.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/data/historico.js js/data/historico.test.js
git commit -m "Add historicoSeries query layer (log sets, last-time hint)"
```

---

## Task 6: Tela de Treino (`js/screens/treino.js`)

**Files:**
- Create: `js/screens/treino.js`
- Test: none (DOM-heavy screen module; verified manually in Task 8, per the foundation plan's precedent for `sw.js`/`app.js`)

**Interfaces:**
- Consumes:
  - `openDatabase`, `get`, `getAll` from `../data/db.js`
  - `registrarSerie`, `getSeriesDoExercicioNaData`, `getUltimaSerieAnterior` from `../data/historico.js`
  - `sugerirSubstitutos` from `../engine/substituicao.js`
  - `sugerirCarga` from `../engine/cargas.js`
  - `criarCronometro` from `./timer.js`
- Produces: `montarTelaTreino(db): Promise<HTMLElement>` — returns a fully-wired DOM element ready to mount into `#tab-content`. This is the function `js/app.js` (Task 7) calls.

**Wiring `cargas.js`:** this screen does not use a separate `cargas` IndexedDB store — that would need its own write-path with no other consumer yet. Instead, `montarCardExercicio` reads the exercise's own `historicoSeries` records (already written by Task 5's `registrarSerie`) as the sample set for `sugerirCarga`, keeping "carga aprendida" and "histórico" as one source of truth instead of two that could drift apart.

**Scope note:** today's exercise list is `exercicios` filtered to `musculoPrimario === "peito"` (the user's priority muscle, per `perfil.json`) — a stand-in for the real weekly-split builder, which is future work. This is a deliberate, documented scope boundary, not an oversight.

- [ ] **Step 1: Write `js/screens/treino.js`**

```javascript
// js/screens/treino.js
import { get, getAll } from "../data/db.js";
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio } from "../data/historico.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { criarCronometro } from "./timer.js";

const HOJE = new Date().toISOString().slice(0, 10);
const FAIXA_REPS = { min: 8, max: 12 };
const RIR_ALVO = 2;
const DESCANSO_PADRAO_SEGUNDOS = 90;

export async function montarTelaTreino(db) {
  const todosExercicios = await getAll(db, "exercicios");
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

  for (let i = 0; i < exerciciosHoje.length; i++) {
    const exercicio = exerciciosHoje[i];
    const card = await montarCardExercicio(db, exercicio, todosExercicios);
    main.appendChild(card);
    if (i < exerciciosHoje.length - 1) {
      main.appendChild(criarPlaceholderDescanso());
    }
  }

  if (exerciciosHoje.length === 0) {
    main.innerHTML = `<p class="vazio">Nenhum exercício de peito cadastrado ainda.</p>`;
  }

  return root;
}

function criarPlaceholderDescanso() {
  const div = document.createElement("div");
  div.className = "rest-bar rest-bar-hidden";
  div.innerHTML = `
    <div><div class="label">Descanso</div><div class="time">00:00</div></div>
    <div class="rest-ctl"><button data-action="menos">−30s</button><button data-action="mais">+30s</button></div>
  `;
  return div;
}

async function montarCardExercicio(db, exercicio, todosExercicios) {
  const seriesHoje = await getSeriesDoExercicioNaData(db, exercicio.id, HOJE);
  const ultimaAnterior = await getUltimaSerieAnterior(db, exercicio.id, HOJE);
  const amostras = await getAmostrasRecentesDoExercicio(db, exercicio.id);
  const sugestao = sugerirCarga(amostras, RIR_ALVO);

  const card = document.createElement("section");
  card.className = "exercise-card";

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `
    <div>
      <div class="exercise-name">${exercicio.nome}</div>
      <div class="exercise-meta">${FAIXA_REPS.min}–${FAIXA_REPS.max} reps · RIR ${RIR_ALVO}</div>
    </div>
    <button class="swap-pill" type="button">Trocar</button>
  `;
  card.appendChild(head);

  const setsContainer = document.createElement("div");
  setsContainer.className = "sets";
  card.appendChild(setsContainer);

  const placeholderCarga = sugestao.cargaSugerida != null
    ? `${sugestao.cargaSugerida} kg`
    : (ultimaAnterior ? `${ultimaAnterior.carga} kg` : "—");
  const placeholderReps = ultimaAnterior ? String(ultimaAnterior.reps) : String(FAIXA_REPS.min);

  const totalSeriesAlvo = 3;
  for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
    const jaFeita = seriesHoje[numero - 1];
    setsContainer.appendChild(criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps }));
  }

  if (ultimaAnterior) {
    const hint = document.createElement("div");
    hint.className = "prev-hint";
    const sugestaoTexto = sugestao.cargaSugerida != null
      ? ` Sugestão de hoje: <b>${sugestao.cargaSugerida} kg</b> (confiança ${sugestao.confianca}).`
      : "";
    hint.innerHTML = `Última vez: <b>${ultimaAnterior.carga} kg × ${ultimaAnterior.reps}</b>, RIR ${ultimaAnterior.rir}.${sugestaoTexto}`;
    card.appendChild(hint);
  }

  setsContainer.addEventListener("submit", async (event) => {
    const linha = event.target.closest(".set-row");
    if (!linha) return;
    event.preventDefault();
    const carga = Number(linha.querySelector('[name="carga"]').value);
    const reps = Number(linha.querySelector('[name="reps"]').value);
    const rir = Number(linha.querySelector('[name="rir"]').value);
    if (!carga || !reps) return;

    await registrarSerie(db, {
      exercicioId: exercicio.id,
      data: HOJE,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir: rir || RIR_ALVO,
    });

    linha.classList.add("done");
    linha.querySelectorAll("input").forEach((input) => (input.disabled = true));

    iniciarDescansoNoCartaoSeguinte(card);
  });

  card.querySelector(".swap-pill").addEventListener("click", () => {
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios);
    const nomes = sugestoes.map((e) => e.nome).join(", ") || "nenhuma alternativa encontrada";
    alert(`Alternativas: ${nomes}`);
  });

  return card;
}

function criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps }) {
  const form = document.createElement("form");
  form.className = "set-row" + (jaFeita ? " done" : "");
  form.innerHTML = `
    <div class="set-ring"><i>${jaFeita ? "✓" : numero}</i></div>
    <div class="set-field"><label>Carga</label><input name="carga" type="number" step="0.5" placeholder="${placeholderCarga}" value="${jaFeita ? jaFeita.carga : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>Reps</label><input name="reps" type="number" placeholder="${placeholderReps}" value="${jaFeita ? jaFeita.reps : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>RIR</label><input name="rir" type="number" step="0.5" placeholder="${RIR_ALVO}" value="${jaFeita ? jaFeita.rir : ""}" ${jaFeita ? "disabled" : ""} /></div>
    ${jaFeita ? "" : '<button type="submit" style="grid-column: 1 / -1; display:none;">Confirmar</button>'}
  `;
  if (!jaFeita) {
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  }
  return form;
}

function iniciarDescansoNoCartaoSeguinte(card) {
  const restBar = card.nextElementSibling;
  if (!restBar || !restBar.classList.contains("rest-bar")) return;

  restBar.classList.remove("rest-bar-hidden");
  const timeEl = restBar.querySelector(".time");

  const cronometro = criarCronometro({
    duracaoInicialSegundos: DESCANSO_PADRAO_SEGUNDOS,
    aoAtualizar: (restante) => {
      const min = String(Math.floor(restante / 60)).padStart(2, "0");
      const seg = String(restante % 60).padStart(2, "0");
      timeEl.textContent = `${min}:${seg}`;
    },
    aoFinalizar: () => {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    },
  });

  if ("wakeLock" in navigator) {
    navigator.wakeLock.request("screen").catch(() => {});
  }

  restBar.querySelector('[data-action="menos"]').addEventListener("click", () => cronometro.ajustar(-30));
  restBar.querySelector('[data-action="mais"]').addEventListener("click", () => cronometro.ajustar(30));

  cronometro.iniciar();
}
```

- [ ] **Step 2: Self-check by reading the file back**

Confirm imports match the exact export names from Tasks 2–5 (`get`/`getAll` from `db.js`, `registrarSerie`/`getSeriesDoExercicioNaData`/`getUltimaSerieAnterior` from `historico.js`, `sugerirSubstitutos` from `substituicao.js`, `criarCronometro` from `timer.js`).

- [ ] **Step 3: Commit**

```bash
git add js/screens/treino.js
git commit -m "Add Treino screen: session logging, rest timer, instant substitution"
```

---

## Task 7: Mount the real Treino screen in `js/app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `montarTelaTreino(db)` from `./screens/treino.js`

- [ ] **Step 1: Replace the placeholder shell in `js/app.js`** with real mounting for the "treino" tab; other tabs keep the placeholder text.

```javascript
// js/app.js
import { openDatabase } from "./data/db.js";
import { seedIfNeeded } from "./data/seed.js";
import { montarTelaTreino } from "./screens/treino.js";

async function bootstrap() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Falha ao registrar service worker:", err);
    });
  }

  const db = await openDatabase();
  await seedIfNeeded(db);

  renderShell(db);
}

function renderShell(db) {
  const content = document.getElementById("tab-content");
  const tabs = document.querySelectorAll("#tab-bar button");

  const renderTab = async (tabName) => {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));

    if (tabName === "treino") {
      content.textContent = "";
      content.appendChild(await montarTelaTreino(db));
      return;
    }
    content.textContent = `Tela "${tabName}" ainda não implementada (vem no Nível 1b ou depois).`;
  };

  tabs.forEach((button) => {
    button.addEventListener("click", () => renderTab(button.dataset.tab));
  });

  renderTab("treino");
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar o app:", err);
  const content = document.getElementById("tab-content");
  content.textContent = "Não foi possível carregar seus dados. Tente importar seu último backup JSON nas Configurações.";
});
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "Mount real Treino screen on app boot"
```

---

## Task 8: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests from Tasks 2–5 (plus the foundation plan's existing tests) PASS.

- [ ] **Step 2: Use the `run` skill to launch the app and open the Treino tab**

Confirm:
- The 3 peito exercises render as cards with the Abril visual language (dark green background, lime accent, floating pill nav).
- Typing a carga/reps and pressing Enter (or submitting) marks the set done, disables its inputs, and shows the rest timer counting down on the strip below that exercise's card.
- The rest timer's `−30s`/`+30s` buttons adjust the displayed time.
- "Trocar" on an exercise shows alternatives with the same músculo primário and tipo (verify via the `alert()` — acceptable for this MVP, a real modal is future polish).
- Reloading the page shows the already-logged set as done for today (persisted via IndexedDB).

- [ ] **Step 3: Verify no console errors**

Use `read_console_messages` — must be empty of errors during the full flow above.

- [ ] **Step 4: Report result to the user**

Show the working Treino screen before starting Nível 1b (biblioteca de exercícios, histórico por exercício, export/import).
