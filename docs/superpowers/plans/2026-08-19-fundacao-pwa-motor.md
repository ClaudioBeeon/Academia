# Fundação (dados, motor de domínio, PWA shell) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the substrate every screen depends on — IndexedDB access, seeding from `/data/*.json`, the pure domain-engine functions (progressão, volume, validação de RIR), and an installable PWA shell (manifest, service worker, offline app shell caching) — before any real screen is built.

**Architecture:** Vanilla JS, ES modules, no build step. IndexedDB is accessed through a small hand-written promisified wrapper (`js/data/db.js`) instead of vendoring the `idb` library — same effect (no raw callback API), zero external code to vendor/audit, zero dependency to keep in sync. This is a deliberate deviation from the original spec's mention of vendoring `idb`; functionally equivalent, simpler. Domain-engine modules are pure functions (no DOM, no IndexedDB) so they're testable head-on. Tests run via Node's built-in test runner (`node --test`) against the `fake-indexeddb` dev-only shim — this never ships to the browser, it only exists to let `db.js` be tested without opening a real browser.

**Tech Stack:** Vanilla JS (ES modules), IndexedDB, Node built-in test runner + `fake-indexeddb` (devDependency, test-only), no framework, no bundler.

**Spec:** `docs/superpowers/specs/2026-08-19-app-treino-design.md`

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`. (spec §5)
- No runtime dependency on any CDN or external network call except the Gemini API, which is out of scope for this plan. (spec §5, §9)
- `/data/*.json` files are read-only templates: the app seeds IndexedDB from them once, and never writes back to them. (spec §6)
- All money/measurement-shaped numbers involving user data must be treated as domain-engine concerns, not UI concerns — the engine never touches DOM or IndexedDB directly. (spec §7)
- `.gitignore` must exclude `.env` and any key file from the very first commit — no API key ever committed. (spec §9, user prompt)

---

## Task 1: Project scaffold (manifest, gitignore, CSS skeleton, package.json for tests)

**Files:**
- Create: `manifest.json`
- Create: `.gitignore`
- Create: `css/styles.css`
- Create: `package.json`
- Test: none (static config; validated by later tasks that consume it)

**Interfaces:**
- Produces: `manifest.json` referencing `icons/icon-192.png` and `icons/icon-512.png` (already exist in the repo).

- [ ] **Step 1: Write `manifest.json`**

```json
{
  "name": "App de Treino e Progressão",
  "short_name": "Treino",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#1e3a5f",
  "theme_color": "#1e3a5f",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Write `.gitignore`**

```
.env
*.key
node_modules/
```

- [ ] **Step 3: Write empty `css/styles.css` with just a CSS reset and safe-area padding for iOS**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: system-ui, -apple-system, sans-serif; }
body {
  padding-bottom: env(safe-area-inset-bottom);
  padding-top: env(safe-area-inset-top);
}
```

- [ ] **Step 4: Write `package.json` (test tooling only, not shipped to the browser)**

```json
{
  "name": "app-treino",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test js/**/*.test.js"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.0"
  }
}
```

- [ ] **Step 5: Install dev dependency**

Run:
```bash
npm install
```
Expected: `node_modules/fake-indexeddb` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add manifest.json .gitignore css/styles.css package.json package-lock.json
git commit -m "Add PWA manifest, gitignore, base CSS, test tooling"
```

---

## Task 2: IndexedDB wrapper (`js/data/db.js`)

**Files:**
- Create: `js/data/db.js`
- Test: `js/data/db.test.js`

**Interfaces:**
- Produces:
  - `openDatabase(indexedDBImpl = globalThis.indexedDB): Promise<IDBDatabase>` — opens/creates `academiaDB` v1 with object stores: `perfil` (keyPath `"versao"`), `protocolo` (keyPath `"versao"`), `exercicios` (keyPath `"id"`), `dietaBase` (keyPath `"versao"`), `historicoSeries` (keyPath `"id"`, autoIncrement), `cargas` (keyPath `"exercicioId"`), `registrosDiarios` (keyPath `"data"`), `config` (keyPath `"chave"`).
  - `getAll(db, storeName): Promise<any[]>`
  - `get(db, storeName, key): Promise<any|undefined>`
  - `put(db, storeName, value): Promise<IDBValidKey>`
  - `putAll(db, storeName, values): Promise<void>`
  - `clearStore(db, storeName): Promise<void>`

