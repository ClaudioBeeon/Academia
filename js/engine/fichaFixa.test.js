import { test } from "node:test";
import assert from "node:assert/strict";
import {
  obterDiaDaFicha,
  montarSessaoDaFicha,
  aplicarSemanaDoMesociclo,
  calcularSemanaDoBloco,
  inicioParaDeloadAgora,
  descreverSemana,
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

test("semanas 1 a 3 não mudam o volume da ficha", () => {
  const base = [{ musculoPrimario: "peito", seriesAlvo: 5 }, { musculoPrimario: "costas", seriesAlvo: 3 }];
  for (const semana of [1, 2, 3]) {
    assert.deepEqual(aplicarSemanaDoMesociclo(base, semana).map((e) => e.seriesAlvo), [5, 3]);
  }
});

test("semana 1 é de entrada: RIR-alvo +1 e sem falha, sem mexer no resto da prescrição", () => {
  const base = [{ musculoPrimario: "peito", seriesAlvo: 5, prescricao: { rirAlvo: 1, falhaNaUltimaSerie: true, descansoSegundos: 120 } }];
  const [r] = aplicarSemanaDoMesociclo(base, 1);
  assert.equal(r.prescricao.rirAlvo, 2);
  assert.equal(r.prescricao.falhaNaUltimaSerie, false);
  assert.equal(r.prescricao.descansoSegundos, 120);
  assert.equal(base[0].prescricao.rirAlvo, 1, "não muta a prescrição original");
});

test("semanas 2 a 6 mantêm o RIR do exercício — um só RIR, sem rampa semanal", () => {
  const base = [{ musculoPrimario: "costas", seriesAlvo: 3, prescricao: { rirAlvo: 1 } }];
  for (const semana of [2, 3, 4, 5, 6]) {
    assert.equal(aplicarSemanaDoMesociclo(base, semana)[0].prescricao.rirAlvo, 1);
  }
});

test("semanas 4 a 6 sobem 1 série só nos músculos priorizados", () => {
  const base = [
    { musculoPrimario: "peito", seriesAlvo: 5 },
    { musculoPrimario: "biceps", seriesAlvo: 3 },
    { musculoPrimario: "costas", seriesAlvo: 3 },
  ];
  for (const semana of [4, 5, 6]) {
    const r = aplicarSemanaDoMesociclo(base, semana);
    assert.equal(r[0].seriesAlvo, 6, "peito sobe");
    assert.equal(r[1].seriesAlvo, 4, "bíceps sobe");
    assert.equal(r[2].seriesAlvo, 3, "costas não sobe");
  }
});

test("com fadiga detectada, a série extra das semanas 4 a 6 não entra", () => {
  const base = [{ musculoPrimario: "peito", seriesAlvo: 5 }];
  assert.equal(aplicarSemanaDoMesociclo(base, 5, { fadigaDetectada: true })[0].seriesAlvo, 5);
});

test("semana 7 (deload): metade das séries arredondando pra cima, RIR +2 com mínimo 3, sem falha", () => {
  const base = [
    { musculoPrimario: "peito", seriesAlvo: 5, prescricao: { rirAlvo: 2, falhaNaUltimaSerie: false } },
    { musculoPrimario: "costas", seriesAlvo: 3, prescricao: { rirAlvo: 0, falhaNaUltimaSerie: true } },
    { musculoPrimario: "panturrilha", seriesAlvo: 1 },
  ];
  const r = aplicarSemanaDoMesociclo(base, 7);
  assert.deepEqual(r.map((e) => e.seriesAlvo), [3, 2, 1]);
  assert.equal(r[0].prescricao.rirAlvo, 4);
  assert.equal(r[1].prescricao.rirAlvo, 3, "RIR 0 vira 3, nunca menos que 3 no deload");
  assert.equal(r[1].prescricao.falhaNaUltimaSerie, false);
});

test("aplicarSemanaDoMesociclo não muta o array recebido", () => {
  const base = [{ musculoPrimario: "peito", seriesAlvo: 5 }];
  aplicarSemanaDoMesociclo(base, 4);
  assert.equal(base[0].seriesAlvo, 5);
});

test("calcularSemanaDoBloco conta 7 dias por semana, começando na 1", () => {
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-09-01"), 1);
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-09-07"), 1);
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-09-08"), 2);
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-10-13"), 7, "7ª semana é o deload");
});

test("calcularSemanaDoBloco recomeça na semana 1 depois do deload — nunca fica preso", () => {
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-10-20"), 1, "dia 49 = semana 1 do bloco seguinte");
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-12-01"), 7, "dia 91 = semana 7 do 2º bloco");
  assert.equal(calcularSemanaDoBloco("2026-09-01", "2026-08-20"), 1, "data anterior ao início cai em 1");
});

test("calcularSemanaDoBloco assume semana 1 sem data de início — nunca adivinha volume maior", () => {
  assert.equal(calcularSemanaDoBloco(null, "2026-09-20"), 1);
  assert.equal(calcularSemanaDoBloco("lixo", "2026-09-20"), 1);
});

test("inicioParaDeloadAgora coloca hoje no primeiro dia da semana de deload", () => {
  const inicio = inicioParaDeloadAgora("2026-09-24");
  assert.equal(inicio, "2026-08-13");
  assert.equal(calcularSemanaDoBloco(inicio, "2026-09-24"), 7);
  assert.equal(calcularSemanaDoBloco(inicio, "2026-10-01"), 1, "uma semana depois o bloco recomeça");
});

test("descreverSemana nomeia a fase", () => {
  assert.equal(descreverSemana(1), "entrada");
  assert.equal(descreverSemana(2), "base");
  assert.equal(descreverSemana(5), "+1 série em peito e bíceps");
  assert.equal(descreverSemana(7), "deload");
});

test("ordemDeCorte lista só os cortáveis, do primeiro a sair ao último, e nunca peito ou bíceps", async () => {
  const { ordemDeCorte } = await import("./fichaFixa.js");
  const exercicios = [
    { id: "supino", musculoPrimario: "peito", prescricao: { corte: 1 } },
    { id: "face", musculoPrimario: "deltoide_posterior", prescricao: { corte: 2 } },
    { id: "punho", musculoPrimario: "antebraco", prescricao: { corte: 1, opcional: true } },
    { id: "rosca", musculoPrimario: "biceps", prescricao: {} },
  ];
  assert.deepEqual(ordemDeCorte(exercicios).map((e) => e.id), ["punho", "face"]);
});
