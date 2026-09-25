import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { getNotaExercicio, salvarNotaExercicio, getUltimaNotaAnterior } from "./notasExercicio.js";

let db;

test("salva e lê a anotação do exercício no dia", async () => {
  db = await openDatabase();
  await salvarNotaExercicio(db, "supino", "2026-09-20", "  banco no furo 3 ");
  assert.equal(await getNotaExercicio(db, "supino", "2026-09-20"), "banco no furo 3");
});

test("a última anotação anterior ignora hoje e outros exercícios", async () => {
  await salvarNotaExercicio(db, "supino", "2026-09-22", "ombro incomodou");
  await salvarNotaExercicio(db, "supino", "2026-09-24", "hoje");
  await salvarNotaExercicio(db, "remada", "2026-09-23", "outra");
  const ultima = await getUltimaNotaAnterior(db, "supino", "2026-09-24");
  assert.equal(ultima.texto, "ombro incomodou");
  assert.equal(ultima.data, "2026-09-22");
});

test("salvar texto vazio apaga a anotação", async () => {
  await salvarNotaExercicio(db, "supino", "2026-09-24", "   ");
  assert.equal(await getNotaExercicio(db, "supino", "2026-09-24"), "");
  db.close();
});
