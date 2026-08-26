// js/data/ajustesSessao.js
//
// Ajustes que valem só para a sessão de hoje — nunca tocam a ficha
// persistida. Dois tipos, guardados por data em "config":
//
// - Substituição: trocar um exercício por outro (ex.: máquina ocupada).
//   O substituto herda a prescrição/séries-alvo do original — é a mesma
//   meta, só que com outro movimento.
// - Adiamento: "pular pra depois" — não conta como pulado nem concluído,
//   só empurra pro fim da fila de hoje, então a pessoa volta nele depois
//   dos outros.
import { get, put } from "./db.js";

const CHAVE_SUBSTITUICOES = "substituicoesPorDia";
const CHAVE_ADIAMENTOS = "adiamentosPorDia";

export async function getSubstituicoesDoDia(db, hoje) {
  const registro = await get(db, "config", CHAVE_SUBSTITUICOES);
  return registro?.valor?.[hoje] ?? {};
}

export async function salvarSubstituicao(db, hoje, exercicioOriginalId, exercicioNovoId) {
  const registro = await get(db, "config", CHAVE_SUBSTITUICOES);
  const mapa = registro?.valor ?? {};
  mapa[hoje] = { ...(mapa[hoje] ?? {}), [exercicioOriginalId]: exercicioNovoId };
  await put(db, "config", { chave: CHAVE_SUBSTITUICOES, valor: mapa });
}

export async function getAdiamentosDoDia(db, hoje) {
  const registro = await get(db, "config", CHAVE_ADIAMENTOS);
  return registro?.valor?.[hoje] ?? [];
}

export async function adiarExercicio(db, hoje, exercicioId) {
  const registro = await get(db, "config", CHAVE_ADIAMENTOS);
  const mapa = registro?.valor ?? {};
  const doDia = mapa[hoje] ?? [];
  if (!doDia.includes(exercicioId)) {
    mapa[hoje] = [...doDia, exercicioId];
    await put(db, "config", { chave: CHAVE_ADIAMENTOS, valor: mapa });
  }
}

/**
 * Aplica substituições e adiamentos de hoje em cima da lista de exercícios
 * já montada pela ficha/gerador. Um exercício adiado só volta pro fim da
 * fila se ainda não tiver nenhuma série feita hoje (senão "pular pra
 * depois" depois de já ter começado bagunçaria o que já foi registrado).
 * `exerciciosComSerieHoje` é um Set de ids — quem já tem pelo menos uma
 * série registrada hoje, pra essa checagem.
 */
export function aplicarAjustesSessaoDoDia(exerciciosHoje, todosExercicios, substituicoes, adiamentos, exerciciosComSerieHoje) {
  const comSubstituicao = exerciciosHoje.map((exercicio) => {
    const novoId = substituicoes[exercicio.id];
    if (!novoId) return exercicio;
    const substituto = todosExercicios.find((e) => e.id === novoId);
    if (!substituto) return exercicio;
    return { ...substituto, prescricao: exercicio.prescricao, seriesAlvo: exercicio.seriesAlvo, substituidoDe: exercicio.id };
  });

  if (adiamentos.length === 0) return comSubstituicao;

  const primeiros = [];
  const adiados = [];
  for (const exercicio of comSubstituicao) {
    const temSerieFeita = exerciciosComSerieHoje.has(exercicio.id);
    if (adiamentos.includes(exercicio.id) && !temSerieFeita) adiados.push(exercicio);
    else primeiros.push(exercicio);
  }
  return [...primeiros, ...adiados];
}
