// js/engine/progressao.js
function abaixoDoMinimo(sessao, faixaMin) {
  return sessao != null && sessao.some((serie) => serie.reps < faixaMin);
}

export function avaliarProgressao({ faixaMin, faixaMax, rirAlvo, sessaoAtual, sessaoAnterior }) {
  const todasNoTopoComRir = sessaoAtual.every(
    (serie) => serie.reps >= faixaMax && serie.rir >= rirAlvo
  );

  if (todasNoTopoComRir) {
    return {
      acao: "aumentar_carga",
      motivo: `Todas as séries atingiram ${faixaMax} reps com RIR >= ${rirAlvo}.`,
      principio: "P10",
      secao: "22.3",
    };
  }

  if (abaixoDoMinimo(sessaoAtual, faixaMin) && abaixoDoMinimo(sessaoAnterior, faixaMin)) {
    return {
      acao: "reduzir_carga",
      motivo: `Ficou abaixo de ${faixaMin} reps em 2 sessões consecutivas.`,
      principio: "P10",
      secao: "22.3",
    };
  }

  return {
    acao: "manter",
    motivo: "Ainda dentro da faixa; tentar +1 repetição na próxima sessão.",
    principio: "P10",
    secao: "22.3",
  };
}
