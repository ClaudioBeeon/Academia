import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularFrequenciaSemanalPorMusculo, calcularContadorPorMusculo, prepararSessaoDoDia } from "./contextoSessao.js";

// Frequências da estrutura revisada pela auditoria de 2026-08-23: costas subiu
// de 1x para 2x e deltoide posterior passou a existir com 2x (antes tinha zero
// séries no programa), pra inverter a proporção empurrar:puxar. O
// desenvolvimento de ombro saiu, então "ombro" (lateral) caiu de 3x para 2x.
test("calcularFrequenciaSemanalPorMusculo reflete a sequência revisada: peito 3x, costas e deltoide posterior 2x", () => {
  const frequencia = calcularFrequenciaSemanalPorMusculo();
  assert.equal(frequencia.peito, 3);
  assert.equal(frequencia.triceps, 2);
  assert.equal(frequencia.costas, 2, "costas dobrou de frequência pela correção postural");
  assert.equal(frequencia.deltoide_posterior, 2, "músculo novo — era zero no programa antigo");
  assert.equal(frequencia.biceps, 2);
  assert.equal(frequencia.ombro, 2);
  assert.equal(frequencia.quadriceps, 1);
});

test("calcularContadorPorMusculo conta datas distintas por músculo, ignorando o dia de hoje", () => {
  const series = [
    { data: "2026-08-10", musculo: "peito" },
    { data: "2026-08-13", musculo: "peito" },
    { data: "2026-08-13", musculo: "ombro" },
    { data: "2026-08-17", musculo: "peito" }, // hoje — não conta
  ];
  const contador = calcularContadorPorMusculo(series, "2026-08-17");
  assert.equal(contador.peito, 2);
  assert.equal(contador.ombro, 1);
});

test("contador de peito é o mesmo independente de vir do dia 1, 3 ou 5 — compartilhado entre os 3 dias", () => {
  const series = [
    { data: "2026-08-10", musculo: "peito" }, // dia 1
    { data: "2026-08-12", musculo: "peito" }, // dia 3
    { data: "2026-08-14", musculo: "peito" }, // dia 5
  ];
  const contador = calcularContadorPorMusculo(series, "2026-08-17");
  assert.equal(contador.peito, 3);
});

function exercicio(id, musculo) {
  return { id, nome: id, musculoPrimario: musculo };
}

test("prepararSessaoDoDia aplica a faixa de manutenção do protocolo real e limita peito a 1 exercício/dia", () => {
  const protocolo = {
    volumeSemanalPorFase: {
      definicao: {
        musculoPriorizadoCrescimento: [],
        musculoEmManutencao: ["peito"],
        faixasPadrao: { alvo_max: 16 },
        faixasManutencao: { alvo_max: 9 },
      },
    },
  };
  const todosExercicios = [
    exercicio("inclinado", "peito"),
    exercicio("reto", "peito"),
    exercicio("crucifixo", "peito"),
    exercicio("pulley", "triceps"),
    exercicio("testa", "triceps"),
  ];
  const diaInfo = { numero: 1, titulo: "Peito + Tríceps", musculos: ["peito", "triceps"] };
  const { exerciciosHoje } = prepararSessaoDoDia({
    todosExercicios,
    protocolo,
    todasAsSeries: [],
    hoje: "2026-08-21",
    diaInfo,
  });
  const doPeito = exerciciosHoje.filter((e) => e.musculoPrimario === "peito");
  assert.equal(doPeito.length, 1);
});

test("prepararSessaoDoDia repassa musculosEmRecomposicao e faixasRecomposicao do protocolo real", () => {
  const protocolo = {
    volumeSemanalPorFase: {
      definicao: {
        musculoPriorizadoCrescimento: [],
        musculoEmManutencao: [],
        musculoEmRecomposicao: ["peito"],
        faixasPadrao: { alvo_max: 16 },
        faixasRecomposicao: { alvo_max: 15, seriesPorExercicio: 4 },
      },
    },
  };
  const todosExercicios = [
    exercicio("inclinado", "peito"),
    exercicio("reto", "peito"),
    exercicio("crucifixo", "peito"),
  ];
  const diaInfo = { numero: 1, titulo: "Peito", musculos: ["peito"] };
  const { exerciciosHoje } = prepararSessaoDoDia({
    todosExercicios,
    protocolo,
    todasAsSeries: [],
    hoje: "2026-08-21",
    diaInfo,
  });
  assert.equal(exerciciosHoje.length, 1);
  assert.equal(exerciciosHoje[0].seriesAlvo, 4);
});

test("prepararSessaoDoDia ordena o músculo prioritário do dia (primeiro da lista) antes do secundário", () => {
  const protocolo = {
    volumeSemanalPorFase: {
      definicao: {
        musculoPriorizadoCrescimento: [],
        musculoEmManutencao: [],
        faixasPadrao: { alvo_max: 16 },
      },
    },
  };
  const todosExercicios = [
    exercicio("costas1", "costas"),
    exercicio("costas2", "costas"),
    exercicio("biceps1", "biceps"),
    exercicio("biceps2", "biceps"),
  ];
  const diaInfo = { numero: 2, titulo: "Costas + Bíceps", musculos: ["costas", "biceps"] };
  const { exerciciosHoje } = prepararSessaoDoDia({
    todosExercicios,
    protocolo,
    todasAsSeries: [],
    hoje: "2026-08-21",
    diaInfo,
  });
  assert.deepEqual(exerciciosHoje.map((e) => e.musculoPrimario), ["costas", "costas", "biceps", "biceps"]);
});
