import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularVolumeSemanal } from "./volume.js";

test("soma contribuição direta e indireta por músculo", () => {
  const series = [
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
    { musculo: "triceps", contribuicao: 0.5, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanal(series);
  assert.equal(resultado.porMusculo.peito, 2.0);
  assert.equal(resultado.porMusculo.triceps, 0.5);
});

test("séries de aquecimento não contam no volume", () => {
  const series = [
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "aquecimento" },
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanal(series);
  assert.equal(resultado.porMusculo.peito, 1.0);
});

test("série com contribuicao ausente não gera NaN", () => {
  const series = [{ musculo: "peito", tipoSerie: "normal" }];
  const resultado = calcularVolumeSemanal(series);
  assert.equal(resultado.porMusculo.peito, 0);
});
