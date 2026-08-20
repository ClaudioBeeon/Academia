import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarCardio } from "./cardio.js";

test("corrida em dia de pernas retorna aviso de modalidade não recomendada", () => {
  const aviso = avaliarCardio({ modalidade: "corrida", ehDiaDePernas: true });
  assert.ok(aviso);
  assert.equal(aviso.tipo, "modalidade_nao_recomendada");
});

test("corrida fora de dia de pernas não gera aviso", () => {
  const aviso = avaliarCardio({ modalidade: "corrida", ehDiaDePernas: false });
  assert.equal(aviso, null);
});

test("bicicleta em dia de pernas não gera aviso", () => {
  const aviso = avaliarCardio({ modalidade: "bicicleta", ehDiaDePernas: true });
  assert.equal(aviso, null);
});
