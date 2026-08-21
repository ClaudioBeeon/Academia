import { get, put } from "./db.js";

export async function getUltimoDiaRegistrado(db) {
  const salvo = await get(db, "config", "sequenciaSemanal");
  return salvo ?? null;
}

export function registrarDiaDaSessao(db, dia, data, concluido = false) {
  return put(db, "config", { chave: "sequenciaSemanal", dia, data, concluido });
}
