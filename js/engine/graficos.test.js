import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularProgressao1RM } from "./graficos.js";

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
