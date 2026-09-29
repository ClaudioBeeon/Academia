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

// De onde o relógio da sessão conta. Sair do treino e tocar em "Continuar
// treino" monta a sessão de novo — sem isso o relógio voltava pro 00:00 no
// meio do treino. A primeira série já registrada hoje é o melhor sinal de
// quando o treino começou; mais de 4 h atrás é outro treino (ou um treino
// abandonado), então conta de agora.
export function inicioDaSessaoEmAndamento({ seriesDoDia = [], agoraMs = Date.now() } = {}) {
  const limite = agoraMs - DURACAO_MAXIMA_MIN * 60000;
  const horarios = seriesDoDia
    .map((s) => s.registradaEm)
    .filter((t) => Number.isFinite(t) && t >= limite && t <= agoraMs);
  return horarios.length > 0 ? Math.min(...horarios) : agoraMs;
}

// "07:05" até 59:59; a partir de 1 h vira "1:02:05" em vez de "62:05".
export function formatarDuracaoSessao(segundosTotais) {
  const s = Math.max(0, Math.floor(segundosTotais));
  const horas = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, "0");
  return horas > 0 ? `${horas}:${String(min).padStart(2, "0")}:${seg}` : `${String(min).padStart(2, "0")}:${seg}`;
}
