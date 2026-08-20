// js/data/checkin.js
import { get, put } from "./db.js";

export async function getCheckin(db, data) {
  return get(db, "registrosDiarios", data);
}

export async function registrarCheckin(db, data, campos) {
  const existente = await get(db, "registrosDiarios", data);
  const mesclado = { ...(existente ?? {}), ...campos, data };
  await put(db, "registrosDiarios", mesclado);
  return mesclado;
}
