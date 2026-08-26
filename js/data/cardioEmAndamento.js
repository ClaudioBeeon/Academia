// js/data/cardioEmAndamento.js
//
// Progresso do cardio em andamento, salvo de verdade no IndexedDB — não só
// na memória da tela ou no módulo do widget flutuante (js/lib/timerFlutuante.js),
// que morrem os dois se o app fechar de verdade (aba/PWA encerrada pelo
// sistema, não só trocar de tela dentro do app). Sem isso, um cardio
// interrompido no meio simplesmente não existia em lugar nenhum — reabrir
// o app não tinha como saber que 1 minuto já tinha rolado.
import { get, put, del } from "./db.js";

const CHAVE = "cardioEmAndamento";

export async function salvarCardioEmAndamento(db, estado) {
  await put(db, "config", { chave: CHAVE, valor: estado });
}

export async function getCardioEmAndamento(db) {
  const registro = await get(db, "config", CHAVE);
  return registro?.valor ?? null;
}

export async function limparCardioEmAndamento(db) {
  await del(db, "config", CHAVE);
}