- [ ] **Step 1: Write the failing test**

```javascript
// js/data/db.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, put, getAll, putAll, clearStore } from "./db.js";

test("openDatabase creates all expected object stores", async () => {
  const db = await openDatabase();
  const names = Array.from(db.objectStoreNames).sort();
  assert.deepEqual(names, [
    "cargas", "config", "dietaBase", "exercicios",
    "historicoSeries", "perfil", "protocolo", "registrosDiarios",
  ]);
  db.close();
});

test("put then get round-trips a value", async () => {
  const db = await openDatabase();
  await put(db, "exercicios", { id: "supino_reto", nome: "Supino reto" });
  const result = await get(db, "exercicios", "supino_reto");
  assert.equal(result.nome, "Supino reto");
  db.close();
});

test("putAll then getAll returns every stored value", async () => {
  const db = await openDatabase();
  await clearStore(db, "exercicios");
  await putAll(db, "exercicios", [
    { id: "a", nome: "A" },
    { id: "b", nome: "B" },
  ]);
  const all = await getAll(db, "exercicios");
  assert.equal(all.length, 2);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/data/db.test.js`
Expected: FAIL — `db.js` does not exist yet (module not found).

- [ ] **Step 3: Write `js/data/db.js`**

```javascript
// js/data/db.js
const DB_NAME = "academiaDB";
const DB_VERSION = 1;

const STORES = {
  perfil: "versao",
  protocolo: "versao",
  exercicios: "id",
  dietaBase: "versao",
  historicoSeries: { keyPath: "id", autoIncrement: true },
  cargas: "exercicioId",
  registrosDiarios: "data",
  config: "chave",
};

export function openDatabase(indexedDBImpl = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, keyPathSpec] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const options = typeof keyPathSpec === "string"
          ? { keyPath: keyPathSpec }
          : keyPathSpec;
        db.createObjectStore(name, options);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function get(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function put(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putAll(db, storeName, values) {
  for (const value of values) {
    await put(db, storeName, value);
  }
}

export function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/data/db.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/data/db.js js/data/db.test.js
git commit -m "Add promisified IndexedDB wrapper"
```

---

## Task 3: Seed loader (`js/data/seed.js`)

**Files:**
- Create: `js/data/seed.js`
- Test: `js/data/seed.test.js`

**Interfaces:**
- Consumes: `openDatabase`, `get`, `put`, `putAll` from `js/data/db.js` (Task 2)
- Produces: `seedIfNeeded(db, fetchImpl = globalThis.fetch): Promise<{ seeded: boolean }>` — reads `data/perfil.json`, `data/protocolo.json`, `data/exercicios.json`, `data/dieta.json` via `fetchImpl`, writes `perfil`/`protocolo`/`dietaBase` as single documents (keyed by their `versao` field) and `exercicios.exercicios` array into the `exercicios` store (one row per exercise, keyed by `id`). Skips entirely if `config.seedVersion` already matches `protocolo.versao` from the fetched file — idempotent, safe to call on every app boot.

- [ ] **Step 1: Write the failing test**

```javascript
// js/data/seed.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, getAll } from "./db.js";
import { seedIfNeeded } from "./seed.js";

function fakeFetch(routes) {
  return async (url) => {
    const body = routes[url];
    if (!body) throw new Error(`no fake route for ${url}`);
    return { json: async () => body };
  };
}

const routes = {
  "data/perfil.json": { versao: "1.0", dadosBasicos: { peso_kg: 71 } },
  "data/protocolo.json": { versao: "1.0" },
  "data/exercicios.json": { versao: "1.0", exercicios: [{ id: "a", nome: "A" }] },
  "data/dieta.json": { versao: "1.0" },
};

test("seedIfNeeded populates all stores on first run", async () => {
  const db = await openDatabase();
  const result = await seedIfNeeded(db, fakeFetch(routes));
  assert.equal(result.seeded, true);

  const perfil = await get(db, "perfil", "1.0");
  assert.equal(perfil.dadosBasicos.peso_kg, 71);

  const exercicios = await getAll(db, "exercicios");
  assert.equal(exercicios.length, 1);

  const config = await get(db, "config", "seedVersion");
  assert.equal(config.valor, "1.0");
  db.close();
});

test("seedIfNeeded is a no-op on the second run", async () => {
  const db = await openDatabase();
  await seedIfNeeded(db, fakeFetch(routes));
  const second = await seedIfNeeded(db, fakeFetch(routes));
  assert.equal(second.seeded, false);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/data/seed.test.js`
