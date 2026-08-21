// js/data/historico.js
import { put, del, getAllByIndex, getAll } from "./db.js";

export function registrarSerie(db, serie) {
  return put(db, "historicoSeries", serie);
}

export async function excluirSeriesDoDia(db, exercicioIds, data) {
  const todas = await getAll(db, "historicoSeries");
  const alvo = todas.filter((s) => exercicioIds.includes(s.exercicioId) && s.data === data);
  for (const serie of alvo) {
    await del(db, "historicoSeries", serie.id);
  }
}

export async function getSeriesDoExercicioNaData(db, exercicioId, data) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  return doExercicio
    .filter((s) => s.data === data)
    .sort((a, b) => (a.serieNumero ?? 0) - (b.serieNumero ?? 0));
}

export async function getUltimaSerieAnterior(db, exercicioId, dataAtual) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  const anteriores = doExercicio
    .filter((s) => s.data < dataAtual)
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  return anteriores.length > 0 ? anteriores[0] : null;
}

export async function getAmostrasRecentesDoExercicio(db, exercicioId, limite = 5) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  return doExercicio
    .filter((s) => s.tipoSerie !== "aquecimento")
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
    .slice(0, limite)
    .map((s) => ({ carga: s.carga, reps: s.reps, rir_relatado: s.rir }));
}

export async function getHistoricoCompletoDoExercicio(db, exercicioId) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  return doExercicio.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
}

export function getSeriesDoDia(db, data) {
  return getAllByIndex(db, "historicoSeries", "data", data);
}

export async function getUltimaSerieGeral(db) {
  const todas = await getAll(db, "historicoSeries");
  if (todas.length === 0) return undefined;
  return todas.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)[0];
}

export async function getSeriesDaUltimaSessaoAnterior(db, exercicioId, dataAtual) {
  const doExercicio = await getAllByIndex(db, "historicoSeries", "exercicioId", exercicioId);
  const anteriores = doExercicio.filter((s) => s.data < dataAtual);
  if (anteriores.length === 0) return [];
  const dataMaisRecente = anteriores.reduce((max, s) => (s.data > max ? s.data : max), anteriores[0].data);
  return anteriores.filter((s) => s.data === dataMaisRecente);
}

export async function getSeriesDesde(db, dataCorte) {
  const todas = await getAll(db, "historicoSeries");
  return todas.filter((s) => s.data >= dataCorte);
}

export async function getUltimasSessoesPorExercicio(db, limitePorExercicio = 10) {
  const todas = await getAll(db, "historicoSeries");
  const porExercicio = new Map();
  for (const serie of todas) {
    if (serie.tipoSerie === "aquecimento") continue;
    if (!porExercicio.has(serie.exercicioId)) porExercicio.set(serie.exercicioId, new Map());
    const porData = porExercicio.get(serie.exercicioId);
    if (!porData.has(serie.data)) porData.set(serie.data, []);
    porData.get(serie.data).push(serie);
  }

  const resultado = [];
  for (const [exercicioId, porData] of porExercicio) {
    const datasOrdenadas = [...porData.keys()].sort((a, b) => b.localeCompare(a)).slice(0, limitePorExercicio);
    resultado.push({
      exercicioId,
      sessoes: datasOrdenadas.map((data) => ({ data, series: porData.get(data) })),
    });
  }
  return resultado;
}
