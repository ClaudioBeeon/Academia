// js/data/observacoesTreino.js
//
// Observação livre no fim da sessão de treino — pra registrar algo que vale
// a pena revisar depois com mais calma (dor, sensação, dúvida técnica), sem
// interromper o fluxo pra escrever pergunta+resposta pra IA na hora. Loja
// própria, mesma responsabilidade única do resto do protocolo (ver
// js/data/habitos.js) — nunca lida automaticamente por nenhuma lógica do
// app, só existe pra ser exportada em markdown (js/data/exportImport.js) e
// revisada fora do app.
import { get, put, getAll, del } from "./db.js";

export async function getObservacaoTreino(db, data) {
  const registro = await get(db, "observacoesTreino", data);
  return registro?.texto ?? "";
}

export async function salvarObservacaoTreino(db, data, texto) {
  const limpo = texto.trim();
  if (!limpo) {
    await del(db, "observacoesTreino", data);
    return;
  }
  await put(db, "observacoesTreino", { data, texto: limpo });
}

export async function getObservacoesTreino(db) {
  const todas = await getAll(db, "observacoesTreino");
  return todas.sort((a, b) => b.data.localeCompare(a.data));
}
