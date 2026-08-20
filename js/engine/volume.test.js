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
  assert.equal(resultado.peito, 2.0);
  assert.equal(resultado.triceps, 0.5);
});

test("séries de aquecimento não contam no volume", () => {
  const series = [
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "aquecimento" },
    { musculo: "peito", contribuicao: 1.0, tipoSerie: "normal" },
  ];
  const resultado = calcularVolumeSemanal(series);
  assert.equal(resultado.peito, 1.0);
});
