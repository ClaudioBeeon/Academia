// js/data/imagensExercicio.js
//
// Liga cada exercício à imagem dele no bucket do Supabase. A fonte da
// verdade é o próprio bucket (o nome do arquivo diz o exercício: é o que
// subirImagemExercicio grava), não o campo imagemUrl — assim:
//   - as imagens que a atualização do catálogo desligou (até 01/10/2026)
//     voltam sozinhas;
//   - uma imagem subida por fora do app (direto no bucket) aparece no
//     celular na próxima abertura, sem precisar baixar tudo do servidor.
// Com mais de uma imagem pro mesmo exercício, vale a mais nova.
import { getAll, put } from "./db.js";
import { listarImagensExercicio } from "./supabaseClient.js";

// "<exercicioId>-<timestamp>.<ext>", ex.: "remada_serrote_halter-1787600807290.png"
const NOME_ARQUIVO = /^(.+)-(\d+)\.[a-z0-9]+$/i;

export function imagemMaisNovaPorExercicio(arquivos) {
  const escolhidas = new Map();
  for (const { nome, url } of arquivos) {
    const casamento = NOME_ARQUIVO.exec(nome);
    if (!casamento) continue;
    const [, exercicioId, instante] = casamento;
    const atual = escolhidas.get(exercicioId);
    if (!atual || Number(instante) > atual.instante) escolhidas.set(exercicioId, { instante: Number(instante), url });
  }
  return new Map([...escolhidas].map(([id, { url }]) => [id, url]));
}

export async function religarImagensExercicios(db, { listarImpl = listarImagensExercicio } = {}) {
  const arquivos = await listarImpl();
  if (arquivos.length === 0) return [];
  const porExercicio = imagemMaisNovaPorExercicio(arquivos);
  const religados = [];
  for (const exercicio of await getAll(db, "exercicios")) {
    const url = porExercicio.get(exercicio.id);
    if (url && exercicio.imagemUrl !== url) {
      await put(db, "exercicios", { ...exercicio, imagemUrl: url });
      religados.push(exercicio.id);
    }
  }
  return religados;
}
