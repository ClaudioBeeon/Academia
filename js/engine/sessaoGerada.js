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
// - Exercícios/dia por músculo derivam do protocolo (correcao-volume-peito):
//   round(alvo_series_semanais_da_faixa / frequência_semanal_do_músculo /
//   séries_por_exercício), sempre limitado ao teto de
//   protocolo.json.limiteSeriesDiretas.porMusculoPorSessao.max=8 (2
//   exercícios de 3 séries). Isso faz o volume semanal seguir a fase ativa
//   do protocolo automaticamente — sem contagem fixa no código — e evita
//   que a fórmula "exploda" em músculos de baixa frequência (1x-2x/semana),
//   onde ela tentaria empurrar a semana inteira pra uma sessão só. Quando
//   frequência/faixas não são informadas, cai no teto de 2 (comportamento
//   legado).
// - Prioridade: musculosPriorizados > recomposicao/padrão > musculosEmManutencao,
//   lida de protocolo.json.volumeSemanalPorFase.definicao. Só decide QUEM
//   ganha o 2º exercício quando o alvo de 7 já cobriu 1 de cada músculo —
//   nunca exclui um músculo em manutenção da sessão.
// - musculosEmRecomposicao é uma 4ª faixa (entre priorizado e padrão) pra
//   músculos com prioridade real de crescimento mas volume ainda contido
//   pelo déficit calórico da fase (ex.: peito na fase "definicao" —
//   referencia-consolidada-app-treino.md seção 4). A faixa correspondente
//   (faixasRecomposicao) pode declarar seriesPorExercicio próprio — cada
//   exercício selecionado sai com esse valor em `seriesAlvo`, consumido
//   pela UI de execução em vez do fixo de 3 séries.
// - Rotação: o offset de cada músculo vem de contadorPorMusculo[musculo]
//   (quantas sessões anteriores já treinaram aquele músculo especificamente)
//   quando informado, com sessoesAnterioresDoGrupo como fallback legado. Um
//   contador por músculo — em vez de um contador único por dia — garante que
//   músculos que aparecem em mais de um dia (ex.: peito nos dias 1, 3 e 5)
//   girem pelo catálogo inteiro ao longo da semana, não por coincidência de
//   offset de cada dia isoladamente (correcao-volume-peito, item 2).
// - Ordenação final: quando ordemMusculosDoDia é informado, os exercícios
//   selecionados são reagrupados por músculo na ordem informada — todos os
//   exercícios do músculo prioritário do dia antes dos secundários — porque
//   ordem afeta ganho de força (não hipertrofia) e o exercício feito
//   primeiro, com o corpo mais descansado, é quem se beneficia
//   (regra-ordenacao-exercicios). Isso não muda quais exercícios são
//   selecionados, só a ordem de exibição/execução.

const ALVO_MAXIMO = 7;
const MAX_SERIES_DIRETAS_POR_MUSCULO = 8;
const SERIES_POR_EXERCICIO = 3;
const MAX_EXERCICIOS_POR_MUSCULO = Math.floor(MAX_SERIES_DIRETAS_POR_MUSCULO / SERIES_POR_EXERCICIO);

// Ordem de prioridade das rodadas (quem ganha a 2ª vaga primeiro quando o
// alvo de 7 exercícios/sessão sobra espaço) — não é a mesma coisa que a
// faixa de volume do músculo, só quem preenche primeiro.
function determinarTier(musculo, { musculosPriorizados, musculosEmRecomposicao, musculosEmManutencao }) {
  if (musculosPriorizados.includes(musculo)) return "priorizado";
  if (musculosEmRecomposicao.includes(musculo)) return "recomposicao";
  if (musculosEmManutencao.includes(musculo)) return "manutencao";
  return "padrao";
}

const ORDEM_POR_TIER = { priorizado: 0, recomposicao: 1, padrao: 1, manutencao: 2 };

