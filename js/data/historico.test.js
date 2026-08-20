// js/data/historico.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio } from "./historico.js";

test("registrarSerie grava e getSeriesDoExercicioNaData filtra por exercício e data", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "a", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 15, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "a", data: "2026-08-19", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "b", data: "2026-08-20", musculo: "costas", contribuicao: 1, tipoSerie: "normal", carga: 20, reps: 8, rir: 1 });

  const seriesHoje = await getSeriesDoExercicioNaData(db, "a", "2026-08-20");
  assert.equal(seriesHoje.length, 1);
  assert.equal(seriesHoje[0].carga, 15);
  db.close();
});

test("getUltimaSerieAnterior retorna a série mais recente antes da data atual", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "c", data: "2026-08-13", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 3 });
  await registrarSerie(db, { exercicioId: "c", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2 });

  const ultima = await getUltimaSerieAnterior(db, "c", "2026-08-27");
  assert.equal(ultima.data, "2026-08-20");
  assert.equal(ultima.carga, 14);
  db.close();
});

test("getUltimaSerieAnterior retorna null quando não há histórico", async () => {
  const db = await openDatabase();
  const ultima = await getUltimaSerieAnterior(db, "nunca_registrado", "2026-08-20");
  assert.equal(ultima, null);
  db.close();
});

test("getAmostrasRecentesDoExercicio reshapes séries em amostras (rir_relatado) e respeita o limite", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "d", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 3 });
  await registrarSerie(db, { exercicioId: "d", data: "2026-08-08", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "d", data: "2026-08-15", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 9, rir: 1 });

  const amostras = await getAmostrasRecentesDoExercicio(db, "d", 2);
  assert.equal(amostras.length, 2);
  assert.ok("rir_relatado" in amostras[0]);
  assert.ok(!("rir" in amostras[0]));
  db.close();
});
