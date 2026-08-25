// js/engine/cobertura.js
//
// Cobertura semanal de séries por músculo contra a faixa-alvo da fase ativa
// (protocolo.json > volumeSemanalPorFase). Cada músculo cai numa de quatro
// categorias — priorizado, recomposição, manutenção ou padrão — e a faixa
// muda de acordo. Sem essa distinção, "panturrilha com 4 séries" pareceria
// uma falha quando na verdade é manutenção deliberada.
function contarSeriesPorMusculo(seriesUltimos7Dias) {
  const contagem = {};
  for (const serie of seriesUltimos7Dias) {
    if (serie.tipoSerie === "aquecimento") continue;
    contagem[serie.musculo] = (contagem[serie.musculo] ?? 0) + 1;
  }
  return contagem;
}

function categoriaDoMusculo(musculo, definicaoFase) {
  if (definicaoFase?.musculoPriorizadoCrescimento?.includes(musculo)) return "priorizado";
  if (definicaoFase?.musculoEmRecomposicao?.includes(musculo)) return "recomposicao";
  if (definicaoFase?.musculoEmManutencao?.includes(musculo)) return "manutencao";
  return "padrao";
}

const CHAVE_FAIXA = {
  priorizado: "faixasPriorizado",
  recomposicao: "faixasRecomposicao",
  manutencao: "faixasManutencao",
  padrao: "faixasPadrao",
};

export function calcularCoberturaMuscular({ seriesUltimos7Dias, definicaoFase }) {
  const contagem = contarSeriesPorMusculo(seriesUltimos7Dias);
  const musculos = Object.keys(contagem).sort();

  return musculos.map((musculo) => {
    const categoria = categoriaDoMusculo(musculo, definicaoFase);
    const faixa = definicaoFase?.[CHAVE_FAIXA[categoria]] ?? null;
    const atual = contagem[musculo];
    const min = faixa?.alvo_min ?? null;
    const max = faixa?.alvo_max ?? null;
    const abaixoDoAlvo = min != null && atual < min;
    return { musculo, categoria, atual, min, max, abaixoDoAlvo };
  });
}
