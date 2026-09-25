// js/engine/cobertura.js
//
// Cobertura semanal de séries por músculo contra a faixa-alvo da fase ativa
// (protocolo.json > volumeSemanalPorFase). Cada músculo cai numa de quatro
// categorias — priorizado, recomposição, manutenção ou padrão — e a faixa
// muda de acordo. Sem essa distinção, "panturrilha com 4 séries" pareceria
// uma falha quando na verdade é manutenção deliberada.
//
// As faixas do protocolo são em séries FRACIONADAS (indireta = 0,5). Antes a
// cobertura contava só séries diretas contra essas faixas, e bíceps,
// deltoide posterior e tríceps apareciam "abaixo do alvo" por construção.
// Quem chama passa as séries já expandidas (js/engine/volume.js >
// expandirContribuicoes); série sem `contribuicao` vale 1.
function contarSeriesPorMusculo(seriesUltimos7Dias) {
  const contagem = {};
  const diretas = {};
  for (const serie of seriesUltimos7Dias) {
    if (serie.tipoSerie === "aquecimento") continue;
    contagem[serie.musculo] = (contagem[serie.musculo] ?? 0) + (serie.contribuicao ?? 1);
    if (serie.direta !== false) diretas[serie.musculo] = (diretas[serie.musculo] ?? 0) + 1;
  }
  return { contagem, diretas };
}

function categoriaDoMusculo(musculo, definicaoFase) {
  if (definicaoFase?.musculoPriorizadoCrescimento?.includes(musculo)) return "priorizado";
  if (definicaoFase?.musculoEmRecomposicao?.includes(musculo)) return "recomposicao";
  if (definicaoFase?.musculoSecundario?.includes(musculo)) return "secundario";
  if (definicaoFase?.musculoEmManutencao?.includes(musculo)) return "manutencao";
  return "padrao";
}

const CHAVE_FAIXA = {
  priorizado: "faixasPriorizado",
  recomposicao: "faixasRecomposicao",
  manutencao: "faixasManutencao",
  secundario: "faixasSecundario",
  padrao: "faixasPadrao",
};

export function calcularCoberturaMuscular({ seriesUltimos7Dias, definicaoFase }) {
  const { contagem, diretas } = contarSeriesPorMusculo(seriesUltimos7Dias);
  const musculos = Object.keys(contagem).sort();

  return musculos.map((musculo) => {
    const categoria = categoriaDoMusculo(musculo, definicaoFase);
    const faixa = definicaoFase?.[CHAVE_FAIXA[categoria]] ?? null;
    const atual = Math.round(contagem[musculo] * 10) / 10;
    const min = faixa?.alvo_min ?? null;
    const max = faixa?.alvo_max ?? null;
    const abaixoDoAlvo = min != null && atual < min;
    return { musculo, categoria, atual, diretas: diretas[musculo] ?? 0, min, max, abaixoDoAlvo };
  });
}
