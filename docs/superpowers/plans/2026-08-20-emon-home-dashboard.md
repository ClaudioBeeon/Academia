# Emon — Home Dashboard Completa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the "Emon" home dashboard: a Plano+Cardio carousel (currently only Plano exists) and a "Minha atividade" 2×2 stats grid (treinos no mês, séries na semana, tempo ativo estimado, dias seguidos), all from real data. Rename the landing tab from "Treino" to "Hoje" to match its new role as a dashboard, not just an exercise list.

**Architecture:** A new pure engine `js/engine/atividade.js` computes the four activity numbers from `historicoSeries`, reusing `graficos.js`'s existing ISO-week helper (exported for this purpose). `js/screens/treino.js` wraps the existing `.plano-hero` card and a new Cardio card in a horizontal scroll-snap carousel, and adds the "Minha atividade" grid reusing the existing `.stats-grid`/`.stat-tile` CSS classes. `js/app.js`/`index.html` rename the tab and wire a new `onIrParaCardio` callback (same pattern as the existing `onAbrirHistorico`) so the Cardio card's button can jump to the Divisão tab's cardio form.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-emon-home-dashboard-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- No new runtime dependencies, no IndexedDB schema changes.
- Never fabricate a cardio recommendation (modality/intensity) — no engine exists for that; the Cardio card only ever shows real logged data or an honest empty state.
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead.
- `js/screens/treino.js`'s exported function name (`montarTelaTreino`) and the file's own name do **not** change — only the tab's label/route (`"treino"` → `"hoje"`) and its button text change. Renaming the file/function is out of scope (cosmetic, not worth the import-touching cost across the codebase).

---

## Task 1: Engine — Atividade mensal (`js/engine/atividade.js`)

**Files:**
- Modify: `js/engine/graficos.js` (export the existing private `semanaISO` helper — no behavior change)
- Modify: `js/engine/graficos.test.js` (no new tests needed here — just confirm the existing suite still passes after the export change)
- Create: `js/engine/atividade.js`
- Test: `js/engine/atividade.test.js`

**Interfaces:**
- Produces (from `graficos.js`): `semanaISO(dataStr)` — now exported, same implementation, returns `"AAAA-Www"`.
- Produces: `calcularAtividadeMensal(todasAsSeries, hoje) => { treinosEsteMes, seriesEstaSemana, minutosAtivosEstaSemana, diasSeguidos }`. `hoje` is a `"AAAA-MM-DD"` string. All series with `tipoSerie === "aquecimento"` are excluded from every count, same convention as `volume.js`/`graficos.js`.
  - `treinosEsteMes`: count of distinct dates (from the filtered series) whose year-month matches `hoje`'s year-month.
  - `seriesEstaSemana`: count of filtered series whose `semanaISO(data)` matches `semanaISO(hoje)`.
  - `minutosAtivosEstaSemana`: `7 × (number of distinct exercicioId values among this week's filtered series)` — an estimate (no session start/end timestamps exist in the schema), using the same 7-minutes-per-exercise heuristic already used in `js/screens/treino.js` (`MINUTOS_ESTIMADOS_POR_EXERCICIO`).
  - `diasSeguidos`: the longest run of consecutive calendar days, walking backward from `hoje` (or from yesterday if `hoje` itself has no series yet), where each day has at least one filtered series. Stops at the first gap.

- [ ] **Step 1: Export `semanaISO` from `graficos.js`**

In `js/engine/graficos.js`, change:
```javascript
function semanaISO(dataStr) {
```
to:
```javascript
export function semanaISO(dataStr) {
```
(No other change to the function body.)

- [ ] **Step 2: Run the existing suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — `graficos.test.js`'s existing tests are unaffected by adding `export` to an already-used-internally function; count unchanged.

- [ ] **Step 3: Write the failing tests for `atividade.js`**

