import { test } from "node:test";
import assert from "node:assert/strict";
import { criarCronometro } from "./timer.js";

test("tick decrementa o restante e chama aoAtualizar", () => {
  const atualizacoes = [];
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 5,
    aoAtualizar: (restante) => atualizacoes.push(restante),
    aoFinalizar: () => {},
  });
  cronometro.tick();
  assert.equal(cronometro.obterRestante(), 4);
  assert.deepEqual(atualizacoes, [4]);
});

test("chama aoFinalizar quando chega a zero", () => {
  let finalizou = false;
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 1,
    aoAtualizar: () => {},
    aoFinalizar: () => { finalizou = true; },
  });
  cronometro.tick();
  assert.equal(cronometro.obterRestante(), 0);
  assert.equal(finalizou, true);
});

test("ajustar soma segundos e nunca deixa negativo", () => {
  const atualizacoes = [];
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 10,
    aoAtualizar: (restante) => atualizacoes.push(restante),
    aoFinalizar: () => {},
  });
  cronometro.ajustar(30);
  assert.equal(cronometro.obterRestante(), 40);
  cronometro.ajustar(-100);
  assert.equal(cronometro.obterRestante(), 0);
  assert.deepEqual(atualizacoes, [40, 0]);
});

test("iniciar usa a implementação de setInterval injetada", () => {
  let callback = null;
  let intervalMs = null;
  const fakeSetInterval = (cb, ms) => { callback = cb; intervalMs = ms; return 123; };
  const cronometro = criarCronometro({
    duracaoInicialSegundos: 5,
    aoAtualizar: () => {},
    aoFinalizar: () => {},
  });
  cronometro.iniciar(fakeSetInterval);
  assert.equal(intervalMs, 1000);
  assert.equal(typeof callback, "function");
});
