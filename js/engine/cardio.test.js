import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarCardio } from "./cardio.js";

test("corrida em dia de inferior retorna aviso de modalidade não recomendada", () => {
  const aviso = avaliarCardio({ modalidade: "corrida", grupoDoDia: "inferior" });
  assert.ok(aviso);
  assert.equal(aviso.tipo, "modalidade_nao_recomendada");
});

test("corrida em dia de superior não gera aviso", () => {
  const aviso = avaliarCardio({ modalidade: "corrida", grupoDoDia: "superior" });
  assert.equal(aviso, null);
});

test("bicicleta em dia de inferior não gera aviso", () => {
  const aviso = avaliarCardio({ modalidade: "bicicleta", grupoDoDia: "inferior" });
  assert.equal(aviso, null);
});