Create `js/engine/atividade.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularAtividadeMensal } from "./atividade.js";

function serie(data, exercicioId, tipoSerie = "normal") {
  return { data, exercicioId, tipoSerie, carga: 10, reps: 10, rir: 2, musculo: "peito" };
}

test("array vazio retorna os quatro campos zerados", () => {
  const resultado = calcularAtividadeMensal([], "2026-08-20");
  assert.deepEqual(resultado, {
    treinosEsteMes: 0,
    seriesEstaSemana: 0,
    minutosAtivosEstaSemana: 0,
    diasSeguidos: 0,
  });
});

test("treinosEsteMes conta datas distintas só do mês/ano de hoje", () => {
  const series = [
    serie("2026-08-05", "a"),
    serie("2026-08-05", "b"),
    serie("2026-08-12", "a"),
    serie("2026-07-30", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.treinosEsteMes, 2);
});

test("seriesEstaSemana conta só séries da mesma semana ISO de hoje, excluindo aquecimento", () => {
  const series = [
    serie("2026-08-19", "a"),
    serie("2026-08-19", "a", "aquecimento"),
    serie("2026-08-13", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.seriesEstaSemana, 1);
});

test("minutosAtivosEstaSemana usa 7 minutos por exercício distinto da semana", () => {
  const series = [
    serie("2026-08-19", "a"),
    serie("2026-08-19", "a"),
    serie("2026-08-19", "b"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.minutosAtivosEstaSemana, 14);
});

test("diasSeguidos conta a sequência mais recente, parando no primeiro buraco", () => {
  const series = [
    serie("2026-08-20", "a"),
    serie("2026-08-19", "a"),
    serie("2026-08-18", "a"),
    serie("2026-08-15", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.diasSeguidos, 3);
});

test("diasSeguidos conta a partir de ontem quando hoje ainda não tem série", () => {
  const series = [
    serie("2026-08-19", "a"),
    serie("2026-08-18", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.diasSeguidos, 2);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/engine/atividade.js` does not exist yet.

- [ ] **Step 5: Write the implementation**

Create `js/engine/atividade.js`:

