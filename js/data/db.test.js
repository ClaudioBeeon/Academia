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

test("historicoSeries store has exercicioId and data indexes", async () => {
  const db = await openDatabase();
  const tx = db.transaction("historicoSeries", "readonly");
  const store = tx.objectStore("historicoSeries");
  const indexNames = Array.from(store.indexNames).sort();
  assert.deepEqual(indexNames, ["data", "exercicioId"]);
  db.close();
});

test("um banco criado numa versão antiga (sem índices) ganha os índices ao reabrir na versão atual, sem perder dados", async () => {
  // Simula o cenário real: um navegador que já tinha o banco na v1 (sem
  // os índices de historicoSeries, que só passaram a existir na v2).
  const dbAntigo = await new Promise((resolve, reject) => {
    const req = indexedDB.open("academiaDB_v1_sim", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("historicoSeries", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = dbAntigo.transaction("historicoSeries", "readwrite");
    tx.objectStore("historicoSeries").add({ exercicioId: "x", carga: 10 });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  dbAntigo.close();

  const dbNovo = await new Promise((resolve, reject) => {
    const req = indexedDB.open("academiaDB_v1_sim", 2);
    req.onupgradeneeded = () => {
      const store = req.transaction.objectStore("historicoSeries");
      if (!store.indexNames.contains("exercicioId")) {
        store.createIndex("exercicioId", "exercicioId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const tx = dbNovo.transaction("historicoSeries", "readonly");
  const store = tx.objectStore("historicoSeries");
  assert.ok(store.indexNames.contains("exercicioId"));
  const registros = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert.equal(registros.length, 1);
  assert.equal(registros[0].exercicioId, "x");
  dbNovo.close();
});
