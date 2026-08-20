# Nível 3 (fatia 2) — Check-in Subjetivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user log a quick, optional, once-per-day subjective check-in (session quality, well-being, joint/tendon pain, residual muscle soreness) on the Treino tab, storing it in the pre-provisioned but never-used `registrosDiarios` IndexedDB store.

**Architecture:** A new data module `js/data/checkin.js` reads/merges/writes one record per calendar date into `registrosDiarios` (read-merge-write, never a blind overwrite, so future slices writing other daily fields to the same date never get clobbered). `js/screens/treino.js` gains a card at the top of the screen that shows either a compact form (no check-in yet today) or a one-line summary with an Edit button (already checked in today).

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step, `node --test`, `fake-indexeddb` for data-layer tests.

**Spec:** `docs/superpowers/specs/2026-08-20-nivel3-checkin-subjetivo-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- No IndexedDB schema changes — `registrosDiarios` (keyPath `"data"`) already exists in the schema, unused until now.
- `registrarCheckin` must always read-merge-write, never `put` a bare object over an existing record for the same date — other daily data (a future diet-logging slice) may already occupy other fields on that same record.
- The check-in is always optional and never blocks or gates logging a training set — no required-field validation that could stop the rest of the screen from working.
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead.

---

## Task 1: Data — Check-in (`js/data/checkin.js`)

**Files:**
- Create: `js/data/checkin.js`
- Test: `js/data/checkin.test.js`

**Interfaces:**
- Produces: `getCheckin(db, data) => Promise<object | undefined>` — the `registrosDiarios` record for that date, or `undefined` if none exists.
- Produces: `registrarCheckin(db, data, campos) => Promise<object>` — merges `campos` on top of any existing record for `data` (existing fields not present in `campos` are preserved), writes it back, and returns the merged record.

- [ ] **Step 1: Write the failing tests**

Create `js/data/checkin.test.js`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { getCheckin, registrarCheckin } from "./checkin.js";

test("getCheckin retorna undefined quando não há registro para a data", async () => {
  const db = await openDatabase();
  const resultado = await getCheckin(db, "2026-08-21");
  assert.equal(resultado, undefined);
  db.close();
});

test("registrarCheckin grava um novo registro e getCheckin o encontra", async () => {
  const db = await openDatabase();
  await registrarCheckin(db, "2026-08-21", {
    qualidadePercebida: 4,
    bemEstarBaixo: false,
    dorArticularOuTendinea: false,
    domsPersistente: true,
  });

  const resultado = await getCheckin(db, "2026-08-21");
  assert.equal(resultado.qualidadePercebida, 4);
  assert.equal(resultado.domsPersistente, true);
  assert.equal(resultado.data, "2026-08-21");
  db.close();
});

test("registrarCheckin mescla em vez de sobrescrever campos existentes de outra origem", async () => {
  const db = await openDatabase();
  // Simula um campo gravado por outra fatia (ex.: futura fatia de dieta) no mesmo dia.
  await registrarCheckin(db, "2026-08-21", { caloriasConsumidas: 2200 });

  await registrarCheckin(db, "2026-08-21", {
    qualidadePercebida: 3,
    bemEstarBaixo: true,
    dorArticularOuTendinea: false,
    domsPersistente: false,
  });

  const resultado = await getCheckin(db, "2026-08-21");
  assert.equal(resultado.caloriasConsumidas, 2200);
  assert.equal(resultado.qualidadePercebida, 3);
  assert.equal(resultado.bemEstarBaixo, true);
  db.close();
});

test("registrarCheckin sobrescreve apenas os campos re-enviados ao editar", async () => {
  const db = await openDatabase();
  await registrarCheckin(db, "2026-08-21", {
    qualidadePercebida: 2,
    bemEstarBaixo: true,
    dorArticularOuTendinea: true,
    domsPersistente: true,
  });

  await registrarCheckin(db, "2026-08-21", {
    qualidadePercebida: 4,
    bemEstarBaixo: false,
    dorArticularOuTendinea: false,
    domsPersistente: false,
  });

  const resultado = await getCheckin(db, "2026-08-21");
  assert.equal(resultado.qualidadePercebida, 4);
  assert.equal(resultado.bemEstarBaixo, false);
  assert.equal(resultado.dorArticularOuTendinea, false);
  assert.equal(resultado.domsPersistente, false);
  db.close();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `js/data/checkin.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `js/data/checkin.js`:

