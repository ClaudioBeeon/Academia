# Nível 2b (fatia 1) — Gráficos de Progressão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Evolução" tab of the app with two chart views built from data that already exists: a load/1RM progression line chart per exercise, and a weekly-volume-by-muscle bar chart, both rendered as hand-built inline SVG with zero new dependencies.

**Architecture:** One new pure engine module (`js/engine/graficos.js`, same no-DOM/no-IndexedDB/no-fetch discipline as every prior engine module) aggregates raw `historicoSeries` rows into chart-ready data. One new screen module (`js/screens/evolucao.js`) fetches from IndexedDB, calls the engine, and draws SVG by hand using `document.createElementNS`. `js/app.js` wires the existing (currently placeholder) "Evolução" tab to it. `sw.js` gets the two new files added to its offline cache list.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, tokens from `css/tokens.css`. No charting library — SVG generated directly in JS.

**Spec:** `docs/superpowers/specs/2026-08-20-nivel2b-graficos-progressao-design.md`. This is the first of four independent slices of the original "Nível 2b" scope (graphs, body measurements, calendar, session stats) — the other three get their own spec/plan cycles later.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- Any string interpolated into `innerHTML` that originates from user input or IndexedDB must go through `.textContent` instead (hardening rule from Nível 1b). Numeric SVG coordinates computed by this app are not subject to this rule; exercise names are, and must use `.textContent`.
- No new runtime dependencies — no CDN scripts, no npm packages added to the browser bundle. The app must keep working 100% offline via `sw.js`.
- The 1RM estimate formula must match the one already used in `js/engine/recordes.js` (`carga * (1 + reps / 30)`) so the numbers a user sees in the PR toast and in the progression chart never disagree.

---

## Task 1: Engine — Progressão de 1RM por exercício (`js/engine/graficos.js`)

**Files:**
- Create: `js/engine/graficos.js`
- Test: `js/engine/graficos.test.js`

**Interfaces:**
- Produces: `calcularProgressao1RM(seriesDoExercicio)` — takes an array of series objects (each with at least `data` (string `"YYYY-MM-DD"`), `carga` (number), `reps` (number), `tipoSerie` (string)) for a single exercise, in any order. Returns an array of `{ data, carga1RM }` objects sorted by `data` ascending, one entry per distinct day, `carga1RM` rounded to the same precision style as `recordes.js` (no rounding inside the function — callers may round for display).

- [ ] **Step 1: Write the failing tests**

Create `js/engine/graficos.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularProgressao1RM } from "./graficos.js";

test("agrupa por dia e mantém o maior 1RM estimado do dia", () => {
  const series = [
    { data: "2026-08-01", carga: 90, reps: 3, tipoSerie: "normal" },
    { data: "2026-08-01", carga: 80, reps: 9, tipoSerie: "normal" },
    { data: "2026-08-03", carga: 60, reps: 15, tipoSerie: "normal" },
  ];
  const resultado = calcularProgressao1RM(series);
  assert.deepEqual(resultado, [
    { data: "2026-08-01", carga1RM: 104 },
    { data: "2026-08-03", carga1RM: 90 },
  ]);
});

test("ignora séries de aquecimento", () => {
  const series = [
    { data: "2026-08-01", carga: 200, reps: 5, tipoSerie: "aquecimento" },
    { data: "2026-08-01", carga: 80, reps: 9, tipoSerie: "normal" },
  ];
  const resultado = calcularProgressao1RM(series);
  assert.deepEqual(resultado, [{ data: "2026-08-01", carga1RM: 104 }]);
});

test("array vazio ou só aquecimento retorna array vazio", () => {
  assert.deepEqual(calcularProgressao1RM([]), []);
  assert.deepEqual(
    calcularProgressao1RM([{ data: "2026-08-01", carga: 50, reps: 5, tipoSerie: "aquecimento" }]),
    []
  );
});

test("ordena o resultado por data ascendente mesmo com entrada fora de ordem", () => {
  const series = [
    { data: "2026-08-03", carga: 60, reps: 15, tipoSerie: "normal" },
    { data: "2026-08-01", carga: 80, reps: 9, tipoSerie: "normal" },
  ];
  const resultado = calcularProgressao1RM(series);
  assert.deepEqual(resultado.map((p) => p.data), ["2026-08-01", "2026-08-03"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/engine/graficos.js` does not exist yet (`Cannot find module`).

