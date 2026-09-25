// js/data/notasExercicio.js
//
// Anotação curta por exercício e por dia, escrita na tela de execução
// (ex.: "banco no furo 3", "ombro incomodou na 3ª série"). A última
// anotação de dias anteriores volta a aparecer quando o exercício é aberto
// de novo — é pra isso que ela existe. Nunca é lida por nenhuma regra de
// treino.
import { get, put, del, getAll } from "./db.js";

function chaveDe(exercicioId, data) {
  return `${exercicioId}|${data}`;
}

export async function getNotaExercicio(db, exercicioId, data) {
  const registro = await get(db, "notasExercicio", chaveDe(exercicioId, data));
  return registro?.texto ?? "";
}

export async function salvarNotaExercicio(db, exercicioId, data, texto) {
  const limpo = texto.trim();
  const chave = chaveDe(exercicioId, data);
  if (!limpo) {
    await del(db, "notasExercicio", chave);
    return;
  }
  await put(db, "notasExercicio", { chave, exercicioId, data, texto: limpo });
}

// A anotação mais recente ANTERIOR a `data` (a de hoje aparece no próprio
// campo de texto).
export async function getUltimaNotaAnterior(db, exercicioId, data) {
  const todas = await getAll(db, "notasExercicio");
  return todas
    .filter((n) => n.exercicioId === exercicioId && n.data < data)
    .sort((a, b) => b.data.localeCompare(a.data))[0] ?? null;
}
