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
