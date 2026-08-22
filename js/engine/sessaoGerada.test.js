import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarSessaoDoDia } from "./sessaoGerada.js";

function ex(id, musculo) {
  return { id, nome: id, musculoPrimario: musculo };
}

test("sem exercícios no grupo retorna sessão vazia", () => {
  assert.deepEqual(gerarSessaoDoDia({ exerciciosDoGrupo: [] }), []);
});

test("respeita o alvo máximo de 7 exercícios mesmo com catálogo maior", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"), ex("peito3", "peito"),
    ex("costas1", "costas"), ex("costas2", "costas"), ex("costas3", "costas"),
    ex("ombro1", "ombro"), ex("ombro2", "ombro"),
    ex("biceps1", "biceps"), ex("biceps2", "biceps"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
    ex("abdomen1", "abdomen"), ex("abdomen2", "abdomen"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  assert.equal(sessao.length, 7);
});

test("todos os músculos do grupo aparecem pelo menos uma vez antes de qualquer músculo repetir (round-robin)", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"),
    ex("costas1", "costas"), ex("costas2", "costas"),
    ex("ombro1", "ombro"), ex("ombro2", "ombro"),
    ex("biceps1", "biceps"), ex("biceps2", "biceps"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
    ex("abdomen1", "abdomen"), ex("abdomen2", "abdomen"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  const musculosPrimeiraRodada = new Set(sessao.slice(0, 6).map((e) => e.musculoPrimario));
  assert.equal(musculosPrimeiraRodada.size, 6);
});

test("nunca seleciona mais que 2 exercícios do mesmo músculo (respeita o limite de 8 séries diretas/sessão)", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"), ex("peito3", "peito"),
    ex("costas1", "costas"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  const doPeito = sessao.filter((e) => e.musculoPrimario === "peito");
  assert.ok(doPeito.length <= 2);
});

test("músculo em manutenção ainda aparece na sessão, mesmo com menor prioridade", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"),
    ex("costas1", "costas"), ex("costas2", "costas"),
    ex("ombro1", "ombro"), ex("ombro2", "ombro"),
    ex("biceps1", "biceps"), ex("biceps2", "biceps"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
    ex("abdomen1", "abdomen"), ex("abdomen2", "abdomen"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, musculosEmManutencao: ["peito"] });
  assert.ok(sessao.some((e) => e.musculoPrimario === "peito"));
});

test("músculo priorizado ganha o segundo exercício antes de um músculo comum", () => {
  // 6 músculos (como o grupo Superior real) deixam 1 vaga sobrando na
  // rodada 2 depois da rodada 1 cobrir todos — essa vaga deve ir pro
  // músculo priorizado, não pro primeiro da lista por acaso.
  const exercicios = [
    ex("a1", "a"), ex("a2", "a"),
    ex("b1", "b"), ex("b2", "b"),
    ex("c1", "c"), ex("c2", "c"),
    ex("d1", "d"), ex("d2", "d"),
    ex("e1", "e"), ex("e2", "e"),
    ex("f1", "f"), ex("f2", "f"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, musculosPriorizados: ["f"] });
  assert.equal(sessao[6].musculoPrimario, "f");
});

test("com menos exercícios que o alvo, retorna o catálogo inteiro sem duplicar", () => {
  const exercicios = [ex("q1", "quadriceps"), ex("p1", "posterior_coxa"), ex("g1", "gluteo")];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  assert.equal(sessao.length, 3);
});

test("rotação desloca o exercício inicial de cada músculo conforme sessões anteriores do grupo", () => {
  const exercicios = [ex("peito1", "peito"), ex("peito2", "peito"), ex("peito3", "peito")];
  const semRotacao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, sessoesAnterioresDoGrupo: 0 });
  const comRotacao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, sessoesAnterioresDoGrupo: 1 });
  assert.equal(semRotacao[0].id, "peito1");
  assert.equal(comRotacao[0].id, "peito2");
});

// --- correção de volume: exercícios/dia derivados do protocolo (correcao-volume-peito.md) ---

const FAIXAS_FASE_DEFINICAO = {
  padrao: { alvo_max: 16 },
  manutencao: { alvo_max: 9 },
};

const FAIXAS_FASE_HIPERTROFIA_PEITO = {
  padrao: { alvo_max: 16 },
  priorizado: { alvo_max: 20 },
};

test("peito em manutenção (3x/semana, alvo 9) recebe 1 exercício/dia — 9 séries/semana, não 18", () => {
  const exercicios = [ex("inclinado", "peito"), ex("reto", "peito"), ex("crucifixo", "peito")];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    musculosEmManutencao: ["peito"],
    frequenciaSemanalPorMusculo: { peito: 3 },
    faixasVolume: FAIXAS_FASE_DEFINICAO,
  });
  assert.equal(sessao.length, 1);
});

test("tríceps padrão (2x/semana, alvo 16) satura a fórmula (3) mas é limitado ao teto de 2 exercícios/sessão", () => {
  const exercicios = [ex("t1", "triceps"), ex("t2", "triceps"), ex("t3", "triceps")];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    frequenciaSemanalPorMusculo: { triceps: 2 },
    faixasVolume: FAIXAS_FASE_DEFINICAO,
  });
  assert.equal(sessao.length, 2);
});

