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
