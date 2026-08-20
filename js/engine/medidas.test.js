import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararSerieTemporal } from "./medidas.js";

test("filtra linhas sem o campo pedido", () => {
  const linhas = [
    { data: "2026-08-01", peso_kg: 71 },
    { data: "2026-08-05", cintura_cm: 61 },
    { data: "2026-08-10", peso_kg: 70.5 },
  ];
  const resultado = prepararSerieTemporal(linhas, "peso_kg");
  assert.deepEqual(resultado, [
    { data: "2026-08-01", valor: 71 },
    { data: "2026-08-10", valor: 70.5 },
  ]);
});

test("ordena por data ascendente mesmo com entrada fora de ordem", () => {
  const linhas = [
    { data: "2026-08-10", peso_kg: 70.5 },
    { data: "2026-08-01", peso_kg: 71 },
  ];
  const resultado = prepararSerieTemporal(linhas, "peso_kg");
  assert.deepEqual(resultado.map((p) => p.data), ["2026-08-01", "2026-08-10"]);
});

test("funciona igualmente para qualquer nome de campo", () => {
  const linhas = [{ data: "2026-08-01", percentualGordura: 20 }];
  const resultado = prepararSerieTemporal(linhas, "percentualGordura");
  assert.deepEqual(resultado, [{ data: "2026-08-01", valor: 20 }]);
});

test("array vazio retorna array vazio", () => {
  assert.deepEqual(prepararSerieTemporal([], "peso_kg"), []);
});

test("campo presente mas null é tratado como ausente", () => {
  const linhas = [{ data: "2026-08-01", peso_kg: null }, { data: "2026-08-02", peso_kg: 70 }];
  const resultado = prepararSerieTemporal(linhas, "peso_kg");
  assert.deepEqual(resultado, [{ data: "2026-08-02", valor: 70 }]);
});