```javascript
// js/engine/atividade.js
import { semanaISO } from "./graficos.js";

const MINUTOS_ESTIMADOS_POR_EXERCICIO = 7;

export function calcularAtividadeMensal(todasAsSeries, hoje) {
  const validas = todasAsSeries.filter((s) => s.tipoSerie !== "aquecimento");
  const [anoHoje, mesHoje] = hoje.split("-");
  const semanaHoje = semanaISO(hoje);

  const datasComTreino = new Set(validas.map((s) => s.data));
  const treinosEsteMes = [...datasComTreino].filter((data) => data.startsWith(`${anoHoje}-${mesHoje}`)).length;

  const seriesDaSemana = validas.filter((s) => semanaISO(s.data) === semanaHoje);
  const seriesEstaSemana = seriesDaSemana.length;
  const exerciciosDistintosSemana = new Set(seriesDaSemana.map((s) => s.exercicioId)).size;
  const minutosAtivosEstaSemana = exerciciosDistintosSemana * MINUTOS_ESTIMADOS_POR_EXERCICIO;

  let diasSeguidos = 0;
  let cursor = datasComTreino.has(hoje) ? hoje : subtrairUmDia(hoje);
  while (datasComTreino.has(cursor)) {
    diasSeguidos++;
    cursor = subtrairUmDia(cursor);
  }

  return { treinosEsteMes, seriesEstaSemana, minutosAtivosEstaSemana, diasSeguidos };
}

function subtrairUmDia(dataISO) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 6 new tests green, full existing suite (165 tests as of the prior plan) still green.

- [ ] **Step 7: Commit**

```bash
git add js/engine/graficos.js js/engine/atividade.js js/engine/atividade.test.js
git commit -m "Add monthly-activity engine (treinos/séries/tempo/streak), export semanaISO"
```

---

## Task 2: Screen — Carousel + Minha atividade (`js/screens/treino.js`)

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `calcularAtividadeMensal(todasAsSeries, hoje)` from `../engine/atividade.js` (Task 1); `getCardioRecente(db, limite)` from `../data/cardio.js` (pre-existing, unmodified).
- `montarTelaTreino(db, { onAbrirHistorico, onIrParaCardio } = {})` gains a new optional callback parameter, `onIrParaCardio` (invoked with no arguments when the user clicks the Cardio card's button).

- [ ] **Step 1: Add the imports**

Add two new import lines alongside the other engine/data imports:
```javascript
import { calcularAtividadeMensal } from "../engine/atividade.js";
import { getCardioRecente } from "../data/cardio.js";
```

- [ ] **Step 2: Accept the new callback and fetch the new data**

Change the function signature:
```javascript
export async function montarTelaTreino(db, { onAbrirHistorico } = {}) {
```
to:
```javascript
export async function montarTelaTreino(db, { onAbrirHistorico, onIrParaCardio } = {}) {
```

In the `Promise.all` that already fetches `ultimaSerieGeral`, `seriesDeHoje`, `todasAsSeries`, `grupoForcado`, add a fifth fetch:
```javascript
  const [ultimaSerieGeral, seriesDeHoje, todasAsSeries, grupoForcado, cardioRecente] = await Promise.all([
    getUltimaSerieGeral(db),
    getSeriesDoDia(db, hoje),
    getAll(db, "historicoSeries"),
    getGrupoForcado(db, hoje),
    getCardioRecente(db, 1),
  ]);
```
(Adjust whichever exact variable list is currently there — the plan text above matches the file as of the manual-override plan; if a different fetch has been added since, extend that same `Promise.all` rather than adding a second one, keeping every independent read in a single batch.)

Right after `grupoDeHoje`/`tituloGrupo` are computed, add:
```javascript
  const atividade = calcularAtividadeMensal(todasAsSeries, hoje);
  const ultimoCardio = cardioRecente[0] ?? null;
```

- [ ] **Step 3: Wrap the plan card in a carousel with a Cardio card**

Find the existing `planoCard` construction (the `.plano-hero` section with "Treino de hoje" / `tituloGrupo` / stats / "Começar treino" button) and the `main.appendChild(planoCard);` line that follows it (after the "trocar grupo" link logic from the prior plan). Change the final append from:
```javascript
  main.appendChild(planoCard);
```
to:
```javascript
  const carrossel = document.createElement("div");
  carrossel.className = "carrossel-plano";
  carrossel.appendChild(planoCard);
  carrossel.appendChild(montarCardCardio(ultimoCardio, onIrParaCardio));
  main.appendChild(carrossel);

  main.appendChild(montarCardAtividade(atividade));
```

(`planoCard` itself is untouched — it keeps its own `"plano-hero"` class and its "trocar grupo" link and "Começar treino" button exactly as built earlier in the function; it's just appended into the new wrapper instead of directly into `main`.)

- [ ] **Step 4: Add the Cardio card and Atividade grid builder functions**

Add these two functions anywhere at module scope (alongside `montarCardResumoSessao`/`montarCardCheckin`):

```javascript
const NOME_MODALIDADE_CARDIO = {
  bicicleta: "Bicicleta",
  eliptico: "Elíptico",
  escada: "Escada",
  caminhada: "Caminhada",
  corrida: "Corrida",
};

function montarCardCardio(ultimoCardio, onIrParaCardio) {
  const card = document.createElement("section");
  card.className = "plano-hero alt";

  const rotulo = document.createElement("div");
  rotulo.className = "rotulo";
  rotulo.textContent = "Cardio";
  card.appendChild(rotulo);

  const titulo = document.createElement("h2");
  if (ultimoCardio) {
    titulo.textContent = NOME_MODALIDADE_CARDIO[ultimoCardio.modalidade] ?? ultimoCardio.modalidade;
  } else {
    titulo.textContent = "Nenhum registro ainda";
  }
  card.appendChild(titulo);

  const meta = document.createElement("div");
  meta.className = "meta";
  if (ultimoCardio) {
    const duracao = document.createElement("span");
    duracao.innerHTML = `<b>${ultimoCardio.duracaoMinutos}</b> min`;
    meta.appendChild(duracao);
  } else {
    const vazio = document.createElement("span");
    vazio.textContent = "Registre sua primeira sessão";
    meta.appendChild(vazio);
  }
  card.appendChild(meta);

  const botao = document.createElement("button");
  botao.type = "button";
  botao.textContent = ultimoCardio ? "Ver mais" : "Registrar";
  botao.addEventListener("click", () => {
    if (onIrParaCardio) onIrParaCardio();
  });
  card.appendChild(botao);

  return card;
}

function formatarMinutosAtivos(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

function montarCardAtividade(atividade) {
  const section = document.createElement("section");
  section.className = "atividade-secao";

  const cabecalho = document.createElement("div");
  cabecalho.className = "shead";
  const h4 = document.createElement("h4");
  h4.textContent = "Minha atividade";
  cabecalho.appendChild(h4);
  section.appendChild(cabecalho);

  const grid = document.createElement("div");
  grid.className = "stats-grid";
  grid.appendChild(criarStatTile(String(atividade.treinosEsteMes), "Treinos este mês"));
  grid.appendChild(criarStatTile(String(atividade.seriesEstaSemana), "Séries esta semana"));
  grid.appendChild(criarStatTile(`~${formatarMinutosAtivos(atividade.minutosAtivosEstaSemana)}`, "Tempo ativo (estimado)"));
  grid.appendChild(criarStatTile(String(atividade.diasSeguidos), "Dias seguidos"));
  section.appendChild(grid);

  return section;
}

function criarStatTile(valor, rotulo) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";
  const b = document.createElement("b");
  b.textContent = valor;
  const span = document.createElement("span");
  span.textContent = rotulo;
  tile.appendChild(b);
  tile.appendChild(span);
  return tile;
}
```

(`titulo.textContent` and `criarStatTile`'s `.textContent` assignments are used for every value that could ever be influenced by a future data source; the one `innerHTML` use, in the Cardio card's duration line, interpolates only `ultimoCardio.duracaoMinutos` — a number the user themselves typed into the cardio form, following the exact same "numbers-only innerHTML" pattern already used by `montarCardResumoSessao`'s `atualizarResumoSessao` elsewhere in this file.)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 1 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change).

- [ ] **Step 6: Commit**

```bash
git add js/screens/treino.js
git commit -m "Add Cardio card and Minha atividade grid to the Hoje dashboard"
```

---

## Task 3: Navigation — Rename tab to "Hoje", wire cardio shortcut (`index.html`, `js/app.js`)

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `montarTelaTreino(db, { onAbrirHistorico, onIrParaCardio })` (Task 2's new signature).

- [ ] **Step 1: Rename the tab button**

In `index.html`, change:
```html
    <button data-tab="treino">Treino</button>
```
to:
```html
    <button data-tab="hoje">Hoje</button>
```

- [ ] **Step 2: Update the route and add the callback in `js/app.js`**

Change:
```javascript
      if (tabName === "treino") {
        content.textContent = "";
        content.appendChild(await montarTelaTreino(db, {
          onAbrirHistorico: async (exercicio) => {
            content.textContent = "";
            content.appendChild(await montarTelaHistorico(db, exercicio, () => renderTab("treino")));
          },
        }));
        return;
      }
```
to:
```javascript
      if (tabName === "hoje") {
        content.textContent = "";
        content.appendChild(await montarTelaTreino(db, {
          onAbrirHistorico: async (exercicio) => {
            content.textContent = "";
            content.appendChild(await montarTelaHistorico(db, exercicio, () => renderTab("hoje")));
          },
          onIrParaCardio: () => renderTab("divisao"),
        }));
        return;
      }
```

Change the bootstrap call at the bottom of `renderShell`:
```javascript
  renderTab("treino");
```
to:
```javascript
  renderTab("hoje");
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 1 (no new tests — `app.js` isn't unit tested, same as every other screen-wiring file in this project).

- [ ] **Step 4: Commit**

```bash
git add index.html js/app.js
git commit -m "Rename landing tab from Treino to Hoje, wire cardio shortcut"
```

---

## Task 4: Styling — Carousel CSS (`css/styles.css`)

**Files:**
- Modify: `css/styles.css`

- [ ] **Step 1: Add the carousel and alt-card styles**

Add these rules anywhere near the existing `.plano-hero`/`.stats-grid` rules (around line 59-71):

```css
.carrossel-plano { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x mandatory; margin-bottom: 20px; }
.carrossel-plano::-webkit-scrollbar { display: none; }
.carrossel-plano .plano-hero { flex: 0 0 84%; scroll-snap-align: start; margin-bottom: 0; }
.carrossel-plano .plano-hero.alt { background: var(--card-2); color: var(--ink); border: 1px solid var(--line); }
.carrossel-plano .plano-hero.alt button { background: var(--accent); color: var(--accent-ink); }
.atividade-secao { margin-bottom: 20px; }
.atividade-secao .shead { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
.atividade-secao .shead h4 { margin: 0; font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; }
```

(`.shead`/`h4` here reuse the same visual role `.exercise-head`/`.exercise-name` play elsewhere, but this section isn't an `.exercise-card`, so it needs its own small header rule rather than borrowing that class — a section header outside a card context, matching how `divisao.js`'s "Sessões recentes" header sits inside its own card instead.)

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — CSS changes don't affect `node --test` (no CSS tests in this project); confirms nothing else broke.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "Add carousel and Minha atividade section styles"
```

---

## Task 5: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 1 new file to `APP_SHELL`, bump the cache version**

Add this entry anywhere in the `APP_SHELL` array:
```javascript
  "./js/engine/atividade.js",
```

Change `const CACHE_NAME = "app-treino-shell-v14";` to `const CACHE_NAME = "app-treino-shell-v15";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 171 tests total (165 pre-existing + 6 new in Task 1), all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add atividade.js to service worker cache list, bump to v15"
```

---

## Task 6: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the tab rename**

Reload the app. Confirm the bottom nav's first button now reads "Hoje" (not "Treino") and is active by default on load.

- [ ] **Step 3: Verify the carousel**

On the Hoje tab, confirm two cards are visible side by side (or swipeable), the lima "Treino de hoje" plan card and a second "Cardio" card. If no cardio has been logged, confirm it shows "Nenhum registro ainda" and a "Registrar" button; click it and confirm it navigates to the Divisão tab. Log a cardio session there, return to Hoje, confirm the Cardio card now shows the modality and duration with a "Ver mais" button.

- [ ] **Step 4: Verify Minha atividade**

Confirm a "Minha atividade" section with 4 tiles appears below the carousel (and below/above the check-in card per Task 2's insertion point), showing Treinos este mês, Séries esta semana, Tempo ativo (estimado) with a `~` prefix, and Dias seguidos, all with plausible numbers matching the manual testing already done in this app session.

- [ ] **Step 5: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (including the renamed tab and both new cards) still loads and renders fully from cache.

- [ ] **Step 6: Report result to the user**

Show the completed Home dashboard. Note that Fila do Dia / Execução / Relatório (the full-screen session flow from the Emon prototype) remain as a separate future slice, per the scope decision recorded in the spec.