```javascript
// js/data/checkin.js
import { get, put } from "./db.js";

export async function getCheckin(db, data) {
  return get(db, "registrosDiarios", data);
}

export async function registrarCheckin(db, data, campos) {
  const existente = await get(db, "registrosDiarios", data);
  const mesclado = { ...(existente ?? {}), ...campos, data };
  await put(db, "registrosDiarios", mesclado);
  return mesclado;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all 4 new tests green, full existing suite (108 tests as of the prior plan) still green.

- [ ] **Step 5: Commit**

```bash
git add js/data/checkin.js js/data/checkin.test.js
git commit -m "Add check-in data layer (registrarCheckin merges into registrosDiarios)"
```

---

## Task 2: Screen — Check-in card on Treino (`js/screens/treino.js`)

**Files:**
- Modify: `js/screens/treino.js`

**Interfaces:**
- Consumes: `getCheckin(db, data)`, `registrarCheckin(db, data, campos)` from `../data/checkin.js` (Task 1).

- [ ] **Step 1: Add the import**

Add a new import line alongside the other data imports at the top of the file:
```javascript
import { getCheckin, registrarCheckin } from "../data/checkin.js";
```

- [ ] **Step 2: Add the check-in card functions**

Add these functions anywhere at module scope (alongside `montarCardResumoSessao`/`atualizarResumoSessao`):

```javascript
async function montarCardCheckin(db, hoje) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Check-in de hoje</div></div>`;

  const corpo = document.createElement("div");
  card.appendChild(corpo);

  const checkinExistente = await getCheckin(db, hoje);
  if (checkinExistente) {
    renderizarResumoCheckin(corpo, db, hoje, checkinExistente);
  } else {
    renderizarFormularioCheckin(corpo, db, hoje);
  }

  return card;
}

function renderizarResumoCheckin(corpo, db, hoje, checkin) {
  corpo.innerHTML = "";

  const resumo = document.createElement("div");
  resumo.className = "prev-hint";
  resumo.style.padding = "0 18px 18px";
  const partes = [`Qualidade: ${checkin.qualidadePercebida}/5`];
  if (checkin.bemEstarBaixo) partes.push("sono/motivação baixos");
  if (checkin.dorArticularOuTendinea) partes.push("dor articular/tendínea");
  if (checkin.domsPersistente) partes.push("dor muscular residual");
  resumo.textContent = partes.join(" · ");
  corpo.appendChild(resumo);

  const editarBtn = document.createElement("button");
  editarBtn.type = "button";
  editarBtn.className = "swap-pill";
  editarBtn.textContent = "Editar";
  editarBtn.style.margin = "0 18px 18px";
  editarBtn.addEventListener("click", () => renderizarFormularioCheckin(corpo, db, hoje, checkin));
  corpo.appendChild(editarBtn);
}

function renderizarFormularioCheckin(corpo, db, hoje, checkinExistente) {
  corpo.innerHTML = "";

  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0 18px 18px";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Como foi a sessão hoje, no geral? (1-5)</label>
      <select name="qualidadePercebida" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;">
        <option value="1">1 — muito ruim</option>
        <option value="2">2 — ruim</option>
        <option value="3">3 — neutra</option>
        <option value="4">4 — boa</option>
        <option value="5">5 — muito boa</option>
      </select>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label><input type="checkbox" name="bemEstarBaixo" /> Sono ruim, motivação baixa ou irritação sustentada hoje?</label>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label><input type="checkbox" name="dorArticularOuTendinea" /> Alguma dor articular ou de tendão persistente?</label>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label><input type="checkbox" name="domsPersistente" /> Ainda com dor muscular do treino anterior?</label>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
  `;

  if (checkinExistente) {
    form.qualidadePercebida.value = String(checkinExistente.qualidadePercebida ?? 3);
    form.bemEstarBaixo.checked = !!checkinExistente.bemEstarBaixo;
    form.dorArticularOuTendinea.checked = !!checkinExistente.dorArticularOuTendinea;
    form.domsPersistente.checked = !!checkinExistente.domsPersistente;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const campos = {
      qualidadePercebida: Number(form.qualidadePercebida.value),
      bemEstarBaixo: form.bemEstarBaixo.checked,
      dorArticularOuTendinea: form.dorArticularOuTendinea.checked,
      domsPersistente: form.domsPersistente.checked,
    };
    const salvo = await registrarCheckin(db, hoje, campos);
    renderizarResumoCheckin(corpo, db, hoje, salvo);
  });

  corpo.appendChild(form);
}
```

(All dynamic text in `renderizarResumoCheckin` goes through `resumo.textContent`, never `innerHTML` — the summary line is built from values the user themselves just submitted through this same form, but the project's blanket hardening rule applies regardless of origin, matching how every other screen in this codebase already treats user-editable/DB-sourced strings.)

- [ ] **Step 3: Wire the card into `montarTelaTreino`**

Find this line in `montarTelaTreino`:
```javascript
  const main = document.createElement("main");
  root.appendChild(main);
