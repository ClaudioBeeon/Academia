# Nível 1b — Biblioteca, Histórico e Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the rest of Nível 1: an editable exercise library, per-exercise history reachable in one tap from the Treino screen, and JSON/CSV export-import — plus three data-layer hardenings the Nível 1a final review parked as "fix as part of 1b's first task" (index-backed queries instead of full-table scans, a warm-up-set filter in the load-suggestion sample query, and a `serieNumero` field so sets survive reordering/history display correctly).

**Architecture:** `js/data/db.js` gains one new primitive (`getAllByIndex`) that every other data-layer function this plan touches builds on. `js/data/historico.js` is rewritten to use it. A new `js/data/exportImport.js` handles the whole-database JSON snapshot and a CSV projection of `historicoSeries`. Two new screens (`js/screens/biblioteca.js`, `js/screens/historico.js`) join `js/screens/treino.js`; navigation between them is callback-based (no router) — `js/app.js` owns which screen is mounted and passes each screen the callback it needs to navigate onward or back.

**Tech Stack:** Same as Nível 1a — vanilla JS ES modules, no build step, `node --test`, tokens from `css/tokens.css`.

**Spec:** `docs/superpowers/specs/2026-08-19-app-treino-design.md`. Navigation decision (confirmed with user 2026-08-20): Biblioteca and Exportar/Importar live inside the **Config** tab, not as new bottom tabs. Histórico opens from a link on each exercise card in Treino, with a "voltar" button back to Treino.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — untouched by this plan.
- Visual tokens come from `css/tokens.css`; no ad-hoc colors in new screen code.
- Any string sourced from IndexedDB (exercise names, observações) that could plausibly become user-edited must be rendered via `.textContent`, never interpolated into `innerHTML` — this plan is exactly the moment `exercicios.json`'s trusted-seed assumption from Nível 1a stops holding, since Biblioteca makes exercises user-editable.
- `historicoSeries` records must never be deleted or rewritten by anything except explicit user action (import restore) — the spec's "histórico de treino nunca é reescrito" guarantee.

---

## Task 1: Index-backed historico.js + serieNumero + warm-up filter

**Files:**
- Modify: `js/data/db.js`
- Modify: `js/data/historico.js`
- Modify: `js/data/historico.test.js`

**Interfaces:**
- Produces (new, in `db.js`): `getAllByIndex(db, storeName, indexName, key): Promise<any[]>`
- Produces (rewritten, in `historico.js`):
  - `registrarSerie(db, serie)` — unchanged signature, `serie` now expected to carry a `serieNumero` field (caller's responsibility, enforced starting Task 2)
  - `getSeriesDoExercicioNaData(db, exercicioId, data): Promise<serie[]>` — now sorted by `serieNumero` ascending
  - `getUltimaSerieAnterior(db, exercicioId, dataAtual): Promise<serie|null>` — tie-break by `id` descending when dates match
  - `getAmostrasRecentesDoExercicio(db, exercicioId, limite=5)` — now excludes `tipoSerie === "aquecimento"` rows
  - `getHistoricoCompletoDoExercicio(db, exercicioId): Promise<serie[]>` — **new**, all sets for one exercise across all dates, most-recent-first (consumed by Task 5's history screen)

- [ ] **Step 1: Write the failing test additions**

Add to `js/data/historico.test.js` (keep the 4 existing tests unchanged):

```javascript
test("getAmostrasRecentesDoExercicio exclui séries de aquecimento", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "e", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "aquecimento", carga: 8, reps: 12, rir: 5, serieNumero: 0 });
  await registrarSerie(db, { exercicioId: "e", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2, serieNumero: 1 });

  const amostras = await getAmostrasRecentesDoExercicio(db, "e");
  assert.equal(amostras.length, 1);
  assert.equal(amostras[0].carga, 14);
  db.close();
});

test("getSeriesDoExercicioNaData ordena por serieNumero", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "f", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2, serieNumero: 2 });
  await registrarSerie(db, { exercicioId: "f", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 15, reps: 9, rir: 2, serieNumero: 1 });

  const series = await getSeriesDoExercicioNaData(db, "f", "2026-08-10");
  assert.deepEqual(series.map((s) => s.serieNumero), [1, 2]);
  db.close();
});

test("getHistoricoCompletoDoExercicio retorna todas as séries, mais recente primeiro", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "g", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 3, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "g", data: "2026-08-08", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 2, serieNumero: 1 });

  const historico = await getHistoricoCompletoDoExercicio(db, "g");
  assert.equal(historico.length, 2);
  assert.equal(historico[0].data, "2026-08-08");
  db.close();
});
```

Also add this import line update at the top of the file (the existing imports stay, add the new function name):
```javascript
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio } from "./historico.js";
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test js/data/historico.test.js`
Expected: FAIL — `getHistoricoCompletoDoExercicio` not exported yet; existing behavior may also not match new sort/filter expectations.

- [ ] **Step 3: Add `getAllByIndex` to `js/data/db.js`**

Add this export (do not modify anything else in the file):

```javascript
export function getAllByIndex(db, storeName, indexName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).index(indexName).getAll(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4: Rewrite `js/data/historico.js`**

```javascript
// js/data/historico.js
import { put, getAllByIndex } from "./db.js";

export function registrarSerie(db, serie) {
  return put(db, "historicoSeries", serie);
}

export async function getSeriesDoExercicioNaData(db, exercicioId, data) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  return doExercicio
    .filter((s) => s.data === data)
    .sort((a, b) => (a.serieNumero ?? 0) - (b.serieNumero ?? 0));
}

export async function getUltimaSerieAnterior(db, exercicioId, dataAtual) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  const anteriores = doExercicio
    .filter((s) => s.data < dataAtual)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  return anteriores.length > 0 ? anteriores[0] : null;
}

