import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularProgressao1RM, calcularVolumeSemanalPorMusculo } from "./graficos.js";

test("agrupa por dia e mantém o maior 1RM estimado do dia", () => {
  const series = [
    { data: "2026-08-01", carga: 90, reps: 3, tipoSerie: "normal" },
    { data: "2026-08-01", carga: 80, reps: 9, tipoSerie: "normal" },
    { data: "2026-08-03", carga: 60, reps: 15, tipoSerie: "normal" },
  ];
  const resultado = calcularProgressao1RM(series);
  assert.deepEqual(resultado, [
    { data: "2026-08-01", carga1RM: 104 },
    { data: "2026-08-03", carga1RM: 90 },
  ]);
});

test("ignora séries de aquecimento", () => {
  const series = [
    { data: "2026-08-01", carga: 200, reps: 5, tipoSerie: "aquecimento" },
    { data: "2026-08-01", carga: 80, reps: 9, tipoSerie: "normal" },
  ];
  const resultado = calcularProgressao1RM(series);
  assert.deepEqual(resultado, [{ data: "2026-08-01", carga1RM: 104 }]);
});

test("array vazio ou só aquecimento retorna array vazio", () => {
  assert.deepEqual(calcularProgressao1RM([]), []);
  assert.deepEqual(
    calcularProgressao1RM([{ data: "2026-08-01", carga: 50, reps: 5, tipoSerie: "aquecimento" }]),
    []
  );
});

test("ordena o resultado por data ascendente mesmo com entrada fora de ordem", () => {
  const series = [
    { data: "2026-08-03", carga: 60, reps: 15, tipoSerie: "normal" },
    { data: "2026-08-01", carga: 80, reps: 9, tipoSerie: "normal" },
  ];
  const resultado = calcularProgressao1RM(series);
  assert.deepEqual(resultado.map((p) => p.data), ["2026-08-01", "2026-08-03"]);
});

test("agrupa por semana ISO e soma contribuição por músculo", () => {
  const series = [
    { data: "2026-08-17", musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
    { data: "2026-08-19", musculo: "peito", contribuicao: 0.5, tipoSerie: "normal" },
    { data: "2026-08-24", musculo: "peito", contribuicao: 2.0, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.deepEqual(resultado.peito, [
    { semana: "2026-W34", volume: 1.5 },
    { semana: "2026-W35", volume: 2.0 },
  ]);
});

test("exclui séries de aquecimento do volume semanal", () => {
  const series = [
    { data: "2026-08-17", musculo: "peito", contribuicao: 5, tipoSerie: "aquecimento" },
    { data: "2026-08-17", musculo: "peito", contribuicao: 1, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.deepEqual(resultado.peito, [{ semana: "2026-W34", volume: 1 }]);
});

test("vira o ano corretamente na virada de dezembro para janeiro", () => {
  const series = [
    { data: "2025-12-28", musculo: "costas", contribuicao: 1, tipoSerie: "normal" },
    { data: "2025-12-29", musculo: "costas", contribuicao: 1, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.deepEqual(resultado.costas, [
    { semana: "2025-W52", volume: 1 },
    { semana: "2026-W01", volume: 1 },
  ]);
});

test("respeita o limite de semanas, contando a partir da semana mais recente nos dados", () => {
  const datas = ["2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"];
  const series = datas.map((data) => ({ data, musculo: "peito", contribuicao: 1, tipoSerie: "normal" }));
  const resultado = calcularVolumeSemanalPorMusculo(series, 3);
  assert.deepEqual(resultado.peito.map((s) => s.semana), ["2026-W33", "2026-W34", "2026-W35"]);
});

test("músculo sem série no período não aparece nas chaves do resultado", () => {
  const series = [{ data: "2026-08-17", musculo: "peito", contribuicao: 1, tipoSerie: "normal" }];
  const resultado = calcularVolumeSemanalPorMusculo(series);
  assert.equal("costas" in resultado, false);
});

test("array vazio retorna objeto vazio", () => {
  assert.deepEqual(calcularVolumeSemanalPorMusculo([]), {});
});
