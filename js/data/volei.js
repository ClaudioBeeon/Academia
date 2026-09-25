// js/data/volei.js
//
// Sessões do treino de levantamento (uma por dia, chave = data): acertos e
// tentativas por exercício, testes T1–T4, desconforto nos dedos (0–10),
// duração e anotação. Sincroniza e entra no backup como o resto.
import { get, put, getAll } from "./db.js";

export async function getSessaoVolei(db, data) {
  return (await get(db, "sessoesVolei", data)) ?? null;
}

// Mescla com o que já estava salvo no dia (a tela salva aos poucos).
export async function salvarSessaoVolei(db, data, campos) {
  const atual = (await get(db, "sessoesVolei", data)) ?? { data, exercicios: {}, testes: {} };
  const nova = {
    ...atual,
    ...campos,
    data,
    exercicios: { ...atual.exercicios, ...(campos.exercicios ?? {}) },
    testes: { ...atual.testes, ...(campos.testes ?? {}) },
  };
  await put(db, "sessoesVolei", nova);
  return nova;
}

export async function getSessoesVolei(db) {
  const todas = await getAll(db, "sessoesVolei");
  return todas.sort((a, b) => a.data.localeCompare(b.data));
}

// Início do programa: o que foi definido em "Recomeçar programa" ou, sem
// isso, a primeira sessão registrada.
export async function getInicioVolei(db) {
  const definido = await get(db, "config", "inicioVolei");
  if (definido?.valor) return definido.valor;
  const [primeira] = await getSessoesVolei(db);
  return primeira?.data ?? null;
}

export function definirInicioVolei(db, dataISO) {
  return put(db, "config", { chave: "inicioVolei", valor: dataISO });
}
