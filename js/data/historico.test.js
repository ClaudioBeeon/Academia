// js/data/historico.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDoDia, getUltimaSerieGeral, getSeriesDaUltimaSessaoAnterior, getUltimasSessoesPorExercicio } from "./historico.js";

test("getUltimaSerieGeral retorna undefined quando não há nenhuma série", async () => {
  const db = await openDatabase();
  const resultado = await getUltimaSerieGeral(db);
  assert.equal(resultado, undefined);
  db.close();
});

test("getUltimasSessoesPorExercicio retorna vazio quando não há histórico", async () => {
  const db = await openDatabase();
  const resultado = await getUltimasSessoesPorExercicio(db);
  assert.deepEqual(resultado, []);
  db.close();
});

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

test("getAmostrasRecentesDoExercicio exclui séries de aquecimento", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "e", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "aquecimento", carga: 8, reps: 12, rir: 5, serieNumero: 0 });
  await registrarSerie(db, { exercicioId: "e", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2, serieNumero: 1 });

  const amostras = await getAmostrasRecentesDoExercicio(db, "e");
  assert.equal(amostras.length, 1);
  assert.equal(amostras[0].carga, 14);
  db.close();
});

test("getSeriesDoExercicioNaData ordena por serieNumero", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "f", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 14, reps: 10, rir: 2, serieNumero: 2 });
  await registrarSerie(db, { exercicioId: "f", data: "2026-08-10", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 15, reps: 9, rir: 2, serieNumero: 1 });

  const series = await getSeriesDoExercicioNaData(db, "f", "2026-08-10");
  assert.deepEqual(series.map((s) => s.serieNumero), [1, 2]);
  db.close();
});

test("getHistoricoCompletoDoExercicio retorna todas as séries, mais recente primeiro", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "g", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 3, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "g", data: "2026-08-08", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 2, serieNumero: 1 });

  const historico = await getHistoricoCompletoDoExercicio(db, "g");
  assert.equal(historico.length, 2);
  assert.equal(historico[0].data, "2026-08-08");
  db.close();
});

test("getSeriesDoDia retorna todas as séries de todos os exercícios numa data", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "h", data: "2026-08-21", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "i", data: "2026-08-21", musculo: "costas", contribuicao: 1, tipoSerie: "normal", carga: 20, reps: 8, rir: 1 });
  await registrarSerie(db, { exercicioId: "h", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 9, reps: 10, rir: 2 });

  const seriesDoDia = await getSeriesDoDia(db, "2026-08-21");
  assert.equal(seriesDoDia.length, 2);
  assert.ok(seriesDoDia.every((s) => s.data === "2026-08-21"));
  db.close();
});

test("getUltimaSerieGeral retorna a série mais recente entre todos os exercícios", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "x", data: "2026-08-19", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "y", data: "2026-08-21", musculo: "quadriceps", contribuicao: 1, tipoSerie: "normal", carga: 40, reps: 10, rir: 2 });
  await registrarSerie(db, { exercicioId: "z", data: "2026-08-20", musculo: "costas", contribuicao: 1, tipoSerie: "normal", carga: 20, reps: 8, rir: 1 });

  const resultado = await getUltimaSerieGeral(db);
  assert.equal(resultado.data, "2026-08-21");
  assert.equal(resultado.musculo, "quadriceps");
  db.close();
});

test("getSeriesDaUltimaSessaoAnterior retorna vazio quando não há sessão anterior", async () => {
  const db = await openDatabase();
  const resultado = await getSeriesDaUltimaSessaoAnterior(db, "nunca-treinado", "2026-08-21");
  assert.deepEqual(resultado, []);
  db.close();
});

test("getSeriesDaUltimaSessaoAnterior retorna todas as séries da sessão anterior mais recente, ignorando sessões mais antigas e a de hoje", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-15", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 8, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-18", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 9, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-18", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 8, rir: 2, serieNumero: 2 });
  await registrarSerie(db, { exercicioId: "p", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 13, reps: 10, rir: 1, serieNumero: 1 });

  const resultado = await getSeriesDaUltimaSessaoAnterior(db, "p", "2026-08-20");
  assert.equal(resultado.length, 2);
  assert.ok(resultado.every((s) => s.data === "2026-08-18"));
  db.close();
});

test("getUltimasSessoesPorExercicio agrupa séries por exercício e por data, mais recente primeiro", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "q", data: "2026-08-13", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "q", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "q", data: "2026-08-20", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 9, rir: 2, serieNumero: 2 });

  const resultado = await getUltimasSessoesPorExercicio(db);
  const entrada = resultado.find((r) => r.exercicioId === "q");
  assert.equal(entrada.sessoes.length, 2);
  assert.equal(entrada.sessoes[0].data, "2026-08-20");
  assert.equal(entrada.sessoes[0].series.length, 2);
  assert.equal(entrada.sessoes[1].data, "2026-08-13");
  db.close();
});

test("getUltimasSessoesPorExercicio exclui séries de aquecimento e respeita o limite por exercício", async () => {
  const db = await openDatabase();
  await registrarSerie(db, { exercicioId: "r", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "aquecimento", carga: 5, reps: 15, rir: 5, serieNumero: 0 });
  await registrarSerie(db, { exercicioId: "r", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "r", data: "2026-08-08", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 11, reps: 10, rir: 2, serieNumero: 1 });
  await registrarSerie(db, { exercicioId: "r", data: "2026-08-15", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 12, reps: 10, rir: 2, serieNumero: 1 });

  const resultado = await getUltimasSessoesPorExercicio(db, 2);
  const entrada = resultado.find((r) => r.exercicioId === "r");
  assert.equal(entrada.sessoes.length, 2);
  assert.equal(entrada.sessoes[0].data, "2026-08-15");
  assert.equal(entrada.sessoes[1].data, "2026-08-08");
  assert.ok(entrada.sessoes.every((s) => s.series.every((serie) => serie.tipoSerie !== "aquecimento")));
  db.close();
});
