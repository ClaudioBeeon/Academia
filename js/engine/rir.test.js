import { test } from "node:test";
import assert from "node:assert/strict";
import { validarRir } from "./rir.js";

test("capacidade da série seguinte bem maior com a mesma carga: RIR anterior provavelmente baixo demais", () => {
  const r = validarRir({ serieAnterior: { carga: 20, reps: 8, rir: 1 }, serieAtual: { carga: 20, reps: 11, rir: 1 } });
  assert.equal(r.suspeitaSubestimado, true);
  assert.ok(r.mensagem);
});

test("caso coerente não é acusado: 8 @RIR2 seguida de 9 @RIR0 (capacidade 10 → 9)", () => {
  const r = validarRir({ serieAnterior: { carga: 20, reps: 8, rir: 2 }, serieAtual: { carga: 20, reps: 9, rir: 0 } });
  assert.equal(r.suspeitaSubestimado, false);
});

test("diferença de 1 rep fica dentro da tolerância", () => {
  const r = validarRir({ serieAnterior: { carga: 20, reps: 8, rir: 2 }, serieAtual: { carga: 20, reps: 9, rir: 2 } });
  assert.equal(r.suspeitaSubestimado, false);
});

test("acima de 12 reps a tolerância é maior (2 reps)", () => {
  const r = validarRir({ serieAnterior: { carga: 10, reps: 15, rir: 1 }, serieAtual: { carga: 10, reps: 17, rir: 1 } });
  assert.equal(r.suspeitaSubestimado, false);
});

test("carga diferente ou RIR não informado: não opina", () => {
  assert.equal(validarRir({ serieAnterior: { carga: 20, reps: 8, rir: 1 }, serieAtual: { carga: 18, reps: 12, rir: 1 } }).suspeitaSubestimado, false);
  assert.equal(validarRir({ serieAnterior: { carga: 20, reps: 8, rir: null }, serieAtual: { carga: 20, reps: 12, rir: 1 } }).suspeitaSubestimado, false);
  assert.equal(validarRir({ serieAnterior: null, serieAtual: { carga: 20, reps: 12, rir: 1 } }).suspeitaSubestimado, false);
});
