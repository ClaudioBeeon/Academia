import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, clearStore } from "./db.js";
import { getObservacaoTreino, salvarObservacaoTreino, getObservacoesTreino } from "./observacoesTreino.js";

test("getObservacaoTreino retorna string vazia quando não há registro pra data", async () => {
  const db = await openDatabase();
  await clearStore(db, "observacoesTreino");
  const resultado = await getObservacaoTreino(db, "2026-08-22");
  assert.equal(resultado, "");
  db.close();
});

test("salvarObservacaoTreino grava e getObservacaoTreino encontra de volta, sem espaços nas pontas", async () => {
  const db = await openDatabase();
  await clearStore(db, "observacoesTreino");
  await salvarObservacaoTreino(db, "2026-08-22", "  senti dor no ombro no supino  ");
  const resultado = await getObservacaoTreino(db, "2026-08-22");
  assert.equal(resultado, "senti dor no ombro no supino");
  db.close();
});

test("salvarObservacaoTreino com texto vazio (ou só espaços) apaga o registro do dia", async () => {
  const db = await openDatabase();
  await clearStore(db, "observacoesTreino");
  await salvarObservacaoTreino(db, "2026-08-22", "algo");
  await salvarObservacaoTreino(db, "2026-08-22", "   ");
  const resultado = await getObservacaoTreino(db, "2026-08-22");
  assert.equal(resultado, "");
  db.close();
});

test("getObservacoesTreino ordena do mais recente pro mais antigo", async () => {
  const db = await openDatabase();
  await clearStore(db, "observacoesTreino");
  await salvarObservacaoTreino(db, "2026-08-20", "primeira");
  await salvarObservacaoTreino(db, "2026-08-22", "terceira");
  await salvarObservacaoTreino(db, "2026-08-21", "segunda");
  const todas = await getObservacoesTreino(db);
  assert.deepEqual(todas.map((o) => o.data), ["2026-08-22", "2026-08-21", "2026-08-20"]);
  db.close();
});
