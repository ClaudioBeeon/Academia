import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularCoberturaMuscular } from "./cobertura.js";

const definicaoFase = {
  musculoPriorizadoCrescimento: ["peito", "biceps"],
  musculoEmManutencao: ["gluteo", "panturrilha", "abdomen"],
  musculoEmRecomposicao: ["costas", "deltoide_posterior"],
  faixasPadrao: { alvo_min: 10, alvo_max: 16 },
  faixasManutencao: { alvo_min: 6, alvo_max: 9 },
  faixasRecomposicao: { alvo_min: 10, alvo_max: 17 },
  faixasPriorizado: { alvo_min: 15, alvo_max: 20 },
};

function serie(musculo) {
  return { musculo, tipoSerie: "normal" };
}

test("classifica cada músculo na categoria certa e aponta abaixo do alvo", () => {
  const series = [
    ...Array(11).fill(0).map(() => serie("biceps")), // priorizado, alvo 15-20 -> abaixo
    ...Array(15).fill(0).map(() => serie("peito")), // priorizado, alvo 15-20 -> ok
    ...Array(4).fill(0).map(() => serie("panturrilha")), // manutenção, alvo 6-9 -> abaixo
    ...Array(14).fill(0).map(() => serie("costas")), // recomposição, alvo 10-17 -> ok
  ];
  const resultado = calcularCoberturaMuscular({ seriesUltimos7Dias: series, definicaoFase });
  const porMusculo = Object.fromEntries(resultado.map((r) => [r.musculo, r]));

  assert.equal(porMusculo.biceps.categoria, "priorizado");
  assert.equal(porMusculo.biceps.abaixoDoAlvo, true);
  assert.equal(porMusculo.peito.abaixoDoAlvo, false);
  assert.equal(porMusculo.panturrilha.categoria, "manutencao");
  assert.equal(porMusculo.panturrilha.abaixoDoAlvo, true);
  assert.equal(porMusculo.costas.categoria, "recomposicao");
  assert.equal(porMusculo.costas.abaixoDoAlvo, false);
});

test("músculo fora das listas da fase cai em padrão", () => {
  const series = Array(5).fill(0).map(() => serie("antebraco"));
  const resultado = calcularCoberturaMuscular({ seriesUltimos7Dias: series, definicaoFase });
  assert.equal(resultado[0].categoria, "padrao");
  assert.equal(resultado[0].min, 10);
});

test("ignora séries de aquecimento na contagem", () => {
  const series = [serie("peito"), { musculo: "peito", tipoSerie: "aquecimento" }];
  const resultado = calcularCoberturaMuscular({ seriesUltimos7Dias: series, definicaoFase });
  assert.equal(resultado.find((r) => r.musculo === "peito").atual, 1);
});

test("sem definicaoFase, não afirma faixa nem classifica erroneamente", () => {
  const resultado = calcularCoberturaMuscular({ seriesUltimos7Dias: [serie("peito")], definicaoFase: null });
  assert.equal(resultado[0].categoria, "padrao");
  assert.equal(resultado[0].min, null);
  assert.equal(resultado[0].abaixoDoAlvo, false);
});

test("sem séries no período, retorna lista vazia", () => {
  const resultado = calcularCoberturaMuscular({ seriesUltimos7Dias: [], definicaoFase });
  assert.deepEqual(resultado, []);
});
