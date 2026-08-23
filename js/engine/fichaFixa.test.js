import { test } from "node:test";
import assert from "node:assert/strict";
import {
  obterDiaDaFicha,
  montarSessaoDaFicha,
  aplicarSemanaDoMesociclo,
  calcularSemanaDoBloco,
} from "./fichaFixa.js";

const CATALOGO = [
  { id: "supino", nome: "Supino", musculoPrimario: "peito", tipo: "composto_moderado" },
  { id: "rosca", nome: "Rosca", musculoPrimario: "biceps", tipo: "isolador" },
  { id: "face_pull", nome: "Face pull", musculoPrimario: "deltoide_posterior", tipo: "isolador" },
];

const FICHA = {
  dias: [
    {
      numero: 1,
      titulo: "Dia 1",
      exercicios: [
        { ordem: 2, exercicioId: "face_pull", series: 3, repeticoes: { min: 12, max: 20 }, rirAlvo: 1, descansoSegundos: 75 },
        { ordem: 1, exercicioId: "supino", series: 5, repeticoes: { min: 8, max: 12 }, rirAlvo: 2, descansoSegundos: 120 },
      ],
    },
    {
      numero: 2,
      titulo: "Dia 2",
      exercicios: [
        { ordem: 1, exercicioId: "rosca", series: 3, repeticoes: { min: 8, max: 12 }, rirAlvo: 1, descansoSegundos: 90 },
      ],
    },
  ],
};

test("obterDiaDaFicha acha o dia pelo número e devolve null pro que não existe", () => {
  assert.equal(obterDiaDaFicha(FICHA, 1).titulo, "Dia 1");
  assert.equal(obterDiaDaFicha(FICHA, 9), null);
  assert.equal(obterDiaDaFicha(null, 1), null);
});

test("montarSessaoDaFicha respeita o campo ordem, não a ordem do array", () => {
  const { exercicios } = montarSessaoDaFicha({ ficha: FICHA, numeroDoDia: 1, todosExercicios: CATALOGO });
  assert.deepEqual(exercicios.map((e) => e.id), ["supino", "face_pull"]);
});

test("montarSessaoDaFicha anexa seriesAlvo e prescricao a cada exercício", () => {
  const { exercicios } = montarSessaoDaFicha({ ficha: FICHA, numeroDoDia: 1, todosExercicios: CATALOGO });
  const supino = exercicios[0];
  assert.equal(supino.seriesAlvo, 5);
  assert.equal(supino.nome, "Supino");
  assert.equal(supino.prescricao.rirAlvo, 2);
  assert.equal(supino.prescricao.descansoSegundos, 120);
});

test("montarSessaoDaFicha ignora exercicioId que não existe no catálogo", () => {
  const fichaComIdInvalido = {
    dias: [{ numero: 1, exercicios: [
      { ordem: 1, exercicioId: "supino", series: 3 },
      { ordem: 2, exercicioId: "nao_existe", series: 3 },
    ] }],
  };
  const { exercicios } = montarSessaoDaFicha({ ficha: fichaComIdInvalido, numeroDoDia: 1, todosExercicios: CATALOGO });
  assert.deepEqual(exercicios.map((e) => e.id), ["supino"]);
});

test("montarSessaoDaFicha devolve null quando o dia não está na ficha", () => {
  assert.equal(montarSessaoDaFicha({ ficha: FICHA, numeroDoDia: 4, todosExercicios: CATALOGO }), null);
});

test("semanas 1 e 2 não mudam o volume da ficha", () => {
  const base = [{ musculoPrimario: "peito", seriesAlvo: 5 }, { musculoPrimario: "costas", seriesAlvo: 3 }];
  assert.deepEqual(aplicarSemanaDoMesociclo(base, 1), base);
  assert.deepEqual(aplicarSemanaDoMesociclo(base, 2), base);
});

test("semanas 3 e 4 sobem 1 série só nos músculos priorizados", () => {
  const base = [
    { musculoPrimario: "peito", seriesAlvo: 5 },
    { musculoPrimario: "biceps", seriesAlvo: 3 },
    { musculoPrimario: "costas", seriesAlvo: 3 },
  ];
  for (const semana of [3, 4]) {
    const r = aplicarSemanaDoMesociclo(base, semana);
    assert.equal(r[0].seriesAlvo, 6, "peito sobe");
    assert.equal(r[1].seriesAlvo, 4, "bíceps sobe");
    assert.equal(r[2].seriesAlvo, 3, "costas não sobe");
  }
});

test("semana 5 corta o volume pela metade, com piso de 1 série", () => {
  const base = [
    { musculoPrimario: "peito", seriesAlvo: 5 },
    { musculoPrimario: "costas", seriesAlvo: 3 },
    { musculoPrimario: "panturrilha", seriesAlvo: 1 },
  ];
  const r = aplicarSemanaDoMesociclo(base, 5);
  assert.equal(r[0].seriesAlvo, 2);
  assert.equal(r[1].seriesAlvo, 1);
  assert.equal(r[2].seriesAlvo, 1, "nunca zera um exercício");
});

test("aplicarSemanaDoMesociclo não muta o array recebido", () => {
  const base = [{ musculoPrimario: "peito", seriesAlvo: 5 }];
  aplicarSemanaDoMesociclo(base, 3);
  assert.equal(base[0].seriesAlvo, 5);
});

test("calcularSemanaDoBloco conta 7 dias por semana, começando na 1", () => {
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-09-01"), 1);
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-09-07"), 1);
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-09-08"), 2);
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-09-29"), 5);
});

test("calcularSemanaDoBloco satura em 5 e nunca volta pra trás", () => {
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-12-01"), 5, "não passa de 5");
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-08-20"), 1, "data anterior ao início cai em 1");
});

test("calcularSemanaDoBloco assume semana 1 sem data de início — nunca adivinha volume maior", () => {
  assert.equal(calcularSemanaDoBloco(null, "2026-09-20"), 1);
  assert.equal(calcularSemanaDoBloco("lixo", "2026-09-20"), 1);
});
