import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularAnilhas } from "./anilhas.js";

test("calcula as anilhas por lado para um peso alvo exato", () => {
  const resultado = calcularAnilhas(60, 20, [20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(resultado.anilhasPorLado, [20]);
  assert.equal(resultado.pesoPorLado, 20);
  assert.equal(resultado.restante, 0);
  assert.equal(resultado.atingivel, true);
});

test("combina anilhas diferentes quando uma só não fecha o peso", () => {
  const resultado = calcularAnilhas(47.5, 20, [20, 15, 10, 5, 2.5, 1.25]);
  // pesoPorLado = (47.5-20)/2 = 13.75 -> 10 + 2.5 + 1.25 = 13.75
  assert.deepEqual(resultado.anilhasPorLado, [10, 2.5, 1.25]);
  assert.equal(resultado.restante, 0);
  assert.equal(resultado.atingivel, true);
});

test("peso alvo igual ao peso da barra não precisa de anilhas", () => {
  const resultado = calcularAnilhas(20, 20, [20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(resultado.anilhasPorLado, []);
  assert.equal(resultado.atingivel, true);
});

test("peso alvo abaixo do peso da barra não é atingível", () => {
  const resultado = calcularAnilhas(15, 20, [20, 15, 10, 5, 2.5, 1.25]);
  assert.deepEqual(resultado.anilhasPorLado, []);
  assert.equal(resultado.atingivel, false);
});

test("peso que não fecha exatamente reporta o restante", () => {
  const resultado = calcularAnilhas(41, 20, [20, 15, 10]);
  // pesoPorLado = 10.5, só dá pra fechar 10, sobra 0.5
  assert.deepEqual(resultado.anilhasPorLado, [10]);
  assert.equal(resultado.restante, 0.5);
  assert.equal(resultado.atingivel, false);
});
