import { test } from "node:test";
import assert from "node:assert/strict";
import { validarRir } from "./rir.js";

test("marca RIR como suspeito de superestimado", () => {
  const resultado = validarRir({
    rirDeclarado: 2, repsSerieAtual: 10, repsSerieSeguinte: 12, cargaIgual: true,
  });
  assert.equal(resultado.suspeitaSuperestimado, true);
  assert.ok(resultado.mensagem.length > 0);
  assert.equal(resultado.principio, "P4");
  assert.equal(resultado.secao, "22.5");
});

test("não marca suspeita quando a carga mudou", () => {
  const resultado = validarRir({
    rirDeclarado: 2, repsSerieAtual: 10, repsSerieSeguinte: 12, cargaIgual: false,
  });
  assert.equal(resultado.suspeitaSuperestimado, false);
  assert.equal(resultado.principio, "P4");
  assert.equal(resultado.secao, "22.5");
});

test("não marca suspeita quando RIR declarado já é alto", () => {
  const resultado = validarRir({
    rirDeclarado: 4, repsSerieAtual: 10, repsSerieSeguinte: 12, cargaIgual: true,
  });
  assert.equal(resultado.suspeitaSuperestimado, false);
  assert.equal(resultado.principio, "P4");
  assert.equal(resultado.secao, "22.5");
});
