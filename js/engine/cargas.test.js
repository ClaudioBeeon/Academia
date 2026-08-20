import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirCarga } from "./cargas.js";

test("sem amostras, não sugere carga (confiança nenhuma)", () => {
  const resultado = sugerirCarga([], 2);
  assert.equal(resultado.cargaSugerida, null);
  assert.equal(resultado.confianca, "nenhuma");
});

test("com uma amostra, ajusta pela distância entre o RIR relatado e o RIR-alvo", () => {
  const resultado = sugerirCarga([{ carga: 15, reps: 10, rir_relatado: 3 }], 2);
  assert.equal(resultado.cargaSugerida, 14.5);
  assert.equal(resultado.confianca, "baixa");
});

test("com duas amostras, sugere carga entre elas ajustada pelo RIR-alvo", () => {
  const resultado = sugerirCarga(
    [
      { carga: 14, reps: 10, rir_relatado: 4.5 },
      { carga: 16, reps: 8, rir_relatado: 0.5 },
    ],
    2
  );
  assert.ok(resultado.cargaSugerida > 14 && resultado.cargaSugerida < 16);
  assert.equal(resultado.confianca, "media");
});

test("com 4+ amostras, confiança é alta", () => {
  const resultado = sugerirCarga(
    [
      { carga: 14, reps: 10, rir_relatado: 4 },
      { carga: 15, reps: 10, rir_relatado: 3 },
      { carga: 16, reps: 9, rir_relatado: 1.5 },
      { carga: 16, reps: 8, rir_relatado: 1 },
    ],
    2
  );
  assert.equal(resultado.confianca, "alta");
});

test("todas as amostras com a mesma carga: sugere essa carga sem divisão por zero", () => {
  const resultado = sugerirCarga(
    [
      { carga: 15, reps: 10, rir_relatado: 2 },
      { carga: 15, reps: 9, rir_relatado: 1.5 },
    ],
    2
  );
  assert.equal(resultado.cargaSugerida, 15);
});
