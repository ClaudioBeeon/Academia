// js/data/dieta.js
import { get, put, getAll } from "./db.js";
import { getCheckin, registrarCheckin } from "./checkin.js";

const REFEICOES_ORDEM = ["cafeDaManha", "almoco", "cafeDaTarde", "janta"];

export async function getDietaBase(db) {
  return get(db, "dietaBase", "1.0");
}

export async function getSelecoesDoDia(db, data) {
  const registro = await getCheckin(db, data);
  return registro?.refeicoes ?? {};
}

export async function salvarSelecaoRefeicao(db, data, refeicaoChave, opcaoId) {
  const registro = await getCheckin(db, data);
  const refeicoes = { ...(registro?.refeicoes ?? {}), [refeicaoChave]: opcaoId };
  await registrarCheckin(db, data, { refeicoes });
  return refeicoes;
}

// Dias recentes com pelo menos uma refeição marcada pelo usuário — usado
// pra decidir se há dado suficiente pra afirmar déficit consistente (nunca
// assume déficit sem refeição de fato registrada).
export async function getSelecoesRecentes(db, limite = 3) {
  const todos = await getAll(db, "registrosDiarios");
  return todos
    .filter((r) => r.refeicoes && Object.keys(r.refeicoes).length > 0)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, limite);
}

export async function adicionarAlimentoPessoal(db, alimento) {
  const dieta = await getDietaBase(db);
  const listaAlimentosPessoal = [...(dieta.listaAlimentosPessoal ?? []), alimento];
  const atualizado = { ...dieta, listaAlimentosPessoal };
  await put(db, "dietaBase", atualizado);
  return atualizado;
}

// Soma as opções escolhidas para cada refeição. Refeição ainda não marcada
// pelo usuário entra com a primeira opção, mas sinalizada como "estimado"
// (não confirmado) — nunca presumir silenciosamente qual opção foi usada.
export function calcularTotalDoDia(dietaBase, selecoes = {}) {
  const refeicoes = dietaBase?.dietaBase ?? {};
  const detalhePorRefeicao = [];
  const total = { kcal: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0 };

  for (const chave of REFEICOES_ORDEM) {
    const refeicao = refeicoes[chave];
    if (!refeicao) continue;
    const opcaoId = selecoes[chave];
    const confirmada = opcaoId !== undefined;
    const opcao = refeicao.opcoes.find((o) => o.id === opcaoId) ?? refeicao.opcoes[0];

    total.kcal += opcao.totalEstimado.kcal;
    total.proteina_g += opcao.totalEstimado.proteina_g;
    total.carboidrato_g += opcao.totalEstimado.carboidrato_g;
    total.gordura_g += opcao.totalEstimado.gordura_g;

    detalhePorRefeicao.push({ chave, nome: refeicao.nome, opcao, confirmada });
  }

  return { total, detalhePorRefeicao };
}