// Cada faixa de volume pode declarar seriesPorExercicio (ex.: peito em
// recomposição usa 4-5 em vez do padrão de 3 — referencia-consolidada-app-
// treino.md seção 4) pra caber o volume-alvo em 1 exercício/dia sem
// precisar de um 2º exercício que estouraria a faixa.
function calcularExerciciosAlvo(musculo, tier, { frequenciaSemanalPorMusculo, faixasVolume }) {
  const frequencia = frequenciaSemanalPorMusculo[musculo];
  const faixa = faixasVolume?.[tier] ?? faixasVolume?.padrao;
  const seriesPorExercicio = faixa?.seriesPorExercicio ?? SERIES_POR_EXERCICIO;

  if (!frequencia || !faixasVolume || !faixa || faixa.alvo_max == null) {
    return { qtdExercicios: MAX_EXERCICIOS_POR_MUSCULO, seriesPorExercicio: SERIES_POR_EXERCICIO };
  }

  const bruto = Math.round(faixa.alvo_max / frequencia / seriesPorExercicio);
  const qtdExercicios = Math.min(Math.max(bruto, 1), MAX_EXERCICIOS_POR_MUSCULO);
  return { qtdExercicios, seriesPorExercicio };
}

export function gerarSessaoDoDia({
  exerciciosDoGrupo,
  musculosPriorizados = [],
  musculosEmManutencao = [],
  musculosEmRecomposicao = [],
  sessoesAnterioresDoGrupo = 0,
  contadorPorMusculo = {},
  frequenciaSemanalPorMusculo = {},
  faixasVolume = null,
  ordemMusculosDoDia = null,
}) {
  const porMusculo = new Map();
  for (const exercicio of exerciciosDoGrupo) {
    if (!porMusculo.has(exercicio.musculoPrimario)) porMusculo.set(exercicio.musculoPrimario, []);
    porMusculo.get(exercicio.musculoPrimario).push(exercicio);
  }

  const tierPorMusculo = new Map(
    [...porMusculo.keys()].map((musculo) => [musculo, determinarTier(musculo, { musculosPriorizados, musculosEmRecomposicao, musculosEmManutencao })])
  );

  const musculosOrdenados = [...porMusculo.keys()].sort(
    (a, b) => ORDEM_POR_TIER[tierPorMusculo.get(a)] - ORDEM_POR_TIER[tierPorMusculo.get(b)]
  );

  const alvoPorMusculo = new Map(
    musculosOrdenados.map((musculo) => [
      musculo,
      calcularExerciciosAlvo(musculo, tierPorMusculo.get(musculo), { frequenciaSemanalPorMusculo, faixasVolume }),
    ])
  );

  const filas = musculosOrdenados.map((musculo) => {
    const lista = porMusculo.get(musculo);
    const offset = (contadorPorMusculo[musculo] ?? sessoesAnterioresDoGrupo) % lista.length;
    return [...lista.slice(offset), ...lista.slice(0, offset)];
  });

  const selecionados = [];
  for (let rodada = 0; rodada < MAX_EXERCICIOS_POR_MUSCULO && selecionados.length < ALVO_MAXIMO; rodada++) {
    musculosOrdenados.forEach((musculo, indiceMusculo) => {
      if (selecionados.length >= ALVO_MAXIMO) return;
      const alvo = alvoPorMusculo.get(musculo);
      if (rodada >= alvo.qtdExercicios) return;
      const proximo = filas[indiceMusculo][rodada];
      if (proximo) selecionados.push({ ...proximo, seriesAlvo: alvo.seriesPorExercicio });
    });
  }

  if (ordemMusculosDoDia) {
    const indiceOrdem = new Map(ordemMusculosDoDia.map((musculo, i) => [musculo, i]));
    selecionados.sort((a, b) => {
      const ia = indiceOrdem.get(a.musculoPrimario) ?? Number.MAX_SAFE_INTEGER;
      const ib = indiceOrdem.get(b.musculoPrimario) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  }

  return selecionados;
}
