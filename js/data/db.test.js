import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, put, getAll, putAll, clearStore } from "./db.js";

test("um banco academiaDB criado na v1 (sem índices) ganha os índices ao abrir com a openDatabase() real, sem perder dados", async () => {
  // Simula o cenário real: um navegador que já tinha "academiaDB" na v1,
  // de antes de historicoSeries ganhar índices. Precisa rodar ANTES de
  // qualquer outro teste do arquivo abrir "academiaDB" pela função real,
  // senão o banco já existiria na versão atual e o cenário não seria
  // simulado de verdade.
  const dbAntigo = await new Promise((resolve, reject) => {
    const req = indexedDB.open("academiaDB", 1);
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

  const dbNovo = await openDatabase();
  const tx = dbNovo.transaction("historicoSeries", "readonly");
  const store = tx.objectStore("historicoSeries");
  assert.ok(store.indexNames.contains("exercicioId"));
  assert.ok(store.indexNames.contains("data"));
  const registros = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert.equal(registros.length, 1);
  assert.equal(registros[0].exercicioId, "x");

  const nomes = Array.from(dbNovo.objectStoreNames).sort();
  assert.deepEqual(nomes, [
    "cargas", "config", "dietaBase", "exercicios", "ficha", "habitos",
    "historicoSeries", "medidasCorporais", "perfil", "protocolo",
    "registrosCardio", "registrosDiarios",
  ]);
  dbNovo.close();
});

test("openDatabase creates all expected object stores", async () => {
  const db = await openDatabase();
  const names = Array.from(db.objectStoreNames).sort();
  assert.deepEqual(names, [
    "cargas", "config", "dietaBase", "exercicios", "ficha", "habitos",
    "historicoSeries", "medidasCorporais", "perfil", "protocolo",
    "registrosCardio", "registrosDiarios",
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

test("medidasCorporais store has a data index", async () => {
  const db = await openDatabase();
  const tx = db.transaction("medidasCorporais", "readonly");
  const store = tx.objectStore("medidasCorporais");
  assert.ok(store.indexNames.contains("data"));
  db.close();
});

test("um banco academiaDB criado na v2 (sem medidasCorporais) ganha a store nova ao abrir com a openDatabase() real, sem perder dados", async () => {
  // Fecha o banco global "academiaDB" que os testes anteriores deste
  // arquivo já abriram na versão atual, para simular de verdade um
  // navegador que só tinha a v2.
  const dbAtual = await openDatabase();
  dbAtual.close();
  indexedDB.deleteDatabase("academiaDB");

  const dbV2 = await new Promise((resolve, reject) => {
    const req = indexedDB.open("academiaDB", 2);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("perfil", { keyPath: "versao" });
      req.result.createObjectStore("historicoSeries", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = dbV2.transaction("perfil", "readwrite");
    tx.objectStore("perfil").add({ versao: "1.0", dadosBasicos: { peso_kg: 71 } });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  dbV2.close();

  const dbNovo = await openDatabase();
  assert.ok(dbNovo.objectStoreNames.contains("medidasCorporais"));
  const perfilRegistros = await new Promise((resolve, reject) => {
    const req = dbNovo.transaction("perfil", "readonly").objectStore("perfil").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert.equal(perfilRegistros.length, 1);
  assert.equal(perfilRegistros[0].dadosBasicos.peso_kg, 71);
  dbNovo.close();
});

test("registrosCardio store has a data index", async () => {
  const db = await openDatabase();
  const tx = db.transaction("registrosCardio", "readonly");
  const store = tx.objectStore("registrosCardio");
  assert.ok(store.indexNames.contains("data"));
  db.close();
});

test("um banco academiaDB criado na v3 (sem registrosCardio) ganha a store nova ao abrir com a openDatabase() real, sem perder dados", async () => {
  const dbAtual = await openDatabase();
  dbAtual.close();
  indexedDB.deleteDatabase("academiaDB");

  const dbV3 = await new Promise((resolve, reject) => {
    const req = indexedDB.open("academiaDB", 3);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("perfil", { keyPath: "versao" });
      req.result.createObjectStore("historicoSeries", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise((resolve, reject) => {
    const tx = dbV3.transaction("perfil", "readwrite");
    tx.objectStore("perfil").add({ versao: "1.0", dadosBasicos: { peso_kg: 71 } });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  dbV3.close();

  const dbNovo = await openDatabase();
  assert.ok(dbNovo.objectStoreNames.contains("registrosCardio"));
  const perfilRegistros = await new Promise((resolve, reject) => {
    const req = dbNovo.transaction("perfil", "readonly").objectStore("perfil").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  assert.equal(perfilRegistros.length, 1);
  dbNovo.close();
});