Expected: FAIL — `seed.js` not found.

- [ ] **Step 3: Write `js/data/seed.js`**

```javascript
// js/data/seed.js
import { get, put, putAll } from "./db.js";

const DATA_FILES = {
  perfil: "data/perfil.json",
  protocolo: "data/protocolo.json",
  exercicios: "data/exercicios.json",
  dieta: "data/dieta.json",
};

export async function seedIfNeeded(db, fetchImpl = globalThis.fetch) {
  const [perfil, protocolo, exercicios, dieta] = await Promise.all([
    fetchImpl(DATA_FILES.perfil).then((r) => r.json()),
    fetchImpl(DATA_FILES.protocolo).then((r) => r.json()),
    fetchImpl(DATA_FILES.exercicios).then((r) => r.json()),
    fetchImpl(DATA_FILES.dieta).then((r) => r.json()),
  ]);

  const currentConfig = await get(db, "config", "seedVersion");
  if (currentConfig && currentConfig.valor === protocolo.versao) {
    return { seeded: false };
  }

  await put(db, "perfil", perfil);
  await put(db, "protocolo", protocolo);
  await put(db, "dietaBase", dieta);
  await putAll(db, "exercicios", exercicios.exercicios);
  await put(db, "config", { chave: "seedVersion", valor: protocolo.versao });

  return { seeded: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/data/seed.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add js/data/seed.js js/data/seed.test.js
git commit -m "Add idempotent IndexedDB seeding from /data JSON templates"
```

---

## Task 4: Engine — progressão dupla (`js/engine/progressao.js`)

**Files:**
- Create: `js/engine/progressao.js`
- Test: `js/engine/progressao.test.js`

**Interfaces:**
- Produces: `avaliarProgressao({ faixaMin, faixaMax, rirAlvo, sessaoAtual, sessaoAnterior }): { acao: "aumentar_carga"|"reduzir_carga"|"manter", motivo: string, principio: "P10", secao: "22.3" }`
  where `sessaoAtual`/`sessaoAnterior` are arrays of `{ reps: number, rir: number }` (one entry per set; `sessaoAnterior` may be `null` if there's no prior session yet).

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/progressao.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarProgressao } from "./progressao.js";

test("sobe carga quando todas as séries batem o topo da faixa com RIR suficiente", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 12, rir: 2 }, { reps: 12, rir: 3 }],
    sessaoAnterior: null,
  });
  assert.equal(resultado.acao, "aumentar_carga");
});

test("reduz carga quando fica abaixo do mínimo por 2 sessões seguidas", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 6, rir: 2 }],
    sessaoAnterior: [{ reps: 7, rir: 2 }],
  });
  assert.equal(resultado.acao, "reduzir_carga");
});

test("mantém quando está dentro da faixa mas ainda não bateu o topo", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 10, rir: 2 }],
    sessaoAnterior: [{ reps: 9, rir: 2 }],
  });
  assert.equal(resultado.acao, "manter");
});

test("não reduz na primeira sessão abaixo do mínimo (precisa de 2 seguidas)", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 6, rir: 2 }],
    sessaoAnterior: null,
  });
  assert.equal(resultado.acao, "manter");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/progressao.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/progressao.js`**

```javascript
// js/engine/progressao.js
function abaixoDoMinimo(sessao, faixaMin) {
  return sessao != null && sessao.some((serie) => serie.reps < faixaMin);
}

