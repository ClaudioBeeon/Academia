// js/engine/atividade.js
import { semanaISO } from "./graficos.js";

const MINUTOS_ESTIMADOS_POR_EXERCICIO = 7;

export function calcularAtividadeMensal(todasAsSeries, hoje) {
  const validas = todasAsSeries.filter((s) => s.tipoSerie !== "aquecimento");
  const [anoHoje, mesHoje] = hoje.split("-");
  const semanaHoje = semanaISO(hoje);

  const datasComTreino = new Set(validas.map((s) => s.data));
  const treinosEsteMes = [...datasComTreino].filter((data) => data.startsWith(`${anoHoje}-${mesHoje}`)).length;

  const seriesDaSemana = validas.filter((s) => semanaISO(s.data) === semanaHoje);
  const seriesEstaSemana = seriesDaSemana.length;
  const exerciciosDistintosSemana = new Set(seriesDaSemana.map((s) => s.exercicioId)).size;
  const minutosAtivosEstaSemana = exerciciosDistintosSemana * MINUTOS_ESTIMADOS_POR_EXERCICIO;

  let diasSeguidos = 0;
  let cursor = datasComTreino.has(hoje) ? hoje : subtrairUmDia(hoje);
  while (datasComTreino.has(cursor)) {
    diasSeguidos++;
    cursor = subtrairUmDia(cursor);
  }

  return { treinosEsteMes, seriesEstaSemana, minutosAtivosEstaSemana, diasSeguidos };
}

function subtrairUmDia(dataISO) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Resumo de um mês (calendário da aba Treinos): dias com treino de
// musculação, séries de trabalho, volume (carga × reps) e sessões de
// cardio. `ano` e `mes` como números (mes 1–12).
export function resumirMes({ todasAsSeries = [], cardios = [], ano, mes }) {
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
  const doMes = todasAsSeries.filter((s) => s.data?.startsWith(prefixo) && (!s.tipoSerie || s.tipoSerie === "normal"));
  return {
    diasDeTreino: new Set(doMes.map((s) => s.data)).size,
    series: doMes.length,
    volumeKg: Math.round(doMes.reduce((soma, s) => soma + (s.carga ?? 0) * (s.reps ?? 0), 0)),
    cardios: cardios.filter((c) => c.data?.startsWith(prefixo)).length,
  };
}
