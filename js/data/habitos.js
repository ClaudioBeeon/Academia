// js/data/habitos.js
//
// Hábitos diários (creatina, álcool, sono, aquecimento) — loja própria,
// separada de registrosDiarios/dieta.json, mesma responsabilidade única já
// usada no resto do protocolo (adendo seção Sugestões).
import { get, put, getAll } from "./db.js";

export async function getHabito(db, data) {
  return get(db, "habitos", data);
}

export async function registrarHabito(db, data, campos) {
  const existente = await get(db, "habitos", data);
  const mesclado = { ...(existente ?? {}), ...campos, data };
  await put(db, "habitos", mesclado);
  return mesclado;
}

export async function getHabitosRecentes(db, limite = 14) {
  const todos = await getAll(db, "habitos");
  return todos.sort((a, b) => b.data.localeCompare(a.data)).slice(0, limite);
}
