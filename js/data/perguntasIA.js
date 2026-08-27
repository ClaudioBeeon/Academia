// js/data/perguntasIA.js
//
// Persiste a última pergunta+resposta da caixa de IA (js/screens/caixaPerguntaIA.js)
// — por exercício/dia na execução, por dia na dieta. Sem isso a resposta
// sumia ao trocar de tela, mesmo já tendo custado uma chamada de API.
// Reaproveita o store "config" (chave→valor) no mesmo padrão de
// js/data/cardioEmAndamento.js — não precisa de store novo nem migração.
import { get, put } from "./db.js";

function chaveExercicio(data, exercicioId) {
  return `perguntaIA_exercicio_${data}_${exercicioId}`;
}

function chaveDieta(data) {
  return `perguntaIA_dieta_${data}`;
}

export async function getPerguntaIAExercicio(db, data, exercicioId) {
  const registro = await get(db, "config", chaveExercicio(data, exercicioId));
  return registro?.valor ?? null;
}

export async function salvarPerguntaIAExercicio(db, data, exercicioId, { pergunta, resposta }) {
  await put(db, "config", { chave: chaveExercicio(data, exercicioId), valor: { pergunta, resposta } });
}

export async function getPerguntaIADieta(db, data) {
  const registro = await get(db, "config", chaveDieta(data));
  return registro?.valor ?? null;
}

export async function salvarPerguntaIADieta(db, data, { pergunta, resposta }) {
  await put(db, "config", { chave: chaveDieta(data), valor: { pergunta, resposta } });
}
