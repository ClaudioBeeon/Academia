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
// - Pulado: "não vou fazer hoje" — sai da lista de pendentes (não trava o
//   "próximo exercício" nem a barra de progresso) e fica numa seção própria
//   da fila, de onde dá pra desfazer. Não grava série nenhuma.
// - Extra: exercício fora da ficha acrescentado só hoje, no fim da fila,
//   com a prescrição padrão do tipo dele (protocolo.json).
// - Superset: par [A, B] feito alternado — B vai pra logo depois de A na
//   fila; depois de uma série de A vai direto pra B, e o descanso vem
//   depois de B.
import { get, put } from "./db.js";

const CHAVE_SUBSTITUICOES = "substituicoesPorDia";
const CHAVE_ADIAMENTOS = "adiamentosPorDia";
const CHAVE_PULADOS = "puladosPorDia";
const CHAVE_EXTRAS = "extrasPorDia";
const CHAVE_SUPERSETS = "supersetsPorDia";

async function lerDoDia(db, chave, hoje, padrao) {
  const registro = await get(db, "config", chave);
  return registro?.valor?.[hoje] ?? padrao;
}

async function gravarDoDia(db, chave, hoje, valor) {
  const registro = await get(db, "config", chave);
  const mapa = registro?.valor ?? {};
  mapa[hoje] = valor;
  await put(db, "config", { chave, valor: mapa });
}

export function getExtrasDoDia(db, hoje) {
  return lerDoDia(db, CHAVE_EXTRAS, hoje, []);
}

export async function adicionarExtraHoje(db, hoje, exercicioId) {
  const atuais = await getExtrasDoDia(db, hoje);
  if (!atuais.includes(exercicioId)) await gravarDoDia(db, CHAVE_EXTRAS, hoje, [...atuais, exercicioId]);
}

export function getSupersetsDoDia(db, hoje) {
  return lerDoDia(db, CHAVE_SUPERSETS, hoje, []);
}

// Cada exercício só participa de um superset: criar um par novo desfaz
// qualquer par anterior dos dois.
export async function criarSupersetHoje(db, hoje, idA, idB) {
  const atuais = await getSupersetsDoDia(db, hoje);
  const semOsDois = atuais.filter(([a, b]) => ![a, b].some((id) => id === idA || id === idB));
  await gravarDoDia(db, CHAVE_SUPERSETS, hoje, [...semOsDois, [idA, idB]]);
}

export async function desfazerSupersetHoje(db, hoje, exercicioId) {
  const atuais = await getSupersetsDoDia(db, hoje);
  await gravarDoDia(db, CHAVE_SUPERSETS, hoje, atuais.filter(([a, b]) => a !== exercicioId && b !== exercicioId));
}

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

export async function getPuladosDoDia(db, hoje) {
  const registro = await get(db, "config", CHAVE_PULADOS);
  return registro?.valor?.[hoje] ?? [];
}

export async function pularExercicioHoje(db, hoje, exercicioId) {
  const registro = await get(db, "config", CHAVE_PULADOS);
  const mapa = registro?.valor ?? {};
  const doDia = mapa[hoje] ?? [];
  if (!doDia.includes(exercicioId)) {
    mapa[hoje] = [...doDia, exercicioId];
    await put(db, "config", { chave: CHAVE_PULADOS, valor: mapa });
  }
}

export async function desfazerPuloHoje(db, hoje, exercicioId) {
  const registro = await get(db, "config", CHAVE_PULADOS);
  const mapa = registro?.valor ?? {};
  mapa[hoje] = (mapa[hoje] ?? []).filter((id) => id !== exercicioId);
  await put(db, "config", { chave: CHAVE_PULADOS, valor: mapa });
}

/**
 * Aplica substituições e adiamentos de hoje em cima da lista de exercícios
 * já montada pela ficha/gerador. Um exercício adiado só volta pro fim da
 * fila se ainda não tiver nenhuma série feita hoje (senão "pular pra
 * depois" depois de já ter começado bagunçaria o que já foi registrado).
 * `exerciciosComSerieHoje` é um Set de ids — quem já tem pelo menos uma
 * série registrada hoje, pra essa checagem.
 */
export function aplicarAjustesSessaoDoDia(exerciciosHoje, todosExercicios, substituicoes, adiamentos, exerciciosComSerieHoje, { pulados = [], extras = [], supersets = [] } = {}) {
  let lista = aplicarTrocasEAdiamentos(exerciciosHoje, todosExercicios, substituicoes, adiamentos, exerciciosComSerieHoje);

  for (const id of extras) {
    if (lista.some((e) => e.id === id)) continue;
    const exercicio = todosExercicios.find((e) => e.id === id);
    if (exercicio) lista.push({ ...exercicio, seriesAlvo: 3, extraDoDia: true });
  }

  for (const [idA, idB] of supersets) {
    const a = lista.find((e) => e.id === idA);
    const b = lista.find((e) => e.id === idB);
    if (!a || !b) continue;
    const semB = lista.filter((e) => e !== b);
    const posA = semB.indexOf(a);
    const novoA = { ...a, supersetCom: { id: b.id, nome: b.nome, seriesAlvo: b.seriesAlvo ?? 3 }, supersetPosicao: "A" };
    const novoB = { ...b, supersetCom: { id: a.id, nome: a.nome, seriesAlvo: a.seriesAlvo ?? 3 }, supersetPosicao: "B" };
    lista = [...semB.slice(0, posA), novoA, novoB, ...semB.slice(posA + 1)];
  }

  if (pulados.length === 0) return lista;
  // Pulado vale pelo id que está na fila (o substituto, se houve troca) ou
  // pelo original — assim trocar e depois pular continua funcionando.
  return lista.map((e) => (pulados.includes(e.id) || pulados.includes(e.substituidoDe) ? { ...e, puladoHoje: true } : e));
}

function aplicarTrocasEAdiamentos(exerciciosHoje, todosExercicios, substituicoes, adiamentos, exerciciosComSerieHoje) {
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
