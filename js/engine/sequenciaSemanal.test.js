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

// Estrutura revisada pela auditoria de 2026-08-23 — ver comentário no topo de
// sequenciaSemanal.js. O dia 1 deixou de ser "Peito + Tríceps" e virou o
// principal dia de correção postural.
test("DIAS_SEQUENCIA tem 5 dias na ordem e composição corretas", () => {
  assert.equal(DIAS_SEQUENCIA.length, 5);
  assert.deepEqual(DIAS_SEQUENCIA[0].musculos, ["peito", "costas", "deltoide_posterior", "triceps"]);
  assert.deepEqual(DIAS_SEQUENCIA[1].musculos, ["costas", "biceps"]);
  assert.deepEqual(DIAS_SEQUENCIA[2].musculos, ["peito", "ombro", "deltoide_posterior", "triceps", "abdomen"]);
  assert.deepEqual(DIAS_SEQUENCIA[3].musculos, ["quadriceps", "posterior_coxa", "gluteo", "panturrilha"]);
  assert.deepEqual(DIAS_SEQUENCIA[4].musculos, ["peito", "biceps", "ombro", "antebraco"]);
  assert.equal(DIAS_SEQUENCIA[0].titulo, "Peito (inclinado) + Costas + Deltoide posterior + Tríceps");
  assert.equal(DIAS_SEQUENCIA[3].titulo, "Pernas + Impulsão");
});

test("peito abre os dias 1, 3 e 5 — é a prioridade e vem sempre primeiro", () => {
  for (const indice of [0, 2, 4]) {
    assert.equal(DIAS_SEQUENCIA[indice].musculos[0], "peito");
  }
});

test("obterDiaPorNumero retorna o dia certo, e cai no dia 1 pra número inválido", () => {
  assert.equal(obterDiaPorNumero(3).titulo, "Peito (horizontal) + Ombros + Tríceps + Abdômen");
  assert.equal(obterDiaPorNumero(99).numero, 1);
});

test("obterMusculosDoDia é atalho pra obterDiaPorNumero(numero).musculos", () => {
  assert.deepEqual(obterMusculosDoDia(4), ["quadriceps", "posterior_coxa", "gluteo", "panturrilha"]);
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

test("determinarDiaDaSessao mantém o dia mesmo marcado concluído — só avança na virada real de data", () => {
  assert.equal(determinarDiaDaSessao({ dia: 3, data: "2026-08-21", concluido: true }, "2026-08-21"), 3);
});

test("determinarDiaDaSessao avança pro próximo dia quando o registro é de outra data", () => {
  assert.equal(determinarDiaDaSessao({ dia: 3, data: "2026-08-20" }, "2026-08-21"), 4);
});

test("determinarDiaDaSessao avança do dia 5 pro dia 1 (fecha o ciclo)", () => {
  assert.equal(determinarDiaDaSessao({ dia: 5, data: "2026-08-20" }, "2026-08-21"), 1);
});

test("obterDiaPeloMusculo retorna o primeiro dia da sequência que contém o músculo", () => {
  assert.equal(obterDiaPeloMusculo("peito").numero, 1);
  assert.equal(obterDiaPeloMusculo("costas").numero, 1);
  assert.equal(obterDiaPeloMusculo("deltoide_posterior").numero, 1);
  assert.equal(obterDiaPeloMusculo("ombro").numero, 3);
  assert.equal(obterDiaPeloMusculo("quadriceps").numero, 4);
  assert.equal(obterDiaPeloMusculo("antebraco").numero, 5);
});

test("obterDiaPeloMusculo retorna null pra músculo não mapeado", () => {
  assert.equal(obterDiaPeloMusculo("core_customizado"), null);
});

// Dias de vôlei (seg, qui, dom): pernas nunca no dia do jogo nem na véspera.
import { estadoDaSequencia, pernasRestritas, ehDiaDeVolei } from "./sequenciaSemanal.js";
const VOLEI = [0, 1, 4];

test("pernas restritas no dia do vôlei e na véspera; livres na terça e na sexta", () => {
  // 2026-10-19 é segunda.
  const semana = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
  assert.deepEqual(semana.map((d) => pernasRestritas(d, VOLEI)), [true, false, true, true, false, true, true]);
  assert.equal(ehDiaDeVolei("2026-10-22", VOLEI), true);
  assert.equal(pernasRestritas("2026-10-21", []), false, "sem dias de vôlei, nada muda");
});

test("vez de pernas na véspera do vôlei: faz o treino 5, pernas fica devida e entra no próximo dia livre", () => {
  // Fez o 3 na terça; quarta (véspera de quinta) seria pernas.
  let ultimo = { dia: 3, data: "2026-10-20" };
  const quarta = determinarDiaDaSessao(ultimo, "2026-10-21", { diasVolei: VOLEI });
  assert.equal(quarta, 5);
  ultimo = { dia: quarta, data: "2026-10-21", ...estadoDaSequencia(ultimo, "2026-10-21", quarta) };
  assert.equal(ultimo.pernasDevidas, true);

  // Quinta é dia de vôlei: segue a rotação (1), pernas continua devida.
  const quinta = determinarDiaDaSessao(ultimo, "2026-10-22", { diasVolei: VOLEI });
  assert.equal(quinta, 1);
  ultimo = { dia: quinta, data: "2026-10-22", ...estadoDaSequencia(ultimo, "2026-10-22", quinta) };
  assert.equal(ultimo.pernasDevidas, true);

  // Sexta é livre: pernas. Depois a rotação continua do 1 → 2.
  const sexta = determinarDiaDaSessao(ultimo, "2026-10-23", { diasVolei: VOLEI });
  assert.equal(sexta, 4);
  ultimo = { dia: sexta, data: "2026-10-23", ...estadoDaSequencia(ultimo, "2026-10-23", sexta) };
  assert.deepEqual([ultimo.pernasDevidas, ultimo.ponteiro], [false, 1]);
  assert.equal(determinarDiaDaSessao(ultimo, "2026-10-24", { diasVolei: VOLEI }), 2);
});

test("no mesmo dia, o estado gravado não muda", () => {
  const ultimo = { dia: 5, data: "2026-10-21", ponteiro: null, pernasDevidas: true };
  assert.deepEqual(estadoDaSequencia(ultimo, "2026-10-21", 5), { ponteiro: null, pernasDevidas: true });
  assert.equal(determinarDiaDaSessao(ultimo, "2026-10-21", { diasVolei: VOLEI }), 5);
});