export async function getAmostrasRecentesDoExercicio(db, exercicioId, limite = 5) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  return doExercicio
    .filter((s) => s.tipoSerie !== "aquecimento")
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .slice(0, limite)
    .map((s) => ({ carga: s.carga, reps: s.reps, rir_relatado: s.rir }));
}

export async function getHistoricoCompletoDoExercicio(db, exercicioId) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  return doExercicio.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
}
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `node --test js/data/historico.test.js`
Expected: PASS (7 tests: 4 existing + 3 new)

- [ ] **Step 6: Commit**

```bash
git add js/data/db.js js/data/historico.js js/data/historico.test.js
git commit -m "Index-backed historico queries, aquecimento filter, serieNumero sort"
```

---

## Task 2: Wire serieNumero + "Histórico" link into Treino screen

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `getHistoricoCompletoDoExercicio` is NOT used here (that's Task 5's job) — this task only adds a callback hook.
- Produces: `montarTelaTreino(db, { onAbrirHistorico } = {})` — signature gains an optional second parameter. `onAbrirHistorico(exercicio)` is called when the user taps "Histórico" on an exercise card. When not provided, the button still renders but does nothing (defensive default so the function doesn't crash if a future caller forgets to wire it — but Task 7 always provides it).

- [ ] **Step 1: Replace the ENTIRE contents of `js/screens/treino.js` with:**

```javascript
// js/screens/treino.js
import { get, getAll } from "../data/db.js";
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio } from "../data/historico.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { criarCronometro } from "./timer.js";

const CONFIG_PADRAO = { repsMin: 8, repsMax: 12, rirAlvo: 2, descansoSegundos: 90 };

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterConfigExercicio(protocolo, exercicio) {
  const config = protocolo?.tiposDeExercicio?.[exercicio.tipo];
  if (!config) return CONFIG_PADRAO;
  return {
    repsMin: config.faixaRepeticoes.min,
    repsMax: config.faixaRepeticoes.max,
    rirAlvo: (config.rirAlvo.min + config.rirAlvo.max) / 2,
    descansoSegundos: config.descansoSegundos.min,
  };
}

export async function montarTelaTreino(db, { onAbrirHistorico } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
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
    const card = await montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico);
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
    <div class="rest-ctl"><button type="button" data-action="menos">−30s</button><button type="button" data-action="mais">+30s</button></div>
  `;
  return div;
}

