// js/engine/sessao.js
export function calcularEstatisticasSessao(seriesDoDia) {
  const validas = seriesDoDia.filter((s) => s.tipoSerie !== "aquecimento");

  const totalSeries = validas.length;
  const volumeTotal = validas.reduce((soma, s) => soma + s.carga * s.reps, 0);
  const exercicios = new Set(validas.map((s) => s.exercicioId));
  const musculos = new Set(validas.map((s) => s.musculo));

  return {
    totalSeries,
    volumeTotal,
    exerciciosTreinados: exercicios.size,
    musculosTreinados: [...musculos].sort(),
  };
}

// Duração da sessão em minutos, pro resumo final. Começa no que vier
// primeiro: o toque em "Começar treino" (inicioSessaoTs, só existe
// enquanto o app não é fechado) ou a primeira série registrada hoje
// (registradaEm, gravado nas séries desde 24/09/2026). Acima de 4 h é
// sinal de que a sessão foi aberta e abandonada — melhor não mostrar.
const DURACAO_MAXIMA_MIN = 240;

export function calcularDuracaoSessaoMin({ inicioSessaoTs = null, seriesDoDia = [], agoraMs = Date.now() }) {
  const horarios = seriesDoDia.map((s) => s.registradaEm).filter((t) => Number.isFinite(t));
  const candidatos = [inicioSessaoTs, ...horarios].filter((t) => Number.isFinite(t));
  if (candidatos.length === 0) return null;
  const minutos = Math.round((agoraMs - Math.min(...candidatos)) / 60000);
  if (minutos < 0 || minutos > DURACAO_MAXIMA_MIN) return null;
  return minutos;
}
