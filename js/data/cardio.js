// js/data/cardio.js
import { put, getAll, getAllByIndex } from "./db.js";

export function registrarCardio(db, registro) {
  return put(db, "registrosCardio", registro);
}

export function getCardioDoDia(db, data) {
  return getAllByIndex(db, "registrosCardio", "data", data);
}

export async function getCardioRecente(db, limite = 14) {
  const todos = await getAll(db, "registrosCardio");
  return todos.sort((a, b) => b.data.localeCompare(a.data)).slice(0, limite);
}
