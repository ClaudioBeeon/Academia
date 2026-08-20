import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, put, getAll, clearStore } from "./db.js";
import { exportarTudo, importarTudo, historicoParaCsv } from "./exportImport.js";

test("exportarTudo dumps every user-data store", async () => {
  const db = await openDatabase();
  await put(db, "exercicios", { id: "a", nome: "A" });
  await put(db, "historicoSeries", { exercicioId: "a", data: "2026-08-01", musculo: "peito", contribuicao: 1, tipoSerie: "normal", carga: 10, reps: 10, rir: 2, serieNumero: 1 });

  const backup = await exportarTudo(db);
  assert.equal(backup.dados.exercicios.length, 1);
  assert.equal(backup.dados.historicoSeries.length, 1);
  assert.ok(backup.exportadoEm);
  db.close();
});

test("importarTudo restaura os dados exportados em um banco vazio", async () => {
  const dbOrigem = await openDatabase();
  // fake-indexeddb compartilha um único banco global "academiaDB" entre
  // testes no mesmo arquivo — limpar aqui garante que este teste não
  // herde registros deixados pelo teste anterior.
  await clearStore(dbOrigem, "exercicios");
  await put(dbOrigem, "exercicios", { id: "b", nome: "B" });
  const backup = await exportarTudo(dbOrigem);
  dbOrigem.close();

  const dbDestino = await openDatabase();
  await importarTudo(dbDestino, backup);
  const exercicios = await getAll(dbDestino, "exercicios");
  assert.equal(exercicios.length, 1);
  assert.equal(exercicios[0].nome, "B");
  dbDestino.close();
});

test("importarTudo rejeita um objeto que não é um backup válido", async () => {
  const db = await openDatabase();
  await assert.rejects(() => importarTudo(db, { foo: "bar" }), /Arquivo de backup inválido/);
  db.close();
});

test("importarTudo rejeita um backup cujo dados não tem nenhuma loja válida", async () => {
  const db = await openDatabase();
  await assert.rejects(() => importarTudo(db, { dados: {} }), /Arquivo de backup inválido/);
  db.close();
});

test("historicoParaCsv gera cabeçalho e uma linha por série", () => {
  const csv = historicoParaCsv([
    { data: "2026-08-01", exercicioId: "a", musculo: "peito", tipoSerie: "normal", carga: 14, reps: 10, rir: 2, serieNumero: 1 },
  ]);
  const linhas = csv.split("\n");
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0], "data,exercicioId,musculo,tipoSerie,carga,reps,rir,serieNumero");
  assert.equal(linhas[1], "2026-08-01,a,peito,normal,14,10,2,1");
});

test("exportarTudo inclui medidasCorporais", async () => {
  const db = await openDatabase();
  await clearStore(db, "medidasCorporais");
  await put(db, "medidasCorporais", { data: "2026-08-20", peso_kg: 70 });

  const backup = await exportarTudo(db);
  assert.equal(backup.dados.medidasCorporais.length, 1);
  assert.equal(backup.dados.medidasCorporais[0].peso_kg, 70);
  db.close();
});
