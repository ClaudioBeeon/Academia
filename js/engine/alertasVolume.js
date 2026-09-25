// js/engine/alertasVolume.js
//
// Dois alertas (auditoria 2026-09-24):
// - Séries diretas demais de um músculo numa sessão (> 8). Heurística de
//   conveniência (tempo/fadiga), não um limiar fisiológico demonstrado.
// - Exercício sem progresso há 4+ semanas. Antes comparava só a carga da
//   1ª série (que costuma ser a mais leve) e ignorava progresso em reps.
//   Agora usa o melhor índice de desempenho de cada sessão (Epley na melhor
//   série de trabalho) — mais reps com a mesma carga conta como progresso.
//   Serve só pra comparar o exercício com ele mesmo ao longo do tempo.
// Volume semanal abaixo/acima da faixa fica com js/engine/cobertura.js.
const MAX_SERIES_DIRETAS_POR_SESSAO = 8;
const DIAS_PARA_ALERTA_PROGRESSAO = 28;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function indiceDaSessao(sessao) {
  const trabalho = (sessao.series ?? []).filter((s) => s.tipoSerie !== "aquecimento" && s.carga > 0 && s.reps > 0);
  if (trabalho.length === 0) return null;
  return Math.max(...trabalho.map((s) => s.carga * (1 + s.reps / 30)));
}

export function avaliarAlertasVolume({ seriesHoje = [], sessoesPorExercicio = [], hoje }) {
  const alertas = [];

  const diretasHoje = {};
  for (const serie of seriesHoje) {
    if (serie.tipoSerie === "aquecimento" || serie.direta === false) continue;
    diretasHoje[serie.musculo] = (diretasHoje[serie.musculo] ?? 0) + 1;
  }
  for (const [musculo, total] of Object.entries(diretasHoje)) {
    if (total > MAX_SERIES_DIRETAS_POR_SESSAO) {
      alertas.push({
        tipo: "series_excessivas_sessao",
        musculo,
        mensagem: `Mais de ${MAX_SERIES_DIRETAS_POR_SESSAO} séries diretas de ${musculo} nesta sessão. Considere distribuir em outro dia.`,
        principio: "alertas",
      });
    }
  }

  const hojeMs = new Date(`${hoje}T00:00:00`).getTime();
  for (const { exercicioId, sessoes } of sessoesPorExercicio) {
    const comIndice = sessoes
      .filter((s) => !(s.series ?? []).every((x) => x.semanaBloco === 7))
      .map((s) => ({ data: s.data, indice: indiceDaSessao(s) }))
      .filter((s) => s.indice != null);
    if (comIndice.length < 2) continue;

    const recente = comIndice[0];
    const recenteMs = new Date(`${recente.data}T00:00:00`).getTime();
    if ((hojeMs - recenteMs) / MS_POR_DIA > 14) continue; // exercício fora de uso — não opina
    const referencia = comIndice.find((s) => (recenteMs - new Date(`${s.data}T00:00:00`).getTime()) / MS_POR_DIA >= DIAS_PARA_ALERTA_PROGRESSAO);
    if (!referencia) continue;

    if (recente.indice <= referencia.indice) {
      alertas.push({
        tipo: "sem_progressao_exercicio",
        exercicioId,
        mensagem: "Sem progresso (nem carga nem reps) neste exercício há 4+ semanas. Antes de trocar o exercício, confira sono, dieta e se o RIR registrado está honesto.",
        principio: "alertas",
      });
    }
  }

  return alertas;
}
