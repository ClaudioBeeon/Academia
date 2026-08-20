import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularEstatisticasSessao } from "./sessao.js";

test("array vazio retorna os quatro campos zerados", () => {
  const resultado = calcularEstatisticasSessao([]);
  assert.deepEqual(resultado, {
    totalSeries: 0,
    volumeTotal: 0,
    exerciciosTreinados: 0,
    musculosTreinados: [],
  });
});

test("exclui séries de aquecimento de todas as métricas", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 20, reps: 10, tipoSerie: "aquecimento" },
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.equal(resultado.totalSeries, 1);
  assert.equal(resultado.volumeTotal, 600);
});

test("conta exercícios distintos, não séries", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
    { exercicioId: "a", musculo: "peito", carga: 62.5, reps: 8, tipoSerie: "normal" },
    { exercicioId: "b", musculo: "triceps", carga: 20, reps: 12, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.equal(resultado.totalSeries, 3);
  assert.equal(resultado.exerciciosTreinados, 2);
});

test("soma volume como carga vezes reps de cada série", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
    { exercicioId: "b", musculo: "costas", carga: 20, reps: 8, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.equal(resultado.volumeTotal, 760);
});

test("musculosTreinados vem sem duplicatas e ordenado", () => {
  const series = [
    { exercicioId: "a", musculo: "peito", carga: 60, reps: 10, tipoSerie: "normal" },
    { exercicioId: "b", musculo: "triceps", carga: 20, reps: 8, tipoSerie: "normal" },
    { exercicioId: "c", musculo: "peito", carga: 40, reps: 10, tipoSerie: "normal" },
  ];
  const resultado = calcularEstatisticasSessao(series);
  assert.deepEqual(resultado.musculosTreinados, ["peito", "triceps"]);
});
