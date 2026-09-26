// js/data/testesSalto.js
//
// Teste de salto vertical (dia de Pernas + Impulsão): a cada 3 semanas,
// medido no app My Jump (validado contra plataforma de força — Balsalobre-
// Fernández 2015). Um registro por dia: salto com as mãos na cintura
// (cmjCm) e, opcional, com balanço dos braços (cmjBracosCm).
import { put, getAll, del } from "./db.js";

export const DIAS_ENTRE_TESTES = 21;

export async function salvarTesteSalto(db, { data, cmjCm, cmjBracosCm = null, observacao = "" }) {
  const registro = { data, cmjCm, observacao: observacao.trim() };
  if (Number.isFinite(cmjBracosCm)) registro.cmjBracosCm = cmjBracosCm;
  await put(db, "testesSalto", registro);
}

export async function getTestesSalto(db) {
  const todos = await getAll(db, "testesSalto");
  return todos.sort((a, b) => a.data.localeCompare(b.data));
}

export function excluirTesteSalto(db, data) {
  return del(db, "testesSalto", data);
}

// Dias até o próximo teste (0 = já dá pra testar). Sem teste ainda, é hoje.
export function diasAteProximoTeste(testes, hojeISO) {
  const ultimo = testes.at(-1);
  if (!ultimo) return 0;
  const dias = Math.round((new Date(`${hojeISO}T00:00:00`) - new Date(`${ultimo.data}T00:00:00`)) / 86400000);
  return Math.max(0, DIAS_ENTRE_TESTES - Math.max(0, dias));
}
