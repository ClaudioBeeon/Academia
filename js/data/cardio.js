// js/data/cardio.js
import { put, getAll, getAllByIndex, del } from "./db.js";

export function registrarCardio(db, registro) {
  return put(db, "registrosCardio", registro);
}

export function excluirCardio(db, id) {
  return del(db, "registrosCardio", id);
}

export function getCardioDoDia(db, data) {
  return getAllByIndex(db, "registrosCardio", "data", data);
}

export async function getCardioRecente(db, limite = 14) {
  const todos = await getAll(db, "registrosCardio");
  return todos.sort((a, b) => b.data.localeCompare(a.data)).slice(0, limite);
}

export async function getCardioDesde(db, dataCorte) {
  const todos = await getAll(db, "registrosCardio");
  return todos.filter((r) => r.data >= dataCorte);
}
