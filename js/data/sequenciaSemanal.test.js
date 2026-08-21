import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "./sequenciaSemanal.js";

test("getUltimoDiaRegistrado retorna null quando nada foi definido", async () => {
  const db = await openDatabase();
  const resultado = await getUltimoDiaRegistrado(db);
  assert.equal(resultado, null);
  db.close();
});

test("registrarDiaDaSessao grava e getUltimoDiaRegistrado lê de volta", async () => {
  const db = await openDatabase();
  await registrarDiaDaSessao(db, 3, "2026-08-21");
  const resultado = await getUltimoDiaRegistrado(db);
  assert.equal(resultado.dia, 3);
  assert.equal(resultado.data, "2026-08-21");
  db.close();
});

test("registrarDiaDaSessao grava concluido quando informado", async () => {
  const db = await openDatabase();
  await registrarDiaDaSessao(db, 3, "2026-08-21", true);
  const resultado = await getUltimoDiaRegistrado(db);
  assert.equal(resultado.concluido, true);
  db.close();
});

test("registrarDiaDaSessao sobrescreve o valor anterior", async () => {
  const db = await openDatabase();
  await registrarDiaDaSessao(db, 1, "2026-08-20");
  await registrarDiaDaSessao(db, 2, "2026-08-21");
  const resultado = await getUltimoDiaRegistrado(db);
  assert.equal(resultado.dia, 2);
  assert.equal(resultado.data, "2026-08-21");
  db.close();
});
