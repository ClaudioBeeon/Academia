// js/engine/sessaoGerada.js
//
// Gera a sessão de treino do dia a partir do catálogo do grupo, em vez de
// despejar todos os exercícios cadastrados (bug corrigido nesta fatia — a
// tela chegou a mostrar 16 exercícios/48 séries numa sessão só).
//
// Rulings (protocolo.json não define a mecânica exata de seleção de sessão):
// - Alvo de 6-7 exercícios/sessão: base-cientifica-hipertrofia-forca.md P3
//   (seção 13) — qualidade cai claramente acima de ~5-8 séries diretas por
//   músculo por sessão — e seção 2 — frequência maior não custa hipertrofia
//   com volume semanal igualado, então distribuir em mais dias é de graça.
// - Round-robin por músculo (um exercício de cada músculo por rodada) em vez
//   de esgotar um músculo antes de ir pro próximo: garante que todo músculo
//   do grupo apareça na sessão, mesmo os em manutenção.
// - Máximo 2 exercícios por músculo (3 séries cada = 6 séries diretas),
//   derivado de protocolo.json.limiteSeriesDiretas.porMusculoPorSessao.max=8.
// - Prioridade: musculosPriorizados > padrão > musculosEmManutencao, lida de
//   protocolo.json.volumeSemanalPorFase.definicao. Só decide QUEM ganha o
//   2º exercício quando o alvo de 7 já cobriu 1 de cada músculo — nunca
//   exclui um músculo em manutenção da sessão.
// - Rotação: sessoesAnterioresDoGrupo desloca o ponto de partida da lista de
//   cada músculo, pra sessões consecutivas não repetirem sempre os 2
//   primeiros exercícios do catálogo.

const ALVO_MAXIMO = 7;
const MAX_SERIES_DIRETAS_POR_MUSCULO = 8;
const SERIES_POR_EXERCICIO = 3;
const MAX_EXERCICIOS_POR_MUSCULO = Math.floor(MAX_SERIES_DIRETAS_POR_MUSCULO / SERIES_POR_EXERCICIO);

function ordemPrioridade(musculo, musculosPriorizados, musculosEmManutencao) {
  if (musculosPriorizados.includes(musculo)) return 0;
  if (musculosEmManutencao.includes(musculo)) return 2;
  return 1;
}

export function gerarSessaoDoDia({
  exerciciosDoGrupo,
  musculosPriorizados = [],
  musculosEmManutencao = [],
  sessoesAnterioresDoGrupo = 0,
}) {
  const porMusculo = new Map();
  for (const exercicio of exerciciosDoGrupo) {
    if (!porMusculo.has(exercicio.musculoPrimario)) porMusculo.set(exercicio.musculoPrimario, []);
    porMusculo.get(exercicio.musculoPrimario).push(exercicio);
  }

  const musculosOrdenados = [...porMusculo.keys()].sort(
    (a, b) => ordemPrioridade(a, musculosPriorizados, musculosEmManutencao)
      - ordemPrioridade(b, musculosPriorizados, musculosEmManutencao)
  );

  const filas = musculosOrdenados.map((musculo) => {
    const lista = porMusculo.get(musculo);
    const offset = sessoesAnterioresDoGrupo % lista.length;
    return [...lista.slice(offset), ...lista.slice(0, offset)];
  });

  const selecionados = [];
  for (let rodada = 0; rodada < MAX_EXERCICIOS_POR_MUSCULO && selecionados.length < ALVO_MAXIMO; rodada++) {
    for (const fila of filas) {
      if (selecionados.length >= ALVO_MAXIMO) break;
      if (fila[rodada]) selecionados.push(fila[rodada]);
    }
  }

  return selecionados;
}
