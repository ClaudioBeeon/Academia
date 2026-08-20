# Nível 2a — Calculadora de Anilhas, Aquecimento e Recordes Pessoais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The first slice of Nível 2 — three self-contained tools (plate calculator, warm-up ladder generator, personal-record detection) wired into the Treino screen. Graphs, body measurements/photos, supersets, calendar, and session stats are explicitly out of scope for this plan (Nível 2b).

**Architecture:** Three new pure `js/engine/*.js` modules (no DOM/IndexedDB/fetch, same discipline as every prior engine module). A small new data module (`js/data/equipamento.js`) stores bar weight and available plates as a single document in the existing `config` IndexedDB store — no new store needed. `js/screens/config.js` gains a settings form for that equipment. `js/screens/treino.js` gains a "Ferramentas" panel per exercise card (plate breakdown + warm-up ladder for the suggested load) and a toast on personal records.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, tokens from `css/tokens.css`.

**Spec:** `docs/superpowers/specs/2026-08-19-app-treino-design.md`. Feature requirements: original user prompt's "NÍVEL 2" section (calculadora de anilhas with configurable bar/plates, warm-up ladder from working weight, PR notification on carga/reps/1RM/volume).

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- Domain-engine modules (`js/engine/*.js`) stay pure — no DOM, no IndexedDB, no `fetch`.
- All engine functions return provenance where the pattern already established it (`principio`/`secao`) — `recordes.js` cites the spec's Nível 2 PR requirement since there's no numbered research-doc principle for it (same accepted-exception pattern as `cargas.js`/`substituicao.js`).
- Any string interpolated into `innerHTML` that originates from user input or IndexedDB must go through `.textContent` instead, per the hardening rule established in Nível 1b.
- The plate calculator must never assume a fixed bar weight or a fixed set of plates — both must be user-configurable (this was an explicit, named complaint about competing apps in the original spec).

---

## Task 1: Engine — Calculadora de anilhas (`js/engine/anilhas.js`)

**Files:**
- Create: `js/engine/anilhas.js`
- Test: `js/engine/anilhas.test.js`

**Interfaces:**
- Produces: `calcularAnilhas(pesoAlvo, pesoBarra, anilhasDisponiveis): { anilhasPorLado: number[], pesoPorLado: number, restante: number, atingivel: boolean }`
  `anilhasDisponiveis` is an array of plate weights in kg (e.g. `[20, 15, 10, 5, 2.5, 1.25]`), each assumed available in unlimited pairs. `restante` is the leftover kg per side that couldn't be matched exactly (0 when `atingivel` is true).

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/anilhas.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularAnilhas } from "./anilhas.js";

