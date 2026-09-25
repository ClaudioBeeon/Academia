import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirProximaCarga, capacidadeDaSerie } from "./progressao.js";

const FAIXA = { faixaMin: 8, faixaMax: 12, rirAlvo: 2, incremento: 2 };
const sessao = (data, series) => ({ data, series });
const s = (carga, reps, rir = 2, extra = {}) => ({ carga, reps, rir, tipoSerie: "normal", ...extra });

test("sem histórico: primeira vez, sem carga sugerida", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [] });
  assert.equal(r.acao, "primeira_vez");
  assert.equal(r.carga, null);
  assert.equal(r.repsAlvo, 8);
});

test("todas as séries no topo da faixa dentro do RIR: sobe um incremento e volta pro fundo", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [sessao("2026-09-18", [s(8, 12), s(8, 12), s(8, 12)])] });
  assert.equal(r.acao, "aumentar");
  assert.equal(r.carga, 10);
  assert.equal(r.repsAlvo, 8);
});

test("base é a MAIOR carga de trabalho, nunca a média — série leve no começo não puxa pra baixo nem trava a subida", () => {
  // Caso real da remada baixa: 10/25/25 virava 20 kg na regressão antiga.
  const r = sugerirProximaCarga({
    faixaMin: 10, faixaMax: 15, rirAlvo: 1, incremento: 2.5,
    historicoSessoes: [sessao("2026-08-24", [s(10, 15, 1), s(25, 15, 1), s(25, 15, 1)])],
  });
  assert.equal(r.acao, "aumentar");
  assert.equal(r.carga, 27.5);
});

test("só uma série na carga mais alta (e outras mais leves) não basta pra subir", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [sessao("d", [s(20, 12), s(20, 12), s(24, 12)])] });
  assert.equal(r.acao, "manter");
  assert.equal(r.carga, 24);
});

test("sessão de uma série só no topo da faixa sobe normalmente", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [sessao("d", [s(20, 12)])] });
  assert.equal(r.acao, "aumentar");
});

test("séries de aquecimento são ignoradas na decisão", () => {
  const r = sugerirProximaCarga({
    faixaMin: 10, faixaMax: 15, rirAlvo: 1, incremento: 2.5,
    historicoSessoes: [sessao("2026-08-24", [s(10, 12, 5, { tipoSerie: "aquecimento" }), s(25, 15, 1), s(25, 15, 1)])],
  });
  assert.equal(r.acao, "aumentar");
  assert.equal(r.carga, 27.5);
});

test("topo da faixa mas bem mais perto da falha que o alvo (RIR < alvo − 1): não sobe", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [sessao("d", [s(8, 12, 0), s(8, 12, 0)])] });
  assert.equal(r.acao, "manter");
  assert.equal(r.carga, 8);
});

test("RIR não informado não trava a subida — decide pelas reps", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [sessao("d", [s(8, 12, null), s(8, 12, null)])] });
  assert.equal(r.acao, "aumentar");
});

test("dentro da faixa: mantém a carga e pede +1 rep na série mais baixa", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [sessao("d", [s(20, 11), s(20, 10), s(20, 9)])] });
  assert.equal(r.acao, "manter");
  assert.equal(r.carga, 20);
  assert.equal(r.repsAlvo, 10);
});

test("abaixo do mínimo em 2 sessões seguidas com a mesma carga: reduz ~5% (pelo menos 1 incremento)", () => {
  const r = sugerirProximaCarga({
    ...FAIXA,
    historicoSessoes: [sessao("d2", [s(40, 9), s(40, 7)]), sessao("d1", [s(40, 10), s(40, 6)])],
  });
  assert.equal(r.acao, "reduzir");
  assert.equal(r.carga, 38);
});

test("abaixo do mínimo só uma vez: ainda não reduz", () => {
  const r = sugerirProximaCarga({
    ...FAIXA,
    historicoSessoes: [sessao("d2", [s(40, 9), s(40, 7)]), sessao("d1", [s(40, 10), s(40, 9)])],
  });
  assert.equal(r.acao, "manter");
});

test("abaixo do mínimo logo depois de subir a carga (cargas diferentes) não conta como 2 seguidas", () => {
  const r = sugerirProximaCarga({
    ...FAIXA,
    historicoSessoes: [sessao("d2", [s(42, 7)]), sessao("d1", [s(40, 7)])],
  });
  assert.equal(r.acao, "manter");
});

test("sessões de deload são ignoradas: decide pela última sessão normal", () => {
  const r = sugerirProximaCarga({
    ...FAIXA,
    historicoSessoes: [
      sessao("deload", [s(8, 8, 4, { semanaBloco: 7 })]),
      sessao("normal", [s(8, 12), s(8, 12)]),
    ],
  });
  assert.equal(r.acao, "aumentar");
  assert.equal(r.carga, 10);
});

test("exercício sem incremento de carga (prancha): progride na dificuldade, não no peso", () => {
  const r = sugerirProximaCarga({
    faixaMin: 30, faixaMax: 60, rirAlvo: 1, incremento: 0,
    historicoSessoes: [sessao("d", [s(0, 60), s(0, 60)])],
  });
  assert.equal(r.acao, "aumentar");
  assert.equal(r.carga, 0);
});

test("incrementos fracionados não geram lixo de ponto flutuante", () => {
  const r = sugerirProximaCarga({
    faixaMin: 10, faixaMax: 15, rirAlvo: 1, incremento: 2.5,
    historicoSessoes: [sessao("d", [s(22.5, 15, 1), s(22.5, 15, 1)])],
  });
  assert.equal(r.carga, 25);
});

test("capacidadeDaSerie soma reps e RIR", () => {
  assert.equal(capacidadeDaSerie({ reps: 8, rir: 2 }), 10);
  assert.equal(capacidadeDaSerie({ reps: 8, rir: null }), 8);
  assert.equal(capacidadeDaSerie({}), null);
});

test("mini-séries de drop-set e rest-pause não entram na decisão de carga", () => {
  const r = sugerirProximaCarga({ ...FAIXA, historicoSessoes: [sessao("d", [s(20, 12), s(20, 12), s(14, 6, 0, { tipoSerie: "drop" })])] });
  assert.equal(r.acao, "aumentar");
  assert.equal(r.carga, 22);
});