```

Right after it, add:
```javascript
  main.appendChild(await montarCardCheckin(db, hoje));
```

(This places the check-in card first, above the loop that appends exercise cards further down in the same function — `main` already exists and `hoje` was computed at the top of `montarTelaTreino`.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 1 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change).

- [ ] **Step 5: Commit**

```bash
git add js/screens/treino.js
git commit -m "Add daily subjective check-in card to Treino"
```

---

## Task 3: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 1 new file to `APP_SHELL`, bump the cache version**

Add this entry anywhere in the `APP_SHELL` array:
```javascript
  "./js/data/checkin.js",
```

Change `const CACHE_NAME = "app-treino-shell-v8";` to `const CACHE_NAME = "app-treino-shell-v9";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 112 tests total (108 pre-existing + 4 new in Task 1), all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add checkin.js to service worker cache list, bump to v9"
```

---

## Task 4: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the empty-state form**

Open Treino on a day with no check-in yet. Confirm the "Check-in de hoje"
card shows the form (quality select + 3 checkboxes + Salvar button), at
the top of the screen, above the exercise cards.

- [ ] **Step 3: Verify saving and the summary state**

Pick quality 4, leave the three checkboxes unchecked, click Salvar.
Confirm the card switches to a one-line summary ("Qualidade: 4/5") with
no extra flags listed, plus an "Editar" button. Reload the page — confirm
the summary (not the form) still shows, since the check-in persisted.

- [ ] **Step 4: Verify editing**

Click "Editar". Confirm the form reopens pre-filled with quality 4 and
all checkboxes unchecked. Change quality to 2, check "dor articular ou de
tendão persistente", click Salvar. Confirm the summary now reads
"Qualidade: 2/5 · dor articular/tendínea". Confirm logging a set on any
exercise still works normally throughout (the check-in never blocks it).

- [ ] **Step 5: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server,
reload, confirm the app (including the check-in card, showing the
correct persisted state) still loads and renders fully from cache, and
that editing the check-in still works offline.

- [ ] **Step 6: Report result to the user**

Show the working check-in card. Note that this closes fatia 2 of Nível
3; fatia 3 (detecção de estagnação / alertas) is next, and will consume
this data.
