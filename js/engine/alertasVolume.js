// js/engine/alertasVolume.js
const MIN_SERIES_SEMANAIS = 4;
const MAX_SERIES_SEMANAIS = 22;
const MAX_SERIES_POR_SESSAO = 8;
const DIAS_PARA_ALERTA_PROGRESSAO = 28;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function contarPorMusculo(series) {
  const contagem = {};
  for (const serie of series) {
    if (serie.tipoSerie === "aquecimento") continue;
    contagem[serie.musculo] = (contagem[serie.musculo] ?? 0) + 1;
  }
  return contagem;
}

export function avaliarAlertasVolume({
  seriesUltimos7Dias,
  seriesHoje,
  sessoesPorExercicio,
  musculosComDesempenhoCaindo,
  hoje,
}) {
  const alertas = [];

  // Só avalia músculos que aparecem em pelo menos 1 série direta na janela — sem um
  // catálogo de "músculos que deveriam ter sido treinados", não dá pra sinalizar um
  // músculo com 0 séries diretas (não tem como distinguir "esquecido" de "fora do
  // programa desta semana").
  const porMusculoSemana = contarPorMusculo(seriesUltimos7Dias);
  for (const [musculo, total] of Object.entries(porMusculoSemana)) {
    if (total < MIN_SERIES_SEMANAIS) {
      alertas.push({
        tipo: "volume_abaixo_minimo",
        musculo,
        mensagem: `Volume de ${musculo} ficou abaixo do mínimo efetivo (menos de ${MIN_SERIES_SEMANAIS} séries diretas na semana).`,
        principio: "alertas",
      });
    }
    if (total > MAX_SERIES_SEMANAIS && musculosComDesempenhoCaindo.has(musculo)) {
      alertas.push({
        tipo: "volume_excessivo_com_queda",
        musculo,
        mensagem: `Volume de ${musculo} está acima de ${MAX_SERIES_SEMANAIS} séries na semana, com desempenho em queda. Considere reduzir volume ou avaliar um deload.`,
        principio: "alertas",
      });
    }
  }

  const porMusculoHoje = contarPorMusculo(seriesHoje);
  for (const [musculo, total] of Object.entries(porMusculoHoje)) {
    if (total > MAX_SERIES_POR_SESSAO) {
      alertas.push({
        tipo: "series_excessivas_sessao",
        musculo,
        mensagem: `Mais de ${MAX_SERIES_POR_SESSAO} séries diretas de ${musculo} nesta sessão. Qualidade tende a cair acima desse ponto.`,
        principio: "alertas",
      });
    }
  }

  const hojeMs = new Date(hoje).getTime();
  for (const { exercicioId, sessoes } of sessoesPorExercicio) {
    if (sessoes.length < 2) continue;
    const maisAntiga = sessoes[sessoes.length - 1];
    const diasDeHistorico = (hojeMs - new Date(maisAntiga.data).getTime()) / MS_POR_DIA;
    if (diasDeHistorico < DIAS_PARA_ALERTA_PROGRESSAO) continue;

    const cargaRecente = sessoes[0].series[0].carga;
    const cargaAntiga = maisAntiga.series[0].carga;
    if (cargaRecente <= cargaAntiga) {
      alertas.push({
        tipo: "sem_progressao_exercicio",
        exercicioId,
        mensagem: "Sem progressão de carga neste exercício há 4+ semanas. Considere trocar de exercício ou revisar recuperação.",
        principio: "alertas",
      });
    }
  }

  return alertas;
}
