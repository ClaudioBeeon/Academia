import { get, put } from "./db.js";

export async function getGrupoForcado(db, data) {
  const salvo = await get(db, "config", "grupoForcado");
  if (!salvo || salvo.data !== data) return null;
  return salvo.grupo;
}

export function definirGrupoForcado(db, data, grupo) {
  return put(db, "config", { chave: "grupoForcado", data, grupo });
}
