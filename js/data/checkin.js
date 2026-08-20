// js/data/checkin.js
import { get, put, getAll } from "./db.js";

export async function getCheckin(db, data) {
  return get(db, "registrosDiarios", data);
}

export async function registrarCheckin(db, data, campos) {
  const existente = await get(db, "registrosDiarios", data);
  const mesclado = { ...(existente ?? {}), ...campos, data };
  await put(db, "registrosDiarios", mesclado);
  return mesclado;
}

export async function getCheckinsRecentes(db, limite = 14) {
  const todos = await getAll(db, "registrosDiarios");
  return todos
    .filter((r) => r.qualidadePercebida !== undefined)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, limite);
}
