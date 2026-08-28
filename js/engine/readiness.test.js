import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularReadiness } from "./readiness.js";

test("calcularReadiness retorna 100/ótimo sem nenhum fator negativo", () => {
  const r = calcularReadiness({ sonoOntem: "bom", alcoolOntem: false, sequenciaDias: 5 });
  assert.equal(r.score, 100);
  assert.equal(r.categoria, "otimo");
  assert.deepEqual(r.fatores, []);
});

test("calcularReadiness desconta mais por sono ruim que por sono médio", () => {
  const ruim = calcularReadiness({ sonoOntem: "ruim" });
  const medio = calcularReadiness({ sonoOntem: "medio" });
  assert.ok(ruim.score < medio.score);
});

test("calcularReadiness soma múltiplos fatores negativos", () => {
  const r = calcularReadiness({ sonoOntem: "ruim", alcoolOntem: true, sequenciaDias: 0 });
  assert.equal(r.score, 100 - 35 - 20 - 15);
  assert.equal(r.fatores.length, 3);
});

test("calcularReadiness nunca fica negativo mesmo empilhando fatores", () => {
  const r = calcularReadiness({ sonoOntem: "ruim", alcoolOntem: true, sequenciaDias: 0 });
  assert.ok(r.score >= 0);
});

test("calcularReadiness categoriza corretamente nas quatro faixas", () => {
  assert.equal(calcularReadiness({ sequenciaDias: 5 }).categoria, "otimo");
  assert.equal(calcularReadiness({ sonoOntem: "ruim", sequenciaDias: 5 }).categoria, "bom");
  assert.equal(calcularReadiness({ sonoOntem: "ruim", alcoolOntem: true, sequenciaDias: 5 }).categoria, "atencao");
  assert.equal(calcularReadiness({ sonoOntem: "ruim", alcoolOntem: true, sequenciaDias: 0 }).categoria, "baixo");
});