test("músculo de perna 1x/semana (alvo 16) não estoura a sessão — limitado ao teto de 2", () => {
  const exercicios = [ex("q1", "quadriceps"), ex("q2", "quadriceps"), ex("q3", "quadriceps")];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    frequenciaSemanalPorMusculo: { quadriceps: 1 },
    faixasVolume: FAIXAS_FASE_DEFINICAO,
  });
  assert.equal(sessao.length, 2);
});

test("quando peito vira priorizado (fase hipertrofia_peito, alvo 20), a mesma fórmula libera 2 exercícios/dia sem mudar código", () => {
  const exercicios = [ex("inclinado", "peito"), ex("reto", "peito"), ex("crucifixo", "peito")];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    musculosPriorizados: ["peito"],
    frequenciaSemanalPorMusculo: { peito: 3 },
    faixasVolume: FAIXAS_FASE_HIPERTROFIA_PEITO,
  });
  assert.equal(sessao.length, 2);
});

test("sem frequência/faixas informadas, mantém o teto legado de 2 exercícios/músculo", () => {
  const exercicios = [ex("p1", "peito"), ex("p2", "peito"), ex("p3", "peito")];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  assert.equal(sessao.length, 2);
});

test("sem seriesAlvo declarado, exercícios saem com o padrão de 3 séries", () => {
  const exercicios = [ex("p1", "peito")];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    frequenciaSemanalPorMusculo: { peito: 3 },
    faixasVolume: FAIXAS_FASE_DEFINICAO,
  });
  assert.equal(sessao[0].seriesAlvo, 3);
});

// --- músculo em recomposição: faixa própria (entre priorizado e padrão) com seriesPorExercicio dedicado ---

const FAIXAS_FASE_DEFINICAO_COM_RECOMPOSICAO = {
  ...FAIXAS_FASE_DEFINICAO,
  recomposicao: { alvo_max: 15, seriesPorExercicio: 4 },
};

test("peito em recomposição (3x/semana, alvo 15, 4 séries/exercício) recebe 1 exercício/dia com seriesAlvo=4 — 12 séries/semana", () => {
  const exercicios = [ex("inclinado", "peito"), ex("reto", "peito"), ex("crucifixo", "peito")];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    musculosEmRecomposicao: ["peito"],
    frequenciaSemanalPorMusculo: { peito: 3 },
    faixasVolume: FAIXAS_FASE_DEFINICAO_COM_RECOMPOSICAO,
  });
  assert.equal(sessao.length, 1);
  assert.equal(sessao[0].seriesAlvo, 4);
});

test("músculo priorizado sem faixasPriorizado definida cai no padrão (fallback seguro)", () => {
  const exercicios = [ex("b1", "biceps"), ex("b2", "biceps"), ex("b3", "biceps")];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    musculosPriorizados: ["biceps"],
    frequenciaSemanalPorMusculo: { biceps: 2 },
    faixasVolume: FAIXAS_FASE_DEFINICAO,
  });
  assert.equal(sessao.length, 2);
  assert.equal(sessao[0].seriesAlvo, 3);
});

// --- contador de rotação por músculo, compartilhado entre dias (correcao-volume-peito.md, item 2) ---

test("contadorPorMusculo tem prioridade sobre sessoesAnterioresDoGrupo e é específico por músculo", () => {
  const exercicios = [
    ex("inclinado", "peito"), ex("reto", "peito"), ex("crucifixo", "peito"),
    ex("t1", "triceps"), ex("t2", "triceps"),
  ];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    sessoesAnterioresDoGrupo: 5, // seria usado como fallback se contadorPorMusculo não cobrisse o músculo
    contadorPorMusculo: { peito: 1 },
  });
  const peito = sessao.filter((e) => e.musculoPrimario === "peito");
  const triceps = sessao.filter((e) => e.musculoPrimario === "triceps");
  assert.equal(peito[0].id, "reto"); // offset 1 no catálogo de peito
  assert.equal(triceps[0].id, "t2"); // sem entrada em contadorPorMusculo, cai no fallback (offset 5 % 2 = 1)
});

test("contador único de peito percorre os 3 ângulos ao longo de 3 sessões consecutivas (dias 1, 3, 5)", () => {
  const exercicios = [ex("inclinado", "peito"), ex("reto", "peito"), ex("crucifixo", "peito")];
  const idsVistos = [0, 1, 2].map((contador) => {
    const sessao = gerarSessaoDoDia({
      exerciciosDoGrupo: exercicios,
      musculosEmManutencao: ["peito"],
      frequenciaSemanalPorMusculo: { peito: 3 },
      faixasVolume: FAIXAS_FASE_DEFINICAO,
      contadorPorMusculo: { peito: contador },
    });
    return sessao[0].id;
  });
  assert.deepEqual(idsVistos, ["inclinado", "reto", "crucifixo"]);
});

// --- ordenação: prioritário do dia antes do secundário (regra-ordenacao-exercicios.md) ---

test("com ordemMusculosDoDia, todos os exercícios do músculo prioritário vêm antes do secundário, mesmo com round-robin intercalando a seleção", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
  ];
  const sessao = gerarSessaoDoDia({
    exerciciosDoGrupo: exercicios,
    ordemMusculosDoDia: ["peito", "triceps"],
  });
  assert.deepEqual(sessao.map((e) => e.musculoPrimario), ["peito", "peito", "triceps", "triceps"]);
});

test("sem ordemMusculosDoDia, mantém a ordem de seleção round-robin (comportamento legado)", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  assert.deepEqual(sessao.map((e) => e.musculoPrimario), ["peito", "triceps", "peito", "triceps"]);
});
