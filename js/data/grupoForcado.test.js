import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { getGrupoForcado, definirGrupoForcado } from "./grupoForcado.js";

test("getGrupoForcado retorna null quando nada foi definido", async () => {
  const db = await openDatabase();
  const resultado = await getGrupoForcado(db, "2026-08-21");
  assert.equal(resultado, null);
  db.close();
});

test("definirGrupoForcado grava e getGrupoForcado retorna pra mesma data", async () => {
  const db = await openDatabase();
  await definirGrupoForcado(db, "2026-08-21", "inferior");
  const resultado = await getGrupoForcado(db, "2026-08-21");
  assert.equal(resultado, "inferior");
  db.close();
});

test("getGrupoForcado retorna null quando a data pedida é diferente da que foi definida", async () => {
  const db = await openDatabase();
  await definirGrupoForcado(db, "2026-08-21", "superior");
  const resultado = await getGrupoForcado(db, "2026-08-22");
  assert.equal(resultado, null);
  db.close();
});

test("definirGrupoForcado sobrescreve um valor anterior", async () => {
  const db = await openDatabase();
  await definirGrupoForcado(db, "2026-08-21", "superior");
  await definirGrupoForcado(db, "2026-08-21", "inferior");
  const resultado = await getGrupoForcado(db, "2026-08-21");
  assert.equal(resultado, "inferior");
  db.close();
});