test("calcula as anilhas por lado para um peso alvo exato", () => {
  const resultado = calcularAnilhas(60, 20, [20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(resultado.anilhasPorLado, [20]);
  assert.equal(resultado.pesoPorLado, 20);
  assert.equal(resultado.restante, 0);
  assert.equal(resultado.atingivel, true);
});

test("combina anilhas diferentes quando uma só não fecha o peso", () => {
  const resultado = calcularAnilhas(47.5, 20, [20, 15, 10, 5, 2.5, 1.25]);
  // pesoPorLado = (47.5-20)/2 = 13.75 -> 10 + 2.5 + 1.25 = 13.75
  assert.deepEqual(resultado.anilhasPorLado, [10, 2.5, 1.25]);
  assert.equal(resultado.restante, 0);
  assert.equal(resultado.atingivel, true);
});

test("peso alvo igual ao peso da barra não precisa de anilhas", () => {
  const resultado = calcularAnilhas(20, 20, [20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(resultado.anilhasPorLado, []);
  assert.equal(resultado.atingivel, true);
});

test("peso alvo abaixo do peso da barra não é atingível", () => {
  const resultado = calcularAnilhas(15, 20, [20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(resultado.anilhasPorLado, []);
  assert.equal(resultado.atingivel, false);
});

test("peso que não fecha exatamente reporta o restante", () => {
  const resultado = calcularAnilhas(41, 20, [20, 15, 10]);
  // pesoPorLado = 10.5, só dá pra fechar 10, sobra 0.5
  assert.deepEqual(resultado.anilhasPorLado, [10]);
  assert.equal(resultado.restante, 0.5);
  assert.equal(resultado.atingivel, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/anilhas.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/anilhas.js`**

```javascript
// js/engine/anilhas.js
export function calcularAnilhas(pesoAlvo, pesoBarra, anilhasDisponiveis) {
  const pesoPorLado = (pesoAlvo - pesoBarra) / 2;

  if (pesoPorLado <= 0) {
    return { anilhasPorLado: [], pesoPorLado: 0, restante: 0, atingivel: pesoAlvo === pesoBarra };
  }

  const ordenadas = [...anilhasDisponiveis].sort((a, b) => b - a);
  let restante = pesoPorLado;
  const anilhasPorLado = [];

  for (const anilha of ordenadas) {
    while (restante >= anilha - 1e-9) {
      anilhasPorLado.push(anilha);
      restante -= anilha;
    }
  }

  const restanteArredondado = Math.round(restante * 100) / 100;
  return {
    anilhasPorLado,
    pesoPorLado,
    restante: restanteArredondado,
    atingivel: restanteArredondado < 0.01,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/anilhas.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/anilhas.js js/engine/anilhas.test.js
git commit -m "Add plate calculator engine (configurable bar and plate set)"
```

---

## Task 2: Engine — Gerador de aquecimento (`js/engine/aquecimento.js`)

**Files:**
- Create: `js/engine/aquecimento.js`
- Test: `js/engine/aquecimento.test.js`

**Interfaces:**
- Produces: `gerarEscadaAquecimento(pesoTrabalho, pesoBarra): Array<{ percentual: number, peso: number, reps: number }>`
  Steps at the bar only, ~50%, ~65%, ~80% of `pesoTrabalho`, per the spec's warm-up description — each step's `peso` rounded to the nearest 0.5kg, filtered to only include steps between the bar weight and the working weight.

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/aquecimento.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarEscadaAquecimento } from "./aquecimento.js";

test("gera a escada padrão (barra, 50%, 65%, 80%) para um peso de trabalho alto", () => {
  const escada = gerarEscadaAquecimento(60, 20);
  assert.equal(escada.length, 4);
  assert.equal(escada[0].peso, 20);
  assert.equal(escada[1].peso, 30);
  assert.equal(escada[2].peso, 39);
  assert.equal(escada[3].peso, 48);
});

test("arredonda cada passo para o meio quilo mais próximo", () => {
  const escada = gerarEscadaAquecimento(37, 20);
  for (const passo of escada) {
    assert.equal(passo.peso, Math.round(passo.peso * 2) / 2);
  }
});

test("descarta passos abaixo do peso da barra", () => {
  const escada = gerarEscadaAquecimento(22, 20);
  for (const passo of escada) {
    assert.ok(passo.peso >= 20);
  }
});

test("reps diminuem ao longo da escada", () => {
  const escada = gerarEscadaAquecimento(60, 20);
  for (let i = 1; i < escada.length; i++) {
    assert.ok(escada[i].reps <= escada[i - 1].reps);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/aquecimento.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/aquecimento.js`**

```javascript
// js/engine/aquecimento.js
function arredondarMeioKg(peso) {
  return Math.round(peso * 2) / 2;
}

export function gerarEscadaAquecimento(pesoTrabalho, pesoBarra = 20) {
  const passos = [
    { percentual: 0, peso: pesoBarra, reps: 10 },
    { percentual: 50, peso: pesoTrabalho * 0.5, reps: 8 },
    { percentual: 65, peso: pesoTrabalho * 0.65, reps: 5 },
    { percentual: 80, peso: pesoTrabalho * 0.8, reps: 3 },
  ];

  return passos
    .map((p) => ({ ...p, peso: arredondarMeioKg(p.peso) }))
    .filter((p) => p.peso >= pesoBarra && p.peso <= pesoTrabalho);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/aquecimento.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/aquecimento.js js/engine/aquecimento.test.js
git commit -m "Add warm-up ladder generator engine"
```

---

## Task 3: Engine — Detecção de recordes pessoais (`js/engine/recordes.js`)

**Files:**
- Create: `js/engine/recordes.js`
- Test: `js/engine/recordes.test.js`

**Interfaces:**
- Produces: `detectarPRs(novaSerie, seriesAnteriores): Array<{ tipo: string, mensagem: string, principio: string, secao: string }>`
  `novaSerie` is `{ carga, reps }`. `seriesAnteriores` is an array of `{ carga, reps }` from every previously-logged set of that exercise (any date, including earlier sets today). Detects up to four independent PR types: `carga` (heaviest ever), `reps` (most reps at that exact carga), `1rm` (highest Epley-estimated 1RM, `carga * (1 + reps/30)`, matching the formula already documented in `protocolo.json`/the research doc §22.2), `volume` (highest single-set `carga * reps`). Returns `[]` when no PR is hit, or one `{tipo: "primeira_serie", ...}` entry when `seriesAnteriores` is empty.

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/recordes.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarPRs } from "./recordes.js";

test("primeira série do exercício retorna um PR de primeira vez", () => {
  const prs = detectarPRs({ carga: 14, reps: 10 }, []);
  assert.equal(prs.length, 1);
  assert.equal(prs[0].tipo, "primeira_serie");
});

test("detecta PR de carga quando supera o máximo anterior", () => {
  const prs = detectarPRs(
    { carga: 16, reps: 8 },
    [{ carga: 14, reps: 10 }, { carga: 15, reps: 8 }]
  );
  assert.ok(prs.some((p) => p.tipo === "carga"));
});

test("detecta PR de reps na mesma carga", () => {
  const prs = detectarPRs(
    { carga: 14, reps: 12 },
    [{ carga: 14, reps: 10 }]
  );
  assert.ok(prs.some((p) => p.tipo === "reps"));
});

test("não detecta PR de reps se a carga nunca foi usada antes", () => {
  const prs = detectarPRs(
    { carga: 20, reps: 5 },
    [{ carga: 14, reps: 10 }]
  );
  assert.ok(!prs.some((p) => p.tipo === "reps"));
});

test("detecta PR de volume mesmo sem bater carga ou reps isoladamente", () => {
  const prs = detectarPRs(
    { carga: 14, reps: 11 },
    [{ carga: 14, reps: 10 }, { carga: 16, reps: 8 }]
  );
  assert.ok(prs.some((p) => p.tipo === "volume"));
});

test("série pior que tudo anteriormente registrado não gera nenhum PR", () => {
  const prs = detectarPRs(
    { carga: 10, reps: 5 },
    [{ carga: 14, reps: 10 }]
  );
  assert.deepEqual(prs, []);
});

test("cada PR carrega principio e secao", () => {
  const prs = detectarPRs({ carga: 16, reps: 8 }, [{ carga: 14, reps: 10 }]);
  for (const pr of prs) {
    assert.ok(pr.principio);
    assert.ok(pr.secao);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/recordes.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/recordes.js`**

```javascript
// js/engine/recordes.js
function estimativa1RM(serie) {
  return serie.carga * (1 + serie.reps / 30);
}

export function detectarPRs(novaSerie, seriesAnteriores) {
  const principio = "nivel2";
  const secao = "prompt-original";

  if (!seriesAnteriores || seriesAnteriores.length === 0) {
    return [{ tipo: "primeira_serie", mensagem: "Primeira vez registrando este exercício!", principio, secao }];
  }

  const prs = [];

  const maiorCargaAnterior = Math.max(...seriesAnteriores.map((s) => s.carga));
  if (novaSerie.carga > maiorCargaAnterior) {
    prs.push({ tipo: "carga", mensagem: `Novo recorde de carga: ${novaSerie.carga} kg!`, principio, secao });
  }

  const repsNaMesmaCarga = seriesAnteriores
    .filter((s) => s.carga === novaSerie.carga)
    .map((s) => s.reps);
  if (repsNaMesmaCarga.length > 0 && novaSerie.reps > Math.max(...repsNaMesmaCarga)) {
    prs.push({
      tipo: "reps",
      mensagem: `Novo recorde de repetições com ${novaSerie.carga} kg: ${novaSerie.reps}!`,
      principio,
      secao,
    });
  }

  const melhor1RMAnterior = Math.max(...seriesAnteriores.map(estimativa1RM));
  if (estimativa1RM(novaSerie) > melhor1RMAnterior) {
    const valor = Math.round(estimativa1RM(novaSerie) * 10) / 10;
    prs.push({ tipo: "1rm", mensagem: `Novo recorde estimado de 1RM: ${valor} kg!`, principio, secao });
  }

  const maiorVolumeAnterior = Math.max(...seriesAnteriores.map((s) => s.carga * s.reps));
  if (novaSerie.carga * novaSerie.reps > maiorVolumeAnterior) {
    prs.push({
      tipo: "volume",
      mensagem: `Novo recorde de volume nesta série: ${novaSerie.carga * novaSerie.reps} kg!`,
      principio,
      secao,
    });
  }

  return prs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/recordes.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/recordes.js js/engine/recordes.test.js
git commit -m "Add personal-record detection engine (carga/reps/1RM/volume)"
```

---

## Task 4: Data — Equipamento (`js/data/equipamento.js`)

**Files:**
- Create: `js/data/equipamento.js`
- Test: `js/data/equipamento.test.js`

**Interfaces:**
- Consumes: `get`, `put` from `./db.js`
- Produces:
  - `getEquipamento(db): Promise<{ chave: "equipamento", pesoBarra: number, anilhasDisponiveis: number[] }>` — returns the saved document, or a sane default (`pesoBarra: 20`, `anilhasDisponiveis: [20, 15, 10, 5, 2.5, 1.25]`) if none was ever saved. Stored in the existing `config` store (keyed by `"chave"`, same pattern as `seedVersion`) — no new IndexedDB store needed.
  - `salvarEquipamento(db, { pesoBarra, anilhasDisponiveis }): Promise<IDBValidKey>`

- [ ] **Step 1: Write the failing test**

```javascript
// js/data/equipamento.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { getEquipamento, salvarEquipamento } from "./equipamento.js";

test("getEquipamento retorna o padrão quando nada foi salvo ainda", async () => {
  const db = await openDatabase();
  const equipamento = await getEquipamento(db);
  assert.equal(equipamento.pesoBarra, 20);
  assert.deepEqual(equipamento.anilhasDisponiveis, [20, 15, 10, 5, 2.5, 1.25]);
  db.close();
});

test("salvarEquipamento grava e getEquipamento passa a retornar o valor salvo", async () => {
  const db = await openDatabase();
  await salvarEquipamento(db, { pesoBarra: 15, anilhasDisponiveis: [10, 5, 2.5] });
  const equipamento = await getEquipamento(db);
  assert.equal(equipamento.pesoBarra, 15);
  assert.deepEqual(equipamento.anilhasDisponiveis, [10, 5, 2.5]);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/data/equipamento.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/data/equipamento.js`**

```javascript
// js/data/equipamento.js
import { get, put } from "./db.js";

const PADRAO = {
  chave: "equipamento",
  pesoBarra: 20,
  anilhasDisponiveis: [20, 15, 10, 5, 2.5, 1.25],
};

export async function getEquipamento(db) {
  const salvo = await get(db, "config", "equipamento");
  return salvo ?? PADRAO;
}

export function salvarEquipamento(db, { pesoBarra, anilhasDisponiveis }) {
  return put(db, "config", { chave: "equipamento", pesoBarra, anilhasDisponiveis });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/data/equipamento.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add js/data/equipamento.js js/data/equipamento.test.js
git commit -m "Add equipamento data layer (bar weight, available plates)"
```

---

## Task 5: Config screen — seção de Equipamento

**Files:**
- Modify: `js/screens/config.js`

**Interfaces:**
- Consumes: `getEquipamento`, `salvarEquipamento` from `../data/equipamento.js`

- [ ] **Step 1: Edit `js/screens/config.js`**

Read the current file first. Add the import:
```javascript
import { getEquipamento, salvarEquipamento } from "../data/equipamento.js";
```

Add a new async function, and call it from `montarTelaConfig` right before the existing `importCard` block is appended:

```javascript
main.appendChild(await criarSecaoEquipamento(db));
```
(insert this line in `montarTelaConfig`, right before the `const importCard = ...` block — after the three `criarLinkAcao` appends, before the import card)

```javascript
async function criarSecaoEquipamento(db) {
  const equipamento = await getEquipamento(db);

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Equipamento (barra e anilhas)</div></div>`;

  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0 18px 18px";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Peso da barra (kg)</label>
      <input name="pesoBarra" type="number" step="0.5" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label>Anilhas disponíveis (kg, separadas por vírgula)</label>
      <input name="anilhas" type="text" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
    <div class="prev-hint equipamento-status" style="grid-column:1/-1;"></div>
  `;
  form.pesoBarra.value = equipamento.pesoBarra;
  form.anilhas.value = equipamento.anilhasDisponiveis.join(", ");
  card.appendChild(form);

  const status = form.querySelector(".equipamento-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pesoBarra = Number(form.pesoBarra.value);
    const anilhasDisponiveis = form.anilhas.value
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (!pesoBarra || anilhasDisponiveis.length === 0) {
      status.textContent = "Preencha o peso da barra e ao menos uma anilha válida.";
      return;
    }
    await salvarEquipamento(db, { pesoBarra, anilhasDisponiveis });
    status.textContent = "Salvo.";
  });

  return card;
}
```

- [ ] **Step 2: Self-review**

Read the file back. Confirm `criarSecaoEquipamento` is `async` (it awaits `getEquipamento`) and the call site awaits it too (`main.appendChild(await criarSecaoEquipamento(db))`). Confirm no exercise/equipment data is interpolated into `innerHTML` here — the static labels are literal strings, and the two dynamic values (`pesoBarra`, `anilhasDisponiveis`) are set via `.value` assignment, not string interpolation.

- [ ] **Step 3: Commit**

```bash
git add js/screens/config.js
git commit -m "Add equipment settings (bar weight, plates) to Config screen"
```

---

## Task 6: Treino screen — painel de ferramentas + toast de recorde

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `calcularAnilhas` from `../engine/anilhas.js`; `gerarEscadaAquecimento` from `../engine/aquecimento.js`; `detectarPRs` from `../engine/recordes.js`; `getEquipamento` from `../data/equipamento.js`; `getHistoricoCompletoDoExercicio` from `../data/historico.js` (already imported for other purposes via `historico.js` module, add this one function to the existing import line).

- [ ] **Step 1: Edit `js/screens/treino.js`**

Read the current file in full first (it already has `onAbrirHistorico`, `serieNumero`, local-date, protocolo-driven config, and the RIR/one-tap fixes from the two prior plans — all of that must survive untouched).

1. Update imports at the top:
```javascript
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio } from "../data/historico.js";
import { getEquipamento } from "../data/equipamento.js";
import { calcularAnilhas } from "../engine/anilhas.js";
import { gerarEscadaAquecimento } from "../engine/aquecimento.js";
import { detectarPRs } from "../engine/recordes.js";
```

2. In `montarTelaTreino`, fetch equipment once and thread it down:
```javascript
export async function montarTelaTreino(db, { onAbrirHistorico } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const exerciciosHoje = todosExercicios.filter((e) => e.musculoPrimario === "peito");
  // ... (root/header/main creation unchanged)
```
Change the `montarCardExercicio` call inside the loop to pass `equipamento`:
```javascript
const card = await montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico, equipamento);
```
And update `montarCardExercicio`'s signature to accept it:
```javascript
async function montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico, equipamento) {
```

3. Inside `montarCardExercicio`, after the existing `head` markup/listeners block (after the `.history-pill` listener, before `return card;`), add a "Ferramentas" panel:

```javascript
  const ferramentasPill = document.createElement("button");
  ferramentasPill.type = "button";
  ferramentasPill.className = "swap-pill";
  ferramentasPill.textContent = "Ferramentas";
  ferramentasPill.style.margin = "0 18px 12px";
  card.insertBefore(ferramentasPill, card.querySelector(".sets"));

  const painelFerramentas = document.createElement("div");
  painelFerramentas.className = "sets";
  painelFerramentas.style.display = "none";
  painelFerramentas.style.padding = "0 18px 12px";
  card.insertBefore(painelFerramentas, card.querySelector(".sets"));

  ferramentasPill.addEventListener("click", () => {
    const abrindo = painelFerramentas.style.display === "none";
    painelFerramentas.style.display = abrindo ? "flex" : "none";
    if (abrindo) {
      const pesoAlvo = sugestao.cargaSugerida ?? (ultimaAnterior ? ultimaAnterior.carga : equipamento.pesoBarra);
      const anilhas = calcularAnilhas(pesoAlvo, equipamento.pesoBarra, equipamento.anilhasDisponiveis);
      const aquecimento = gerarEscadaAquecimento(pesoAlvo, equipamento.pesoBarra);

      const textoAnilhas = anilhas.anilhasPorLado.length > 0
        ? `${anilhas.anilhasPorLado.join(" + ")} kg por lado`
        : "Sem anilhas — só a barra";
      const textoAquecimento = aquecimento
        .map((p) => `${p.peso} kg × ${p.reps}`)
        .join(" → ");

      painelFerramentas.innerHTML = `
        <div class="prev-hint" style="grid-column:1/-1;">
          <b>Anilhas para ${pesoAlvo} kg:</b> ${textoAnilhas}${anilhas.atingivel ? "" : ` (falta ${anilhas.restante} kg por lado)`}
        </div>
        <div class="prev-hint" style="grid-column:1/-1;">
          <b>Aquecimento:</b> ${textoAquecimento || "—"}
        </div>
      `;
    }
  });
```

(Note: `pesoAlvo`, `anilhas.anilhasPorLado`, `anilhas.restante`, `textoAquecimento` are all numbers/computed values, never raw exercise/user text — safe to interpolate.)

4. In the `setsContainer.addEventListener("submit", ...)` handler, fetch history BEFORE registering the new set (so it reflects everything performed up to but not including this new set), detect PRs, register, then show a toast if any PR was hit. Replace the handler body with:

```javascript
  setsContainer.addEventListener("submit", async (event) => {
    const linha = event.target.closest(".set-row");
    if (!linha) return;
    event.preventDefault();
    const carga = Number(linha.querySelector('[name="carga"]').value);
    const reps = Number(linha.querySelector('[name="reps"]').value);
    const rirInput = linha.querySelector('[name="rir"]').value;
    const rirDigitado = Number(rirInput);
    if (!carga || !reps) return;

    const seriesAnteriores = await getHistoricoCompletoDoExercicio(db, exercicio.id);
    const prs = detectarPRs({ carga, reps }, seriesAnteriores.map((s) => ({ carga: s.carga, reps: s.reps })));

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

    const prsRelevantes = prs.filter((p) => p.tipo !== "primeira_serie");
    if (prsRelevantes.length > 0) {
      mostrarToastPR(prsRelevantes);
    }
  });
```

5. Add a new module-level helper function (place it after `iniciarDescanso`, at the end of the file):

```javascript
function mostrarToastPR(prs) {
  const toast = document.createElement("div");
  toast.className = "rest-bar";
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = "108px";
  toast.style.transform = "translateX(-50%)";
  toast.style.width = "calc(100% - 44px)";
  toast.style.maxWidth = "398px";
  toast.style.zIndex = "10";
  toast.innerHTML = `<div><div class="label">🏆 Recorde pessoal</div><div class="time" style="font-size:1rem;">${prs.map((p) => p.mensagem).join(" ")}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
```
(The PR messages are all built from numbers inside `recordes.js`, never raw user/DB text — safe to interpolate here too.)

- [ ] **Step 2: Self-review**

Read the whole file back. Confirm: `equipamento` is fetched once in `montarTelaTreino` and threaded through, not re-fetched per card. Confirm the "Ferramentas" panel and its toggle button are inserted before `.sets` (so they appear above the set rows, not mixed into them). Confirm PR history is fetched (`getHistoricoCompletoDoExercicio`) BEFORE `registrarSerie` runs, so the just-logged set isn't compared against itself. Confirm every other part of the file (imports for `substituicao`/`cargas`/`timer`, `obterDataLocal`, `obterConfigExercicio`, `criarLinhaSerie`, `iniciarDescanso`'s existing body) is unchanged from before this task.

- [ ] **Step 3: Commit**

```bash
git add js/screens/treino.js
git commit -m "Wire plate calculator, warm-up ladder, and PR toast into Treino"
```

---

## Task 7: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 4 new files to `APP_SHELL`, bump the cache version**

Add these entries anywhere in the `APP_SHELL` array:
```javascript
  "./js/engine/anilhas.js",
  "./js/engine/aquecimento.js",
  "./js/engine/recordes.js",
  "./js/data/equipamento.js",
```
Change `const CACHE_NAME = "app-treino-shell-v3";` to `const CACHE_NAME = "app-treino-shell-v4";`.

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "Add Nível 2a files to service worker cache list, bump to v4"
```

---

## Task 8: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests from Tasks 1–4 (plus every pre-existing test from the foundation, Nível 1a, and Nível 1b plans) PASS.

- [ ] **Step 2: Verify equipment settings**

Open Config, confirm the "Equipamento" section shows the default bar weight (20) and default plates. Change the bar weight to 15 and the plates to `10, 5, 2.5`, save, reload the Config tab, confirm the saved values persist.

- [ ] **Step 3: Verify plate calculator and warm-up ladder**

Go to Treino, tap "Ferramentas" on an exercise card. Confirm a plate breakdown and a warm-up ladder render, using numbers consistent with the equipment settings saved in Step 2 and the card's suggested/placeholder load.

- [ ] **Step 4: Verify PR toast**

Log a set with a carga higher than any previously logged for that exercise (or the exercise's first-ever set, in which case NO toast should appear — first-time sets are excluded from the toast per the plan). Confirm a "🏆 Recorde pessoal" toast appears near the bottom of the screen and disappears after a few seconds. Log a second, lower-effort set on the same exercise — confirm no toast appears.

- [ ] **Step 5: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (with the new Ferramentas/toast code) still loads fully from cache.

- [ ] **Step 6: Report result to the user**

Show the working plate calculator, warm-up ladder, and PR toast before starting Nível 2b (graphs, body measurements, calendar, session stats).