async function montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico) {
  const cfg = obterConfigExercicio(protocolo, exercicio);
  const seriesHoje = await getSeriesDoExercicioNaData(db, exercicio.id, hoje);
  const ultimaAnterior = await getUltimaSerieAnterior(db, exercicio.id, hoje);
  const amostras = await getAmostrasRecentesDoExercicio(db, exercicio.id);
  const sugestao = sugerirCarga(amostras, cfg.rirAlvo);

  const card = document.createElement("section");
  card.className = "exercise-card";

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `
    <div>
      <div class="exercise-name"></div>
      <div class="exercise-meta">${cfg.repsMin}–${cfg.repsMax} reps · RIR ${cfg.rirAlvo}</div>
    </div>
    <div style="display:flex; gap:6px;">
      <button class="swap-pill history-pill" type="button">Histórico</button>
      <button class="swap-pill trocar-pill" type="button">Trocar</button>
    </div>
  `;
  head.querySelector(".exercise-name").textContent = exercicio.nome;
  card.appendChild(head);

  const setsContainer = document.createElement("div");
  setsContainer.className = "sets";
  card.appendChild(setsContainer);

  const placeholderCarga = sugestao.cargaSugerida != null
    ? `${sugestao.cargaSugerida} kg`
    : (ultimaAnterior ? `${ultimaAnterior.carga} kg` : "—");
  const placeholderReps = ultimaAnterior ? String(ultimaAnterior.reps) : String(cfg.repsMin);

  const totalSeriesAlvo = 3;
  for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
    const jaFeita = seriesHoje[numero - 1];
    setsContainer.appendChild(criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps, rirAlvo: cfg.rirAlvo }));
    if (numero < totalSeriesAlvo) {
      setsContainer.appendChild(criarPlaceholderDescanso());
    }
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
    const rirInput = linha.querySelector('[name="rir"]').value;
    const rirDigitado = Number(rirInput);
    if (!carga || !reps) return;

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

    linha.classList.add("done");
    linha.querySelectorAll("input").forEach((input) => (input.disabled = true));
    const ring = linha.querySelector(".set-ring");
    if (ring) {
      const marcado = document.createElement("div");
      marcado.className = "set-ring";
      marcado.innerHTML = "<i>✓</i>";
      ring.replaceWith(marcado);
    }

    const restBar = linha.nextElementSibling && linha.nextElementSibling.classList.contains("rest-bar")
      ? linha.nextElementSibling
      : card.nextElementSibling;
    iniciarDescanso(restBar, cfg.descansoSegundos);
  });

  card.querySelector(".trocar-pill").addEventListener("click", () => {
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios);
    const nomes = sugestoes.map((e) => e.nome).join(", ") || "nenhuma alternativa encontrada";
    alert(`Alternativas: ${nomes}`);
  });

  card.querySelector(".history-pill").addEventListener("click", () => {
    if (onAbrirHistorico) onAbrirHistorico(exercicio);
  });

  return card;
}

function criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps, rirAlvo }) {
  const form = document.createElement("form");
  form.className = "set-row" + (jaFeita ? " done" : "");
  form.dataset.numero = String(numero);
  const ringHtml = jaFeita
    ? `<div class="set-ring"><i>✓</i></div>`
    : `<button type="submit" class="set-ring" aria-label="Marcar série ${numero} concluída"><i>${numero}</i></button>`;
  form.innerHTML = `
    ${ringHtml}
    <div class="set-field"><label>Carga</label><input name="carga" type="number" step="0.5" placeholder="${placeholderCarga}" value="${jaFeita ? jaFeita.carga : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>Reps</label><input name="reps" type="number" placeholder="${placeholderReps}" value="${jaFeita ? jaFeita.reps : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>RIR</label><input name="rir" type="number" step="0.5" placeholder="${rirAlvo}" value="${jaFeita ? jaFeita.rir : ""}" ${jaFeita ? "disabled" : ""} /></div>
  `;
  return form;
}

