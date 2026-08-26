// js/data/ajustesCadencia.js
//
// Ajuste de cadência por exercício, feito pela pessoa em cima do que a ficha
// prescreve. Fica em `config` (e não dentro da ficha) por dois motivos: a
// ficha é a prescrição do programa e continua sendo a referência, e assim
// trocar de bloco/ficha não carrega junto os ajustes de execução — que são
// preferência de quem treina, não do programa.
import { get, put } from "./db.js";

const CHAVE = "ajustesCadencia";

export async function getAjustesCadencia(db) {
  const registro = await get(db, "config", CHAVE);
  return registro?.valor ?? {};
}

export async function getAjusteCadencia(db, exercicioId) {
  const todos = await getAjustesCadencia(db);
  return todos[exercicioId] ?? null;
}

export async function salvarAjusteCadencia(db, exercicioId, cadencia) {
  const todos = await getAjustesCadencia(db);
  todos[exercicioId] = cadencia;
  await put(db, "config", { chave: CHAVE, valor: todos });
  return todos;
}

// Volta o exercício pro que a ficha prescreve.
export async function limparAjusteCadencia(db, exercicioId) {
  const todos = await getAjustesCadencia(db);
  delete todos[exercicioId];
  await put(db, "config", { chave: CHAVE, valor: todos });
  return todos;
}
