import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_SEQUENCIA,
  obterDiaPorNumero,
  obterMusculosDoDia,
  proximoDia,
  determinarDiaDaSessao,
  obterDiaPeloMusculo,
} from "./sequenciaSemanal.js";

test("DIAS_SEQUENCIA tem 5 dias na ordem e composição corretas", () => {
  assert.equal(DIAS_SEQUENCIA.length, 5);
  assert.deepEqual(DIAS_SEQUENCIA[0].musculos, ["peito", "triceps"]);
  assert.deepEqual(DIAS_SEQUENCIA[1].musculos, ["costas", "biceps"]);
  assert.deepEqual(DIAS_SEQUENCIA[2].musculos, ["peito", "ombro"]);
  assert.deepEqual(DIAS_SEQUENCIA[3].musculos, ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"]);
  assert.deepEqual(DIAS_SEQUENCIA[4].musculos, ["peito", "triceps"]);
  assert.equal(DIAS_SEQUENCIA[0].titulo, "Peito + Tríceps");
  assert.equal(DIAS_SEQUENCIA[3].titulo, "Pernas");
});

test("obterDiaPorNumero retorna o dia certo, e cai no dia 1 pra número inválido", () => {
  assert.equal(obterDiaPorNumero(3).titulo, "Peito + Ombro");
  assert.equal(obterDiaPorNumero(99).numero, 1);
});

test("obterMusculosDoDia é atalho pra obterDiaPorNumero(numero).musculos", () => {
  assert.deepEqual(obterMusculosDoDia(4), ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"]);
});

test("proximoDia avança na sequência e volta pro 1 depois do 5", () => {
  assert.equal(proximoDia(1), 2);
  assert.equal(proximoDia(4), 5);
  assert.equal(proximoDia(5), 1);
});

test("determinarDiaDaSessao começa no dia 1 sem registro anterior", () => {
  assert.equal(determinarDiaDaSessao(null, "2026-08-21"), 1);
});

test("determinarDiaDaSessao mantém o dia já decidido hoje", () => {
  assert.equal(determinarDiaDaSessao({ dia: 3, data: "2026-08-21" }, "2026-08-21"), 3);
});

test("determinarDiaDaSessao avança pro próximo dia hoje mesmo quando marcado concluído", () => {
  assert.equal(determinarDiaDaSessao({ dia: 3, data: "2026-08-21", concluido: true }, "2026-08-21"), 4);
});

test("determinarDiaDaSessao avança pro próximo dia quando o registro é de outra data", () => {
  assert.equal(determinarDiaDaSessao({ dia: 3, data: "2026-08-20" }, "2026-08-21"), 4);
});

test("determinarDiaDaSessao avança do dia 5 pro dia 1 (fecha o ciclo)", () => {
  assert.equal(determinarDiaDaSessao({ dia: 5, data: "2026-08-20" }, "2026-08-21"), 1);
});

test("obterDiaPeloMusculo retorna o primeiro dia da sequência que contém o músculo", () => {
  assert.equal(obterDiaPeloMusculo("peito").numero, 1);
  assert.equal(obterDiaPeloMusculo("ombro").numero, 3);
  assert.equal(obterDiaPeloMusculo("quadriceps").numero, 4);
});

test("obterDiaPeloMusculo retorna null pra músculo não mapeado", () => {
  assert.equal(obterDiaPeloMusculo("core_customizado"), null);
});