export function avaliarProgressao({ faixaMin, faixaMax, rirAlvo, sessaoAtual, sessaoAnterior }) {
  const todasNoTopoComRir = sessaoAtual.every(
    (serie) => serie.reps >= faixaMax && serie.rir >= rirAlvo
  );

  if (todasNoTopoComRir) {
    return {
      acao: "aumentar_carga",
      motivo: `Todas as séries atingiram ${faixaMax} reps com RIR >= ${rirAlvo}.`,
      principio: "P10",
      secao: "22.3",
    };
  }

  if (abaixoDoMinimo(sessaoAtual, faixaMin) && abaixoDoMinimo(sessaoAnterior, faixaMin)) {
    return {
      acao: "reduzir_carga",
      motivo: `Ficou abaixo de ${faixaMin} reps em 2 sessões consecutivas.`,
      principio: "P10",
      secao: "22.3",
    };
  }

  return {
    acao: "manter",
    motivo: "Ainda dentro da faixa; tentar +1 repetição na próxima sessão.",
    principio: "P10",
    secao: "22.3",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/progressao.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/progressao.js js/engine/progressao.test.js
git commit -m "Add double-progression engine (protocolo.json 22.3)"
```

---

## Task 5: Engine — volume semanal fracionado (`js/engine/volume.js`)

**Files:**
- Create: `js/engine/volume.js`
- Test: `js/engine/volume.test.js`

**Interfaces:**
- Produces: `calcularVolumeSemanal(series): { [musculo: string]: number }`
  where `series` is an array of `{ musculo: string, contribuicao: 1.0|0.5, tipoSerie: string }`. Sets with `tipoSerie === "aquecimento"` are excluded entirely (spec: warm-up sets never count toward volume).

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/volume.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularVolumeSemanal } from "./volume.js";

test("soma contribuição direta e indireta por músculo", () => {
  const series = [
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
    { musculo: "triceps", contribuicao: 0.5, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanal(series);
  assert.equal(resultado.peito, 2.0);
  assert.equal(resultado.triceps, 0.5);
});

test("séries de aquecimento não contam no volume", () => {
  const series = [
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "aquecimento" },
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanal(series);
  assert.equal(resultado.peito, 1.0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/volume.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/volume.js`**

```javascript
// js/engine/volume.js
export function calcularVolumeSemanal(series) {
  const porMusculo = {};
  for (const serie of series) {
    if (serie.tipoSerie === "aquecimento") continue;
    porMusculo[serie.musculo] = (porMusculo[serie.musculo] ?? 0) + serie.contribuicao;
  }
  return porMusculo;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/volume.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/volume.js js/engine/volume.test.js
git commit -m "Add fractioned weekly volume calculation (protocolo.json 22.2)"
```

---

## Task 6: Engine — validação cruzada de RIR (`js/engine/rir.js`)

**Files:**
- Create: `js/engine/rir.js`
- Test: `js/engine/rir.test.js`

**Interfaces:**
- Produces: `validarRir({ rirDeclarado, repsSerieAtual, repsSerieSeguinte, cargaIgual }): { suspeitaSuperestimado: boolean, mensagem: string|null }`

- [ ] **Step 1: Write the failing test**

```javascript
// js/engine/rir.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarRir } from "./rir.js";

test("marca RIR como suspeito de superestimado", () => {
  const resultado = validarRir({
    rirDeclarado: 2, repsSerieAtual: 10, repsSerieSeguinte: 12, cargaIgual: true,
  });
  assert.equal(resultado.suspeitaSuperestimado, true);
  assert.ok(resultado.mensagem.length > 0);
});

test("não marca suspeita quando a carga mudou", () => {
  const resultado = validarRir({
    rirDeclarado: 2, repsSerieAtual: 10, repsSerieSeguinte: 12, cargaIgual: false,
  });
  assert.equal(resultado.suspeitaSuperestimado, false);
});

test("não marca suspeita quando RIR declarado já é alto", () => {
  const resultado = validarRir({
    rirDeclarado: 4, repsSerieAtual: 10, repsSerieSeguinte: 12, cargaIgual: true,
  });
  assert.equal(resultado.suspeitaSuperestimado, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/engine/rir.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `js/engine/rir.js`**

```javascript
// js/engine/rir.js
export function validarRir({ rirDeclarado, repsSerieAtual, repsSerieSeguinte, cargaIgual }) {
  const suspeitaSuperestimado =
    rirDeclarado <= 2 && cargaIgual && repsSerieSeguinte > repsSerieAtual;

  return {
    suspeitaSuperestimado,
    mensagem: suspeitaSuperestimado
      ? "Você conseguiu mais repetições na série seguinte com a mesma carga — o RIR real provavelmente era maior do que o declarado."
      : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/engine/rir.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine/rir.js js/engine/rir.test.js
git commit -m "Add RIR self-report cross-validation (protocolo.json 22.5)"
```

---

## Task 7: Service worker + `index.html` app shell

**Files:**
- Create: `sw.js`
- Create: `index.html`
- Create: `js/app.js`
- Test: manual (browser preview) — service worker behavior isn't practically unit-testable without a browser; verified via the `run` skill in Task 8.

**Interfaces:**
- Consumes: `openDatabase` (Task 2), `seedIfNeeded` (Task 3)
- Produces: a loading `index.html` that registers `sw.js`, opens the DB, seeds it, and renders a placeholder shell with the 5 bottom tabs (Treino / Divisão / Evolução / Dieta / Config) — tab bodies are empty placeholders here; real screens are built in the Nível 1 plan (next).

- [ ] **Step 1: Write `sw.js`**

```javascript
// sw.js
const CACHE_NAME = "app-treino-shell-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/data/db.js",
  "./js/data/seed.js",
  "./js/engine/progressao.js",
  "./js/engine/volume.js",
  "./js/engine/rir.js",
  "./data/perfil.json",
  "./data/protocolo.json",
  "./data/exercicios.json",
  "./data/dieta.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

- [ ] **Step 2: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>App de Treino</title>
  <link rel="manifest" href="manifest.json" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <main id="tab-content"></main>
  <nav id="tab-bar">
    <button data-tab="treino">Treino</button>
    <button data-tab="divisao">Divisão</button>
    <button data-tab="evolucao">Evolução</button>
    <button data-tab="dieta">Dieta</button>
    <button data-tab="config">Config</button>
  </nav>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `js/app.js`**

```javascript
// js/app.js
import { openDatabase } from "./data/db.js";
import { seedIfNeeded } from "./data/seed.js";

async function bootstrap() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Falha ao registrar service worker:", err);
    });
  }

  const db = await openDatabase();
  await seedIfNeeded(db);

  renderPlaceholderShell();
}

function renderPlaceholderShell() {
  const content = document.getElementById("tab-content");
  const tabs = document.querySelectorAll("#tab-bar button");

  const renderTab = (tabName) => {
    content.textContent = `Tela "${tabName}" ainda não implementada (vem no plano do Nível 1).`;
  };

  tabs.forEach((button) => {
    button.addEventListener("click", () => renderTab(button.dataset.tab));
  });

  renderTab("treino");
}

bootstrap();
```

- [ ] **Step 4: Commit**

```bash
git add sw.js index.html js/app.js
git commit -m "Add PWA app shell: service worker, tab bar, DB bootstrap"
```

---

## Task 8: Manual browser verification (install + offline)

**Files:** none (verification only)

- [ ] **Step 1: Run all automated tests one final time**

Run: `npm test`
Expected: all tests from Tasks 2–6 PASS.

- [ ] **Step 2: Use the `run` skill to launch the app in the Browser pane**

Confirm in the browser console (via `read_console_messages`) that:
- No uncaught errors on load
- `navigator.serviceWorker.controller` is set after a reload
- Clicking each of the 5 tab buttons swaps the placeholder text

- [ ] **Step 3: Verify offline behavior**

In the Browser pane devtools (or via `preview_logs`), simulate offline (or stop the dev server after first load) and reload — the app shell must still render instead of showing a browser error page.

- [ ] **Step 4: Verify IndexedDB was seeded**

Via `javascript_tool`, run in the page context:
```javascript
const req = indexedDB.open("academiaDB");
req.onsuccess = () => {
  const tx = req.result.transaction("exercicios", "readonly");
  tx.objectStore("exercicios").count().onsuccess = (e) => console.log("exercicios count:", e.target.result);
};
```
Expected: count matches the number of entries in `data/exercicios.json` (19).

- [ ] **Step 5: Report result to the user**

Show the working placeholder shell (5 tabs, installable, offline-capable) before starting the Nível 1 plan.
