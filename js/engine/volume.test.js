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

test("expandirContribuicoes credita o primário com 1 e os secundários com a fração do catálogo", async () => {
  const { expandirContribuicoes } = await import("./volume.js");
  const catalogo = [
    { id: "remada", musculoPrimario: "costas", musculosSecundarios: [{ musculo: "biceps", contribuicao: 0.5 }, { musculo: "deltoide_posterior", contribuicao: 0.5 }] },
  ];
  const series = [{ exercicioId: "remada", musculo: "costas", contribuicao: 1, tipoSerie: "normal" }];
  const r = calcularVolumeSemanal(expandirContribuicoes(series, catalogo));
  assert.deepEqual(r.porMusculo, { costas: 1, biceps: 0.5, deltoide_posterior: 0.5 });
});

test("expandirContribuicoes mantém como gravada a série de exercício fora do catálogo", async () => {
  const { expandirContribuicoes } = await import("./volume.js");
  const r = expandirContribuicoes([{ exercicioId: "x", musculo: "peito", contribuicao: 1 }], []);
  assert.equal(r.length, 1);
  assert.equal(r[0].musculo, "peito");
});

test("drop-set e rest-pause contam meia série no volume", async () => {
  const { expandirContribuicoes } = await import("./volume.js");
  const catalogo = [{ id: "rosca", musculoPrimario: "biceps", musculosSecundarios: [] }];
  const series = [
    { exercicioId: "rosca", tipoSerie: "normal" },
    { exercicioId: "rosca", tipoSerie: "drop" },
  ];
  assert.deepEqual(calcularVolumeSemanal(expandirContribuicoes(series, catalogo)).porMusculo, { biceps: 1.5 });
});
