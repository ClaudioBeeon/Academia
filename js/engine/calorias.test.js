import { test } from "node:test";
import assert from "node:assert/strict";
import { estimarCaloriasMusculacao, estimarCaloriasCardio, estimarCaloriasDaSessao } from "./calorias.js";

test("estimarCaloriasMusculacao retorna 0 sem séries ou sem peso", () => {
  assert.equal(estimarCaloriasMusculacao({ totalSeries: 0, pesoKg: 71 }), 0);
  assert.equal(estimarCaloriasMusculacao({ totalSeries: 12, pesoKg: 0 }), 0);
  assert.equal(estimarCaloriasMusculacao({ totalSeries: 12, pesoKg: null }), 0);
});

test("estimarCaloriasMusculacao cresce com mais séries e mais peso corporal", () => {
  const poucasSeries = estimarCaloriasMusculacao({ totalSeries: 6, pesoKg: 71 });
  const maisSeries = estimarCaloriasMusculacao({ totalSeries: 18, pesoKg: 71 });
  assert.ok(maisSeries > poucasSeries);

  const pesoMenor = estimarCaloriasMusculacao({ totalSeries: 12, pesoKg: 60 });
  const pesoMaior = estimarCaloriasMusculacao({ totalSeries: 12, pesoKg: 90 });
  assert.ok(pesoMaior > pesoMenor);
});

test("estimarCaloriasCardio usa o MET da modalidade e cai no padrão pra modalidade desconhecida", () => {
  const corrida = estimarCaloriasCardio({ modalidade: "corrida", duracaoMinutos: 30, pesoKg: 71 });
  const caminhada = estimarCaloriasCardio({ modalidade: "caminhada", duracaoMinutos: 30, pesoKg: 71 });
  assert.ok(corrida > caminhada);

  const desconhecida = estimarCaloriasCardio({ modalidade: "remo", duracaoMinutos: 30, pesoKg: 71 });
  assert.ok(desconhecida > 0);
});

test("estimarCaloriasCardio retorna 0 sem duração", () => {
  assert.equal(estimarCaloriasCardio({ modalidade: "corrida", duracaoMinutos: undefined, pesoKg: 71 }), 0);
  assert.equal(estimarCaloriasCardio({ modalidade: "corrida", duracaoMinutos: 0, pesoKg: 71 }), 0);
});

test("estimarCaloriasDaSessao soma musculação com todos os registros de cardio do dia", () => {
  const resultado = estimarCaloriasDaSessao({
    totalSeries: 15,
    pesoKg: 71,
    registrosCardioDoDia: [
      { modalidade: "bicicleta", duracaoMinutos: 20 },
      { modalidade: "corrida", duracaoMinutos: 10 },
    ],
  });
  assert.ok(resultado.musculacao > 0);
  assert.ok(resultado.cardio > 0);
  assert.equal(resultado.total, resultado.musculacao + resultado.cardio);
});

test("estimarCaloriasDaSessao ignora registro de cardio sem duração", () => {
  const resultado = estimarCaloriasDaSessao({
    totalSeries: 10,
    pesoKg: 71,
    registrosCardioDoDia: [{ modalidade: "corrida", duracaoMinutos: undefined }],
  });
  assert.equal(resultado.cardio, 0);
});
