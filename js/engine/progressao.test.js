// js/engine/progressao.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarProgressao } from "./progressao.js";

test("sobe carga quando todas as séries batem o topo da faixa com RIR suficiente", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 12, rir: 2 }, { reps: 12, rir: 3 }],
    sessaoAnterior: null,
  });
  assert.equal(resultado.acao, "aumentar_carga");
});

test("reduz carga quando fica abaixo do mínimo por 2 sessões seguidas", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 6, rir: 2 }],
    sessaoAnterior: [{ reps: 7, rir: 2 }],
  });
  assert.equal(resultado.acao, "reduzir_carga");
});

test("mantém quando está dentro da faixa mas ainda não bateu o topo", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 10, rir: 2 }],
    sessaoAnterior: [{ reps: 9, rir: 2 }],
  });
  assert.equal(resultado.acao, "manter");
});

test("não reduz na primeira sessão abaixo do mínimo (precisa de 2 seguidas)", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [{ reps: 6, rir: 2 }],
    sessaoAnterior: null,
  });
  assert.equal(resultado.acao, "manter");
});

test("mantém quando não há séries registradas (não infere aumento por lista vazia)", () => {
  const resultado = avaliarProgressao({
    faixaMin: 8, faixaMax: 12, rirAlvo: 2,
    sessaoAtual: [],
    sessaoAnterior: null,
  });
  assert.equal(resultado.acao, "manter");
});
