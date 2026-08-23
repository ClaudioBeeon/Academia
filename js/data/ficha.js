// js/data/ficha.js
import { get, put } from "./db.js";

const CHAVE = "1.0";

export async function getFicha(db) {
  const todas = await get(db, "ficha", CHAVE);
  return todas ?? null;
}

export function salvarFicha(db, ficha) {
  return put(db, "ficha", ficha);
}

// Data em que o bloco atual começou — usada pra derivar a semana do
// mesociclo. Fica em `config` porque é estado do usuário, não da ficha:
// rodar o mesmo bloco de novo depois do deload só precisa reescrever isso.
export async function getInicioDoBloco(db) {
  const registro = await get(db, "config", "inicioDoBloco");
  return registro?.valor ?? null;
}

export function definirInicioDoBloco(db, dataISO) {
  return put(db, "config", { chave: "inicioDoBloco", valor: dataISO });
}
