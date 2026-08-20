// js/engine/alertasDesempenho.js
function agregarSessao(series) {
  const cargaMedia = series.reduce((soma, s) => soma + s.carga, 0) / series.length;
  const repsTotal = series.reduce((soma, s) => soma + s.reps, 0);
  const rirMedio = series.reduce((soma, s) => soma + s.rir, 0) / series.length;
  return { cargaMedia, repsTotal, rirMedio };
}

export function avaliarAlertasDesempenho(sessoesPorExercicio) {
  const alertas = [];

  for (const { exercicioId, sessoes } of sessoesPorExercicio) {
    if (sessoes.length < 2) continue;

    const recente = agregarSessao(sessoes[0].series);
    const anterior = agregarSessao(sessoes[1].series);
    if (recente.cargaMedia !== anterior.cargaMedia) continue;

    if (recente.repsTotal < anterior.repsTotal) {
      alertas.push({
        tipo: "desempenho_caindo",
        exercicioId,
        mensagem: "Desempenho caiu com o mesmo peso em 2 sessões seguidas. Pode ser sinal de recuperação insuficiente.",
        principio: "gatilhosDeloadReativo",
      });
    }

    if (recente.rirMedio > anterior.rirMedio) {
      alertas.push({
        tipo: "rir_subindo_sem_carga",
        exercicioId,
        mensagem: "RIR percebido subiu sem aumento de carga. Vale revisar se é hora de progredir ou de um deload.",
        principio: "gatilhosDeloadReativo",
      });
    }
  }

  return alertas;
}
