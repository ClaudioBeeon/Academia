// js/data/historico.js
import { put, getAll } from "./db.js";

export function registrarSerie(db, serie) {
  return put(db, "historicoSeries", serie);
}

export async function getSeriesDoExercicioNaData(db, exercicioId, data) {
  const todas = await getAll(db, "historicoSeries");
  return todas.filter((s) => s.exercicioId === exercicioId && s.data === data);
}

export async function getUltimaSerieAnterior(db, exercicioId, dataAtual) {
  const todas = await getAll(db, "historicoSeries");
  const anteriores = todas
    .filter((s) => s.exercicioId === exercicioId && s.data < dataAtual)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  return anteriores.length > 0 ? anteriores[0] : null;
}

export async function getAmostrasRecentesDoExercicio(db, exercicioId, limite = 5) {
  const todas = await getAll(db, "historicoSeries");
  return todas
    .filter((s) => s.exercicioId === exercicioId)
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .slice(0, limite)
    .map((s) => ({ carga: s.carga, reps: s.reps, rir_relatado: s.rir }));
}
