// js/engine/estadoTreino.js
//
// Junta os alertas de treino num lugar só (auditoria 2026-09-24). Os
// motores de desempenho, volume/estagnação e recuperação existiam, mas
// nenhuma tela os chamava — o deload reativo e o alerta de estagnação
// prometidos na ficha nunca aconteciam. Motor puro: recebe os dados já
// lidos do banco e nunca decide nada sozinho, só aponta.
import { avaliarAlertasDesempenho, avaliarSugestaoDeDeload } from "./alertasDesempenho.js";
import { avaliarAlertasVolume } from "./alertasVolume.js";
import { avaliarAlertasRecuperacao } from "./alertasRecuperacao.js";

const SESSOES_POR_EXERCICIO = 10;

// Séries de trabalho de cada exercício agrupadas por data, da sessão mais
// recente pra mais antiga, sem o dia de hoje (sessão ainda em andamento).
export function agruparSessoesPorExercicio(todasAsSeries, hoje) {
  const porExercicio = new Map();
  for (const serie of todasAsSeries) {
    if (serie.tipoSerie === "aquecimento" || serie.data >= hoje) continue;
    if (!porExercicio.has(serie.exercicioId)) porExercicio.set(serie.exercicioId, new Map());
    const porData = porExercicio.get(serie.exercicioId);
    if (!porData.has(serie.data)) porData.set(serie.data, []);
    porData.get(serie.data).push(serie);
  }
  return [...porExercicio.entries()].map(([exercicioId, porData]) => ({
    exercicioId,
    sessoes: [...porData.keys()]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, SESSOES_POR_EXERCICIO)
      .map((data) => ({ data, series: porData.get(data) })),
  }));
}

export function avaliarEstadoDoTreino({ todasAsSeries = [], checkinsRecentes = [], hoje }) {
  const sessoesPorExercicio = agruparSessoesPorExercicio(todasAsSeries, hoje);
  const alertasDesempenho = avaliarAlertasDesempenho(sessoesPorExercicio);
  const alertasVolume = avaliarAlertasVolume({ sessoesPorExercicio, hoje });
  const alertasRecuperacao = avaliarAlertasRecuperacao(checkinsRecentes);
  const sugestaoDeload = avaliarSugestaoDeDeload({ alertasDesempenho, alertasRecuperacao });
  return {
    alertasDesempenho,
    alertasVolume,
    alertasRecuperacao,
    sugestaoDeload,
    fadigaDetectada: sugestaoDeload.fadigaDetectada,
  };
}
