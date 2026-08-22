// js/engine/contextoSessao.js
//
// Monta o contexto que gerarSessaoDoDia precisa (grupo de exercícios do dia,
// frequência semanal por músculo, faixas de volume da fase ativa do
// protocolo e contador de rotação por músculo) — extraído pra um só lugar
// porque js/screens/treino.js e js/screens/sessao.js montam exatamente o
// mesmo contexto e duplicavam essa lógica antes da correção de volume e
// cobertura de ângulos (correcao-volume-peito.md).
//
// O contador de rotação é por músculo (não por dia): conta, pra cada
// músculo, em quantas datas passadas ele teve série registrada — então um
// músculo que aparece em mais de um dia da semana (peito nos dias 1, 3 e 5)
// gira pelo catálogo inteiro ao longo da semana, em vez de cada dia ter seu
// próprio offset por coincidência (item 2 da correção).

import { DIAS_SEQUENCIA } from "./sequenciaSemanal.js";
import { gerarSessaoDoDia } from "./sessaoGerada.js";

const TODOS_MUSCULOS_MAPEADOS = new Set(DIAS_SEQUENCIA.flatMap((d) => d.musculos));

export function calcularFrequenciaSemanalPorMusculo() {
  const frequencia = {};
  for (const dia of DIAS_SEQUENCIA) {
    for (const musculo of dia.musculos) {
      frequencia[musculo] = (frequencia[musculo] ?? 0) + 1;
    }
  }
  return frequencia;
}

function montarFaixasVolume(definicaoFase) {
  if (!definicaoFase) return null;
  return {
    padrao: definicaoFase.faixasPadrao ?? null,
    manutencao: definicaoFase.faixasManutencao ?? null,
    priorizado: definicaoFase.faixasPriorizado ?? null,
    recomposicao: definicaoFase.faixasRecomposicao ?? null,
  };
}

export function calcularContadorPorMusculo(todasAsSeries, hoje) {
  const datasPorMusculo = new Map();
  for (const serie of todasAsSeries) {
    if (serie.data === hoje) continue;
    if (!datasPorMusculo.has(serie.musculo)) datasPorMusculo.set(serie.musculo, new Set());
    datasPorMusculo.get(serie.musculo).add(serie.data);
  }
  const contador = {};
  for (const [musculo, datas] of datasPorMusculo) {
    contador[musculo] = datas.size;
  }
  return contador;
}

export function prepararSessaoDoDia({ todosExercicios, protocolo, todasAsSeries, hoje, diaInfo }) {
  const exerciciosDoGrupo = todosExercicios.filter((e) => {
    return diaInfo.musculos.includes(e.musculoPrimario) || !TODOS_MUSCULOS_MAPEADOS.has(e.musculoPrimario);
  });
  const definicaoFase = protocolo?.volumeSemanalPorFase?.definicao;
  const exerciciosHoje = gerarSessaoDoDia({
    exerciciosDoGrupo,
    musculosPriorizados: definicaoFase?.musculoPriorizadoCrescimento ?? [],
    musculosEmManutencao: definicaoFase?.musculoEmManutencao ?? [],
    musculosEmRecomposicao: definicaoFase?.musculoEmRecomposicao ?? [],
    frequenciaSemanalPorMusculo: calcularFrequenciaSemanalPorMusculo(),
    faixasVolume: montarFaixasVolume(definicaoFase),
    contadorPorMusculo: calcularContadorPorMusculo(todasAsSeries, hoje),
    ordemMusculosDoDia: diaInfo.musculos,
  });
  return { exerciciosDoGrupo, exerciciosHoje };
}