- [ ] **Step 3: Write the implementation**

Create `js/engine/graficos.js`:

```javascript
// js/engine/graficos.js
function estimativa1RM(serie) {
  return serie.carga * (1 + serie.reps / 30);
}

export function calcularProgressao1RM(seriesDoExercicio) {
  const porDia = new Map();
  for (const serie of seriesDoExercicio) {
    if (serie.tipoSerie === "aquecimento") continue;
    const valor = estimativa1RM(serie);
    const atual = porDia.get(serie.data);
    if (atual === undefined || valor > atual) {
      porDia.set(serie.data, valor);
    }
  }
  return [...porDia.entries()]
    .map(([data, carga1RM]) => ({ data, carga1RM }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 4 new tests green, plus the full existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add js/engine/graficos.js js/engine/graficos.test.js
git commit -m "Add 1RM progression engine (calcularProgressao1RM)"
```

---

## Task 2: Engine — Volume semanal por músculo (`js/engine/graficos.js`)

**Files:**
- Modify: `js/engine/graficos.js`
- Modify: `js/engine/graficos.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 (independent function in the same file).
- Produces: `calcularVolumeSemanalPorMusculo(todasAsSeries, semanas = 8)` — takes an array of series from ANY exercise (each with at least `data`, `musculo`, `contribuicao`, `tipoSerie`) and an optional week count. Returns an object `{ [musculo]: [{ semana, volume }, ...] }`, each array sorted by `semana` ascending (ISO week strings `"YYYY-Www"` sort correctly lexicographically because the week number is zero-padded to 2 digits), limited to the most recent `semanas` distinct weeks present in the data. Muscles with no series in that window are absent from the object's keys.

- [ ] **Step 1: Write the failing tests**

Append to `js/engine/graficos.test.js` (add the import too):

```javascript
import { calcularProgressao1RM, calcularVolumeSemanalPorMusculo } from "./graficos.js";
```

Replace the existing `import { calcularProgressao1RM } from "./graficos.js";` line with the one above, then add:

```javascript
test("agrupa por semana ISO e soma contribuição por músculo", () => {
  const series = [
    { data: "2026-08-17", musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
    { data: "2026-08-19", musculo: "peito", contribuicao: 0.5, tipoSerie: "normal" },
    { data: "2026-08-24", musculo: "peito", contribuicao: 2.0, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.deepEqual(resultado.peito, [
    { semana: "2026-W34", volume: 1.5 },
    { semana: "2026-W35", volume: 2.0 },
  ]);
});

test("exclui séries de aquecimento do volume semanal", () => {
  const series = [
    { data: "2026-08-17", musculo: "peito", contribuicao: 5, tipoSerie: "aquecimento" },
    { data: "2026-08-17", musculo: "peito", contribuicao: 1, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.deepEqual(resultado.peito, [{ semana: "2026-W34", volume: 1 }]);
});

test("vira o ano corretamente na virada de dezembro para janeiro", () => {
  const series = [
    { data: "2025-12-28", musculo: "costas", contribuicao: 1, tipoSerie: "normal" },
    { data: "2025-12-29", musculo: "costas", contribuicao: 1, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.deepEqual(resultado.costas, [
    { semana: "2025-W52", volume: 1 },
    { semana: "2026-W01", volume: 1 },
  ]);
});

test("respeita o limite de semanas, contando a partir da semana mais recente nos dados", () => {
  const datas = ["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"];
  const series = datas.map((data) => ({ data, musculo: "peito", contribuicao: 1, tipoSerie: "normal" }));
  const resultado = calcularVolumeSemanalPorMusculo(series, 3);
  assert.deepEqual(resultado.peito.map((s) => s.semana), ["2026-W33", "2026-W34", "2026-W35"]);
});

test("músculo sem série no período não aparece nas chaves do resultado", () => {
  const series = [{ data: "2026-08-17", musculo: "peito", contribuicao: 1, tipoSerie: "normal" }];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.equal("costas" in resultado, false);
});

test("array vazio retorna objeto vazio", () => {
  assert.deepEqual(calcularVolumeSemanalPorMusculo([]), {});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `calcularVolumeSemanalPorMusculo is not a function` (or not exported).

- [ ] **Step 3: Write the implementation**

Append to `js/engine/graficos.js`:

```javascript
function semanaISO(dataStr) {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const diaSemana = (data.getUTCDay() + 6) % 7; // segunda=0 ... domingo=6
  data.setUTCDate(data.getUTCDate() - diaSemana + 3); // quinta-feira da mesma semana ISO
  const primeiraQuinta = new Date(Date.UTC(data.getUTCFullYear(), 0, 4));
  const diffDias = (data - primeiraQuinta) / 86400000;
  const numeroSemana = 1 + Math.round(diffDias / 7);
  return `${data.getUTCFullYear()}-W${String(numeroSemana).padStart(2, "0")}`;
}

export function calcularVolumeSemanalPorMusculo(todasAsSeries, semanas = 8) {
  const porSemanaEMusculo = new Map();
  const semanasOrdenadas = new Set();

  for (const serie of todasAsSeries) {
    if (serie.tipoSerie === "aquecimento") continue;
    const semana = semanaISO(serie.data);
    semanasOrdenadas.add(semana);
    const chave = `${semana}|${serie.musculo}`;
    porSemanaEMusculo.set(chave, (porSemanaEMusculo.get(chave) ?? 0) + (serie.contribuicao ?? 0));
  }

  const ultimasSemanas = [...semanasOrdenadas].sort().slice(-semanas);
  const ultimasSemanasSet = new Set(ultimasSemanas);

  const resultado = {};
  for (const [chave, volume] of porSemanaEMusculo.entries()) {
    const [semana, musculo] = chave.split("|");
    if (!ultimasSemanasSet.has(semana)) continue;
    if (!resultado[musculo]) resultado[musculo] = [];
    resultado[musculo].push({ semana, volume });
  }

  for (const lista of Object.values(resultado)) {
    lista.sort((a, b) => a.semana.localeCompare(b.semana));
  }

  return resultado;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all new tests green, full suite still green (this task's tests plus Task 1's plus every pre-existing test).

- [ ] **Step 5: Commit**

```bash
git add js/engine/graficos.js js/engine/graficos.test.js
git commit -m "Add weekly volume-by-muscle engine (calcularVolumeSemanalPorMusculo)"
```

---

## Task 3: Screen — Tela de Evolução (`js/screens/evolucao.js`)

**Files:**
- Create: `js/screens/evolucao.js`

**Interfaces:**
- Consumes: `getAll(db, storeName)` from `../data/db.js` (existing, signature: `getAll(db, storeName) => Promise<Array>`), `calcularProgressao1RM(seriesDoExercicio) => Array<{data, carga1RM}>` and `calcularVolumeSemanalPorMusculo(todasAsSeries, semanas) => Object` from `../engine/graficos.js` (both from Tasks 1–2).
- Produces: `montarTelaEvolucao(db)` — takes the already-open IndexedDB handle (same convention as `montarTelaTreino(db, ...)` and `montarTelaHistorico(db, ...)`), returns a `Promise<HTMLElement>` (a detached DOM node ready to append), matching every other `montarTela*` function in `js/screens/`.

No dedicated test file for this task — no other screen module (`treino.js`, `config.js`, `historico.js`, `biblioteca.js`) has one either; screen verification for this whole plan happens manually in Task 6, consistent with the rest of the project.

- [ ] **Step 1: Write the screen module**

Create `js/screens/evolucao.js`:

```javascript
// js/screens/evolucao.js
import { getAll } from "../data/db.js";
import { calcularProgressao1RM, calcularVolumeSemanalPorMusculo } from "../engine/graficos.js";

export async function montarTelaEvolucao(db) {
  const root = document.createElement("div");
  root.className = "tela-evolucao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Progressão</div><div class="day-title">Evolução</div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const [exercicios, todasAsSeries] = await Promise.all([
    getAll(db, "exercicios"),
    getAll(db, "historicoSeries"),
  ]);

  if (todasAsSeries.length === 0) {
    main.innerHTML = `<p class="vazio">Sem treinos registrados ainda.</p>`;
    return root;
  }

  montarSecaoCarga(main, exercicios, todasAsSeries);
  montarSecaoVolume(main, todasAsSeries);

  return root;
}

function montarSecaoCarga(main, exercicios, todasAsSeries) {
  const idsComHistorico = new Set(todasAsSeries.map((s) => s.exercicioId));
  const exerciciosComHistorico = exercicios.filter((e) => idsComHistorico.has(e.id));
  if (exerciciosComHistorico.length === 0) return;

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Progressão de carga (1RM estimado)</div></div>
    <div class="sets" style="padding:0 18px 18px;">
      <div class="set-field" style="grid-column:1/-1;">
        <label>Exercício</label>
        <select class="select-exercicio" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;"></select>
      </div>
      <div class="grafico-1rm" style="grid-column:1/-1;"></div>
    </div>
  `;
  main.appendChild(card);

  const select = card.querySelector(".select-exercicio");
  for (const exercicio of exerciciosComHistorico) {
    const option = document.createElement("option");
    option.value = exercicio.id;
    option.textContent = exercicio.nome;
    select.appendChild(option);
  }

  const container = card.querySelector(".grafico-1rm");

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

  select.addEventListener("change", () => desenhar(select.value));
  select.value = exerciciosComHistorico[0].id;
  desenhar(exerciciosComHistorico[0].id);
}

function montarSecaoVolume(main, todasAsSeries) {
  const volumePorMusculo = calcularVolumeSemanalPorMusculo(todasAsSeries);
  const musculos = Object.keys(volumePorMusculo).sort();

  if (musculos.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = "Sem volume semanal suficiente ainda.";
    main.appendChild(vazio);
    return;
  }

  for (const musculo of musculos) {
    const semanas = volumePorMusculo[musculo];
    const card = document.createElement("section");
    card.className = "exercise-card";

    const head = document.createElement("div");
    head.className = "exercise-head";
    head.innerHTML = `<div class="exercise-name"></div>`;
    head.querySelector(".exercise-name").textContent = `Volume semanal — ${musculo}`;
    card.appendChild(head);

    const corpo = document.createElement("div");
    corpo.className = "sets";
    corpo.style.padding = "0 18px 18px";
    corpo.appendChild(criarSvgBarras(semanas));
    card.appendChild(corpo);

    main.appendChild(card);
  }
}

function formatarDataCurta(dataIso) {
  const [, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}`;
}

function criarSvgLinha(pontos) {
  const largura = 320;
  const altura = 140;
  const margem = 24;

  const valores = pontos.map((p) => p.carga1RM);
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
    pontos.map((p, i) => `${escalaX(i)},${escalaY(p.carga1RM)}`).join(" ")
  );
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "var(--accent)");
  polyline.setAttribute("stroke-width", "2");
  svg.appendChild(polyline);

  pontos.forEach((p, i) => {
    const circulo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circulo.setAttribute("cx", escalaX(i));
    circulo.setAttribute("cy", escalaY(p.carga1RM));
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

function criarSvgBarras(semanas) {
  const largura = 320;
  const altura = 100;
  const margem = 16;
  const maxValor = Math.max(...semanas.map((s) => s.volume), 1);
  const larguraBarra = (largura - margem * 2) / semanas.length;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura + 16}`);
  svg.setAttribute("width", "100%");
  svg.style.display = "block";

  semanas.forEach((s, i) => {
    const alturaBarra = (s.volume / maxValor) * (altura - margem);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(margem + i * larguraBarra + 2));
    rect.setAttribute("y", String(altura - alturaBarra));
    rect.setAttribute("width", String(Math.max(larguraBarra - 4, 1)));
    rect.setAttribute("height", String(alturaBarra));
    rect.setAttribute("fill", "var(--accent)");
    rect.setAttribute("rx", "2");
    svg.appendChild(rect);
  });

  const rotuloPrimeira = document.createElementNS("http://www.w3.org/2000/svg", "text");
  rotuloPrimeira.setAttribute("x", String(margem));
  rotuloPrimeira.setAttribute("y", String(altura + 12));
  rotuloPrimeira.setAttribute("font-size", "9");
  rotuloPrimeira.setAttribute("fill", "var(--ink-faint)");
  rotuloPrimeira.setAttribute("text-anchor", "start");
  rotuloPrimeira.textContent = semanas[0].semana;
  svg.appendChild(rotuloPrimeira);

  const rotuloUltima = document.createElementNS("http://www.w3.org/2000/svg", "text");
  rotuloUltima.setAttribute("x", String(largura - margem));
  rotuloUltima.setAttribute("y", String(altura + 12));
  rotuloUltima.setAttribute("font-size", "9");
  rotuloUltima.setAttribute("fill", "var(--ink-faint)");
  rotuloUltima.setAttribute("text-anchor", "end");
  rotuloUltima.textContent = semanas[semanas.length - 1].semana;
  svg.appendChild(rotuloUltima);

  return svg;
}
```

Note: `.vazio` and `.prev-hint` are existing CSS classes already used the same way in `js/screens/historico.js`; `.exercise-card`, `.exercise-head`, `.exercise-name`, `.sets`, `.set-field` are existing classes already used the same way in `js/screens/config.js`'s equipment form. No new CSS is needed.

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — same count as after Task 2 (this task adds no tests, screen modules aren't unit tested in this project).

- [ ] **Step 3: Commit**

```bash
git add js/screens/evolucao.js
git commit -m "Add Evolução screen: 1RM progression line chart + weekly volume bar charts"
```

---

## Task 4: Wire the Evolução tab into `js/app.js`

**Files:**
- Modify: `js/app.js:1-8` (imports), `js/app.js:29-50` (`renderTab` branches)

**Interfaces:**
- Consumes: `montarTelaEvolucao(db) => Promise<HTMLElement>` from Task 3.

- [ ] **Step 1: Add the import**

In `js/app.js`, after the existing `import { montarTelaConfig } from "./screens/config.js";` line, add:

```javascript
import { montarTelaEvolucao } from "./screens/evolucao.js";
```

- [ ] **Step 2: Add the `renderTab` branch**

In `js/app.js`, inside `renderTab`, right before the line `content.textContent = \`Tela "${tabName}" ainda não implementada (vem depois).\`;`, add:

```javascript
      if (tabName === "evolucao") {
        content.textContent = "";
        content.appendChild(await montarTelaEvolucao(db));
        return;
      }
```

The final `try` block in `renderTab` should now read:

```javascript
    try {
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
      if (tabName === "config") {
        content.textContent = "";
        content.appendChild(await montarTelaConfig(db, {
          onAbrirBiblioteca: async () => {
            content.textContent = "";
            content.appendChild(await montarTelaBiblioteca(db, { aoVoltar: () => renderTab("config") }));
          },
        }));
        return;
      }
      if (tabName === "evolucao") {
        content.textContent = "";
        content.appendChild(await montarTelaEvolucao(db));
        return;
      }
      content.textContent = `Tela "${tabName}" ainda não implementada (vem depois).`;
    } catch (err) {
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — `app.js` has no dedicated tests (it's the bootstrap/shell, consistent with the rest of the project), so this step just guards against an accidental syntax error breaking module resolution elsewhere.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "Wire Evolução tab to montarTelaEvolucao"
```

---

## Task 5: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 2 new files to `APP_SHELL`, bump the cache version**

Add these entries anywhere in the `APP_SHELL` array:
```javascript
  "./js/engine/graficos.js",
  "./js/screens/evolucao.js",
```
Change `const CACHE_NAME = "app-treino-shell-v4";` to `const CACHE_NAME = "app-treino-shell-v5";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 64 pre-existing tests (from Nível 1a/1b/2a) plus 10 new tests from Tasks 1–2 of this plan, all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add Evolução files to service worker cache list, bump to v5"
```

---

## Task 6: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS (pre-existing suite + this plan's 10 new tests).

- [ ] **Step 2: Verify the empty state**

If starting from a database with no `historicoSeries` rows (a fresh seed), open the Evolução tab and confirm it shows `"Sem treinos registrados ainda."` and nothing else — no broken `<select>`, no empty SVG.

- [ ] **Step 3: Log some sets, then verify the 1RM progression chart**

Go to Treino, log at least 2 sets on the same exercise across at least 2 different days (or 2 sets on the same day with different carga/reps, which is enough to exercise the per-day-max logic even if the "different days" part can't be tested live in one sitting). Open Evolução: confirm the `<select>` lists only exercises with at least one logged set, confirm the line chart renders with a point per day, confirm switching the `<select>` redraws the chart for the newly selected exercise, confirm hovering isn't required to read anything (numbers aren't shown on hover-only — this v1 has no tooltips, that's expected per the spec).

- [ ] **Step 4: Verify the weekly volume chart**

Confirm at least one "Volume semanal — <músculo>" card renders below the progression chart, with a bar chart whose bars are readable (not zero-height, not overflowing the card). Confirm a muscle group with no logged sets does NOT get a card.

- [ ] **Step 5: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (including the new Evolução tab) still loads and renders fully from cache with the service worker active.

- [ ] **Step 6: Report result to the user**

Show the working progression chart and weekly volume chart. Note that medidas corporais, calendário, and estatísticas de sessão (the other three Nível 2b slices) are still unplanned and need their own spec/plan cycles.