function iniciarDescanso(restBar, descansoSegundos) {
  if (!restBar || !restBar.classList || !restBar.classList.contains("rest-bar")) return;

  restBar.classList.remove("rest-bar-hidden");
  const timeEl = restBar.querySelector(".time");

  const cronometro = criarCronometro({
    duracaoInicialSegundos: descansoSegundos,
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

Changes from the Nível 1a version: `montarTelaTreino`/`montarCardExercicio` gain the `onAbrirHistorico` parameter; the head markup now has two distinctly-classed buttons (`.history-pill`, `.trocar-pill`) instead of one `.swap-pill`; `criarLinhaSerie` stamps `form.dataset.numero`; the `registrarSerie` payload gains `serieNumero`.

- [ ] **Step 2: Self-review**

Read the whole file back. Confirm: `montarTelaTreino`'s new second parameter has a default `{}` so calling it with just `(db)` (as any stray old caller would) doesn't throw. Confirm both `.trocar-pill` and `.history-pill` have their own listeners, no ambiguous `.swap-pill` selector collisions. Confirm `serieNumero` is a `Number(...)`, not a string, in the object passed to `registrarSerie`.

- [ ] **Step 3: Commit**

```bash
git add js/screens/treino.js
git commit -m "Add serieNumero to logged sets and a Histórico link per exercise"
```

---

## Task 3: Export/Import module (`js/data/exportImport.js`)

**Files:**
- Create: `js/data/exportImport.js`
- Test: `js/data/exportImport.test.js`

**Interfaces:**
- Produces:
  - `exportarTudo(db): Promise<{ versao: string, exportadoEm: string, dados: Record<string, any[]> }>` — dumps every user-data store (`perfil`, `protocolo`, `exercicios`, `dietaBase`, `historicoSeries`, `cargas`, `registrosDiarios`, `config`) into one plain object.
  - `importarTudo(db, backup): Promise<{ restaurado: boolean }>` — clears and repopulates each store present in `backup.dados`. Throws `Error("Arquivo de backup inválido.")` if `backup` isn't shaped as `exportarTudo` produces.
  - `historicoParaCsv(historicoSeries: array): string` — pure function, no DB access, converts an array of `historicoSeries` records into a CSV string with header `data,exercicioId,musculo,tipoSerie,carga,reps,rir,serieNumero`.

- [ ] **Step 1: Write the failing test**

```javascript
// js/data/exportImport.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, put, getAll } from "./db.js";
import { exportarTudo, importarTudo, historicoParaCsv } from "./exportImport.js";

test("exportarTudo dumps every user-data store", async () => {
  const db = await openDatabase();
  await put(db, "exercicios", { id: "a", nome: "A" });
  await put(db, "historicoSeries", { exercicioId: "a", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2, serieNumero: 1 });

  const backup = await exportarTudo(db);
  assert.equal(backup.dados.exercicios.length, 1);
  assert.equal(backup.dados.historicoSeries.length, 1);
  assert.ok(backup.exportadoEm);
  db.close();
});

test("importarTudo restaura os dados exportados em um banco vazio", async () => {
  const dbOrigem = await openDatabase();
  await put(dbOrigem, "exercicios", { id: "b", nome: "B" });
  const backup = await exportarTudo(dbOrigem);
  dbOrigem.close();

  const dbDestino = await openDatabase();
  await importarTudo(dbDestino, backup);
  const exercicios = await getAll(dbDestino, "exercicios");
  assert.equal(exercicios.length, 1);
  assert.equal(exercicios[0].nome, "B");
  dbDestino.close();
});

test("importarTudo rejeita um objeto que não é um backup válido", async () => {
  const db = await openDatabase();
  await assert.rejects(() => importarTudo(db, { foo: "bar" }), /Arquivo de backup inválido/);
  db.close();
});

test("historicoParaCsv gera cabeçalho e uma linha por série", () => {
  const csv = historicoParaCsv([
    { data: "2026-08-01", exercicioId: "a", musculo: "peito", tipoSerie: "normal", carga: 14, reps: 10, rir: 2, serieNumero: 1 },
  ]);
  const linhas = csv.split("\n");
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0], "data,exercicioId,musculo,tipoSerie,carga,reps,rir,serieNumero");
  assert.equal(linhas[1], "2026-08-01,a,peito,normal,14,10,2,1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/data/exportImport.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/data/exportImport.js`**

```javascript
// js/data/exportImport.js
import { getAll, put, clearStore } from "./db.js";

const STORES_EXPORTAVEIS = [
  "perfil", "protocolo", "exercicios", "dietaBase",
  "historicoSeries", "cargas", "registrosDiarios", "config",
];

export async function exportarTudo(db) {
  const dados = {};
  for (const nome of STORES_EXPORTAVEIS) {
    dados[nome] = await getAll(db, nome);
  }
  return { versao: "1.0", exportadoEm: new Date().toISOString(), dados };
}

export async function importarTudo(db, backup) {
  if (!backup || typeof backup !== "object" || !backup.dados || typeof backup.dados !== "object") {
    throw new Error("Arquivo de backup inválido.");
  }
  for (const nome of STORES_EXPORTAVEIS) {
    const registros = backup.dados[nome];
    if (!Array.isArray(registros)) continue;
    await clearStore(db, nome);
    for (const registro of registros) {
      await put(db, nome, registro);
    }
  }
  return { restaurado: true };
}

export function historicoParaCsv(historicoSeries) {
  const cabecalho = "data,exercicioId,musculo,tipoSerie,carga,reps,rir,serieNumero";
  const linhas = historicoSeries.map((s) =>
    [s.data, s.exercicioId, s.musculo, s.tipoSerie, s.carga, s.reps, s.rir, s.serieNumero ?? ""].join(",")
  );
  return [cabecalho, ...linhas].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/data/exportImport.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/data/exportImport.js js/data/exportImport.test.js
git commit -m "Add whole-database JSON export/import and CSV projection"
```

---

## Task 4: Biblioteca de Exercícios screen (`js/screens/biblioteca.js`)

**Files:**
- Create: `js/screens/biblioteca.js`
- Test: none (DOM-heavy, verified manually in Task 9, per Nível 1a's precedent for `treino.js`)

**Interfaces:**
- Consumes: `getAll`, `put` from `../data/db.js`
- Produces: `montarTelaBiblioteca(db, { aoVoltar } = {}): Promise<HTMLElement>` — a list of every exercise (editable observação de execução) plus a form to add a custom exercise. `aoVoltar` is optional; when provided, a "← Voltar" button calls it (Config screen provides it in Task 7).

- [ ] **Step 1: Write `js/screens/biblioteca.js`**

```javascript
// js/screens/biblioteca.js
import { getAll, put } from "../data/db.js";

export async function montarTelaBiblioteca(db, { aoVoltar } = {}) {
  const root = document.createElement("div");
  root.className = "tela-biblioteca";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Config</div><div class="day-title">Biblioteca de exercícios</div>`;
  root.appendChild(header);

  if (aoVoltar) {
    const voltar = document.createElement("button");
    voltar.type = "button";
    voltar.className = "swap-pill";
    voltar.style.margin = "12px 0 0";
    voltar.textContent = "← Voltar";
    voltar.addEventListener("click", aoVoltar);
    root.appendChild(voltar);
  }

  const main = document.createElement("main");
  root.appendChild(main);

  const exercicios = await getAll(db, "exercicios");
  exercicios.sort((a, b) => a.nome.localeCompare(b.nome));
  for (const exercicio of exercicios) {
    main.appendChild(criarLinhaExercicio(db, exercicio));
  }

  main.appendChild(criarFormNovoExercicio(db, main));

  return root;
}

function criarLinhaExercicio(db, exercicio) {
  const card = document.createElement("section");
  card.className = "exercise-card";

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `
    <div>
      <div class="exercise-name"></div>
      <div class="exercise-meta"></div>
    </div>
    <button class="swap-pill editar-pill" type="button">Editar</button>
  `;
  head.querySelector(".exercise-name").textContent = exercicio.nome;
  head.querySelector(".exercise-meta").textContent = `${exercicio.musculoPrimario} · ${exercicio.tipo}`;
  card.appendChild(head);

  const obsForm = document.createElement("form");
  obsForm.className = "sets";
  obsForm.style.display = "none";
  obsForm.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Observações de execução</label>
      <textarea name="obs" rows="2" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;"></textarea>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
  `;
  obsForm.querySelector("textarea").value = exercicio.observacoesExecucao ?? "";
  card.appendChild(obsForm);

  head.querySelector(".editar-pill").addEventListener("click", () => {
    obsForm.style.display = obsForm.style.display === "none" ? "flex" : "none";
  });

  obsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    exercicio.observacoesExecucao = obsForm.querySelector("textarea").value;
    await put(db, "exercicios", exercicio);
    obsForm.style.display = "none";
  });

  return card;
}

function criarFormNovoExercicio(db, main) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Novo exercício</div></div>`;

  const form = document.createElement("form");
  form.className = "sets";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;"><label>Nome</label><input name="nome" required style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" /></div>
    <div class="set-field"><label>Músculo primário</label><input name="musculo" required placeholder="peito" style="width:100%;" /></div>
    <div class="set-field"><label>Tipo</label><input name="tipo" required placeholder="isolador" style="width:100%;" /></div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Adicionar</button>
  `;
  card.appendChild(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nome = form.nome.value.trim();
    const musculo = form.musculo.value.trim();
    const tipo = form.tipo.value.trim();
    if (!nome || !musculo || !tipo) return;

    const novo = {
      id: `custom_${Date.now()}`,
      nome,
      musculoPrimario: musculo,
      musculosSecundarios: [],
      tipo,
      equipamento: "",
      cargaAlongada: false,
      incrementoMinimo_kg: 1,
      observacoesExecucao: "",
    };
    await put(db, "exercicios", novo);
    form.reset();
    main.insertBefore(criarLinhaExercicio(db, novo), card);
  });

  return card;
}
```

- [ ] **Step 2: Self-review**

Read the file back. Confirm `exercicio.nome` and `observacoesExecucao` are set via `.textContent`/`.value` assignment, never interpolated into a template-string `innerHTML` (this is the plan's own hardening rule — exercises are now user-editable). Confirm the new-exercise `id` (`custom_${Date.now()}`) can't collide with the seeded `exercicios.json` ids (all of which use `snake_case` names, not a `custom_` prefix with a timestamp).

- [ ] **Step 3: Commit**

```bash
git add js/screens/biblioteca.js
git commit -m "Add editable exercise library screen"
```

---

## Task 5: Histórico por exercício screen (`js/screens/historico.js`)

**Files:**
- Create: `js/screens/historico.js`
- Test: none (DOM-heavy, verified manually in Task 9)

**Interfaces:**
- Consumes: `getHistoricoCompletoDoExercicio` from `../data/historico.js` (Task 1)
- Produces: `montarTelaHistorico(db, exercicio, aoVoltar): Promise<HTMLElement>` — grouped-by-date list of every logged set for one exercise, most-recent-first, with a "← Voltar ao treino" button.

- [ ] **Step 1: Write `js/screens/historico.js`**

```javascript
// js/screens/historico.js
import { getHistoricoCompletoDoExercicio } from "../data/historico.js";

export async function montarTelaHistorico(db, exercicio, aoVoltar) {
  const root = document.createElement("div");
  root.className = "tela-historico";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Histórico</div><div class="day-title"></div>`;
  header.querySelector(".day-title").textContent = exercicio.nome;
  root.appendChild(header);

  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "swap-pill";
  voltar.style.margin = "12px 0 0";
  voltar.textContent = "← Voltar ao treino";
  voltar.addEventListener("click", aoVoltar);
  root.appendChild(voltar);

  const main = document.createElement("main");
  root.appendChild(main);

  const series = await getHistoricoCompletoDoExercicio(db, exercicio.id);

  if (series.length === 0) {
    main.innerHTML = `<p class="vazio">Nenhum registro ainda para este exercício.</p>`;
    return root;
  }

  const porData = new Map();
  for (const serie of series) {
    if (!porData.has(serie.data)) porData.set(serie.data, []);
    porData.get(serie.data).push(serie);
  }

  for (const [data, setsDoDia] of porData) {
    const card = document.createElement("section");
    card.className = "exercise-card";

    const head = document.createElement("div");
    head.className = "exercise-head";
    head.innerHTML = `<div class="exercise-name"></div>`;
    head.querySelector(".exercise-name").textContent = data;
    card.appendChild(head);

    const lista = document.createElement("div");
    lista.className = "sets";
    for (const serie of setsDoDia) {
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.style.padding = "8px 18px";
      linha.innerHTML = `<b>${serie.carga} kg × ${serie.reps}</b>, RIR ${serie.rir}`;
      lista.appendChild(linha);
    }
    card.appendChild(lista);
    main.appendChild(card);
  }

  return root;
}
```

(`serie.carga`/`serie.reps`/`serie.rir` are numbers from IndexedDB, not user-controllable strings — safe to interpolate. Only `exercicio.nome` needed the `.textContent` treatment, and it got it above.)

- [ ] **Step 2: Self-review**

Read the file back. Confirm `porData` grouping preserves the most-recent-first order `getHistoricoCompletoDoExercicio` already returns (JS `Map` iterates insertion order, and insertion order here follows the already-sorted `series` array — so yes).

- [ ] **Step 3: Commit**

```bash
git add js/screens/historico.js
git commit -m "Add per-exercise history screen"
```

---

## Task 6: Config screen (`js/screens/config.js`)

**Files:**
- Create: `js/screens/config.js`
- Test: none (DOM-heavy, verified manually in Task 9)

**Interfaces:**
- Consumes: `exportarTudo`, `importarTudo`, `historicoParaCsv` from `../data/exportImport.js`; `getAll` from `../data/db.js`
- Produces: `montarTelaConfig(db, { onAbrirBiblioteca } = {}): Promise<HTMLElement>` — links to Biblioteca, "Exportar JSON", "Exportar CSV do histórico", and a file-input-based "Importar backup".

- [ ] **Step 1: Write `js/screens/config.js`**

```javascript
// js/screens/config.js
import { exportarTudo, importarTudo, historicoParaCsv } from "../data/exportImport.js";
import { getAll } from "../data/db.js";

export async function montarTelaConfig(db, { onAbrirBiblioteca } = {}) {
  const root = document.createElement("div");
  root.className = "tela-config";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Configurações</div><div class="day-title">Config</div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  main.appendChild(criarLinkAcao("Biblioteca de exercícios", () => {
    if (onAbrirBiblioteca) onAbrirBiblioteca();
  }));

  main.appendChild(criarLinkAcao("Exportar backup (JSON)", async () => {
    const backup = await exportarTudo(db);
    baixarArquivo(`backup-app-treino-${dataDeHoje()}.json`, JSON.stringify(backup, null, 2), "application/json");
  }));

  main.appendChild(criarLinkAcao("Exportar histórico (CSV)", async () => {
    const historicoSeries = await getAll(db, "historicoSeries");
    baixarArquivo(`historico-${dataDeHoje()}.csv`, historicoParaCsv(historicoSeries), "text/csv");
  }));

  const importCard = document.createElement("section");
  importCard.className = "exercise-card";
  importCard.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Importar backup (JSON)</div></div>
    <div class="sets" style="padding: 0 18px 18px;">
      <input type="file" accept="application/json" class="import-input" style="width:100%; color:var(--ink);" />
      <div class="prev-hint import-status"></div>
    </div>
  `;
  const input = importCard.querySelector(".import-input");
  const status = importCard.querySelector(".import-status");
  input.addEventListener("change", async () => {
    const arquivo = input.files[0];
    if (!arquivo) return;
    try {
      const texto = await arquivo.text();
      const backup = JSON.parse(texto);
      await importarTudo(db, backup);
      status.textContent = "Backup importado com sucesso. Recarregue o app para ver os dados.";
    } catch (err) {
      console.error("Falha ao importar backup:", err);
      status.textContent = "Não foi possível importar este arquivo — confirme que é um backup exportado por este app.";
    }
  });
  main.appendChild(importCard);

  return root;
}

function criarLinkAcao(texto, aoClicar) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `<div class="exercise-name"></div><button class="swap-pill" type="button">Abrir</button>`;
  head.querySelector(".exercise-name").textContent = texto;
  head.querySelector(".swap-pill").addEventListener("click", aoClicar);
  card.appendChild(head);
  return card;
}

function baixarArquivo(nomeArquivo, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

function dataDeHoje() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Self-review**

Read the file back. Confirm `criarLinkAcao`'s `texto` parameter (always a hardcoded string from this file, never DB-sourced) uses `.textContent` anyway for consistency, even though it isn't strictly required for safety here.

- [ ] **Step 3: Commit**

```bash
git add js/screens/config.js
git commit -m "Add Config screen: biblioteca link, JSON/CSV export, JSON import"
```

---

## Task 7: Wire Biblioteca/Histórico/Config navigation into `js/app.js`

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `montarTelaBiblioteca` from `./screens/biblioteca.js`, `montarTelaHistorico` from `./screens/historico.js`, `montarTelaConfig` from `./screens/config.js`

- [ ] **Step 1: Edit `js/app.js`**

Read the current file first. Add the three new imports alongside the existing `montarTelaTreino` import:

```javascript
import { montarTelaTreino } from "./screens/treino.js";
import { montarTelaBiblioteca } from "./screens/biblioteca.js";
import { montarTelaHistorico } from "./screens/historico.js";
import { montarTelaConfig } from "./screens/config.js";
```

Replace the body of `renderTab`'s `try` block (currently: treino case + fallback placeholder) with:

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
      content.textContent = `Tela "${tabName}" ainda não implementada (vem depois).`;
    } catch (err) {
      console.error(`Falha ao renderizar a aba "${tabName}":`, err);
      content.textContent = "Não foi possível carregar esta tela. Tente novamente ou importe seu último backup nas Configurações.";
    }
```

Everything else in the file (`bootstrap`, the service worker registration, `openDatabase`/`seedIfNeeded` calls, the `tabs.forEach` click wiring, the final `bootstrap().catch(...)`) stays byte-identical.

- [ ] **Step 2: Self-review**

Read the file back in full. Confirm the `renderTab("treino")` and `renderTab("config")` calls used as back-navigation callbacks correctly close over the outer `renderTab` function (they do, since `onAbrirHistorico`/`onAbrirBiblioteca` are defined as arrow functions inside `renderTab`'s own closure, which itself is inside `renderShell`'s closure where `renderTab` is declared as a `const` before these nested callbacks reference it — verify this isn't a temporal-dead-zone issue: `renderTab` must already be fully assigned by the time any of these nested callbacks actually *run*, which they only do on a later click, long after the `const renderTab = async (tabName) => {...}` assignment completed. This is safe. Confirm you understand why before moving on, don't just take it on faith).

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "Wire Biblioteca/Histórico/Config screen navigation"
```

---

## Task 8: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 4 new files to `APP_SHELL`**

Read the current `sw.js`. Add these four entries to the `APP_SHELL` array (anywhere in the list is fine, keep the existing entries in place):
```javascript
  "./js/data/exportImport.js",
  "./js/screens/biblioteca.js",
  "./js/screens/historico.js",
  "./js/screens/config.js",
```

- [ ] **Step 2: Bump the cache version**

Change `const CACHE_NAME = "app-treino-shell-v2";` to `const CACHE_NAME = "app-treino-shell-v3";` — this is the same pattern used in the Nível 1a plan's final fix (forces the `activate` handler to delete the stale v2 cache and re-populate from scratch with the new file list).

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add Nível 1b files to service worker cache list, bump to v3"
```

---

## Task 9: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests from Task 1 and Task 3 (plus every pre-existing test from the foundation and Nível 1a plans) PASS.

- [ ] **Step 2: Use the `run` skill (or the already-running dev server) to verify the full flow**

- Open the Config tab. Confirm "Biblioteca de exercícios", "Exportar backup (JSON)", "Exportar histórico (CSV)", and "Importar backup (JSON)" all render.
- Tap "Biblioteca de exercícios" → confirm the 19 seeded exercises list, alphabetically sorted. Tap "Editar" on one, change its observação, save, confirm it persists on a fresh render. Add a new custom exercise via the form at the bottom, confirm it appears in the list immediately without a reload.
- Tap "← Voltar" → confirm it returns to the Config tab (not a blank screen).
- Go to the Treino tab, log a set on the first exercise, tap "Histórico" on that same exercise's card → confirm the just-logged set appears grouped under today's date. Tap "← Voltar ao treino" → confirm the Treino screen re-renders with the previously-logged set still marked done.
- Back in Config, tap "Exportar backup (JSON)" — confirm a file download is offered (check via `read_network_requests` or the browser's download list if the test harness exposes it; at minimum confirm no console error and that `exportarTudo` ran by checking the JS execution didn't throw).
- Verify no console errors throughout this entire flow via `read_console_messages`.

- [ ] **Step 3: Report result to the user**

Show the working Biblioteca/Histórico/Config screens before considering Nível 1 complete and moving to Nível 2.
