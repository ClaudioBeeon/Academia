import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, clearStore } from "./db.js";
import { getHabito, registrarHabito, getHabitosRecentes } from "./habitos.js";

test("getHabito retorna undefined quando não há registro para a data", async () => {
  const db = await openDatabase();
  await clearStore(db, "habitos");
  const resultado = await getHabito(db, "2026-08-22");
  assert.equal(resultado, undefined);
  db.close();
});

test("registrarHabito grava e getHabito encontra de volta", async () => {
  const db = await openDatabase();
  await clearStore(db, "habitos");
  await registrarHabito(db, "2026-08-22", { creatina: true, alcool: false, sonoOntem: "bom" });
  const resultado = await getHabito(db, "2026-08-22");
  assert.equal(resultado.creatina, true);
  assert.equal(resultado.sonoOntem, "bom");
  db.close();
});

test("registrarHabito mescla campos em vez de sobrescrever (ex.: aquecimento gravado depois no mesmo dia)", async () => {
  const db = await openDatabase();
  await clearStore(db, "habitos");
  await registrarHabito(db, "2026-08-22", { creatina: true });
  await registrarHabito(db, "2026-08-22", { aquecimentoFeito: true });
  const resultado = await getHabito(db, "2026-08-22");
  assert.equal(resultado.creatina, true);
  assert.equal(resultado.aquecimentoFeito, true);
  db.close();
});

test("getHabitosRecentes ordena do mais recente pro mais antigo e respeita o limite", async () => {
  const db = await openDatabase();
  await clearStore(db, "habitos");
  await registrarHabito(db, "2026-08-20", { creatina: true });
  await registrarHabito(db, "2026-08-22", { creatina: false });
  await registrarHabito(db, "2026-08-21", { creatina: true });
  const recentes = await getHabitosRecentes(db, 2);
  assert.deepEqual(recentes.map((h) => h.data), ["2026-08-22", "2026-08-21"]);
  db.close();
});
