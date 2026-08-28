// js/data/dieta.js
import { get, put, getAll } from "./db.js";
import { getCheckin, registrarCheckin } from "./checkin.js";

export const REFEICOES_ORDEM = ["cafeDaManha", "almoco", "cafeDaTarde", "janta"];

// Ordem estável das refeições: as 4 base sempre nessa sequência, depois
// qualquer refeição extra cadastrada manualmente. Object.keys() por si só
// não garante essa ordem — IndexedDB não preserva a ordem de inserção das
// chaves de um objeto aninhado ao gravar/ler (structured clone), então usar
// Object.entries() direto pode devolver as refeições fora de ordem depois
// de um reload. Única fonte de verdade, usada tanto pra somar o total
// quanto pra renderizar a lista (js/screens/dieta.js).
export function ordenarChavesRefeicoes(dietaBase) {
  const chaves = Object.keys(dietaBase?.dietaBase ?? {});
  return [...REFEICOES_ORDEM, ...chaves.filter((chave) => !REFEICOES_ORDEM.includes(chave))].filter((chave) => chaves.includes(chave));
}

export async function getDietaBase(db) {
  return get(db, "dietaBase", "1.0");
}

export async function getSelecoesDoDia(db, data) {
  const registro = await getCheckin(db, data);
  return registro?.refeicoes ?? {};
}

// Cada refeição pode ter mais de uma opção marcada ao mesmo tempo (ex.:
// "banana + morango" e "2 bananas" no mesmo café da manhã) — por isso
// guarda uma lista de ids por refeição, e cada clique alterna (liga/desliga)
// a opção clicada em vez de substituir a seleção inteira.
//
// Encadeada numa fila (em vez de rodar direto): ler-modificar-escrever sem
// isso tem corrida real — dois cliques em opções diferentes, rápido o
// suficiente pro segundo ler o registro antes do primeiro terminar de
// gravar, perdem a primeira marcação. Encadear em cima da mesma Promise
// garante que cada chamada só lê depois que a anterior já gravou.
let filaDeEscritaSelecao = Promise.resolve();

export function salvarSelecaoRefeicao(db, data, refeicaoChave, opcaoId) {
  filaDeEscritaSelecao = filaDeEscritaSelecao
    .catch(() => {}) // uma falha na escrita anterior não deve travar a fila pras próximas
    .then(() => gravarSelecaoRefeicao(db, data, refeicaoChave, opcaoId));
  return filaDeEscritaSelecao;
}

async function gravarSelecaoRefeicao(db, data, refeicaoChave, opcaoId) {
  const registro = await getCheckin(db, data);
  const atual = registro?.refeicoes?.[refeicaoChave];
  const idsAtuais = Array.isArray(atual) ? atual : atual !== undefined ? [atual] : [];
  const novaLista = idsAtuais.includes(opcaoId)
    ? idsAtuais.filter((id) => id !== opcaoId)
    : [...idsAtuais, opcaoId];
  const refeicoes = { ...(registro?.refeicoes ?? {}), [refeicaoChave]: novaLista };
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

function gerarSlug(texto, chavesExistentes, fallback) {
  const base =
    texto
      .normalize("NFD")
      .replace(new RegExp("[̀-ͯ]", "g"), "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || fallback;
  let chave = base;
  let contador = 2;
  while (chavesExistentes.has(chave)) {
    chave = `${base}_${contador}`;
    contador++;
  }
  return chave;
}

export async function adicionarRefeicao(db, { nome, opcoes }) {
  const dieta = await getDietaBase(db);
  const chave = gerarSlug(nome, new Set(Object.keys(dieta.dietaBase)), "refeicao");
  const atualizado = { ...dieta, dietaBase: { ...dieta.dietaBase, [chave]: { nome, opcoes } } };
  await put(db, "dietaBase", atualizado);
  return atualizado;
}

export async function removerRefeicao(db, chave) {
  const dieta = await getDietaBase(db);
  const dietaBase = { ...dieta.dietaBase };
  delete dietaBase[chave];
  const atualizado = { ...dieta, dietaBase };
  await put(db, "dietaBase", atualizado);
  return atualizado;
}

// Opção dentro de uma refeição já existente (ex.: uma alternativa nova pro
// almoço) — diferente de adicionarRefeicao, que cria um novo horário/categoria.
export async function adicionarOpcaoRefeicao(db, chave, opcaoSemId) {
  const dieta = await getDietaBase(db);
  const refeicao = dieta.dietaBase[chave];
  const opcoesAtuais = refeicao?.opcoes ?? [];
  const id = gerarSlug(opcaoSemId.alimentos[0].nome, new Set(opcoesAtuais.map((o) => o.id)), "opcao");
  const opcao = { ...opcaoSemId, id };
  const atualizado = {
    ...dieta,
    dietaBase: { ...dieta.dietaBase, [chave]: { ...refeicao, opcoes: [...opcoesAtuais, opcao] } },
  };
  await put(db, "dietaBase", atualizado);
  return atualizado;
}

export async function removerOpcaoRefeicao(db, chave, opcaoId) {
  const dieta = await getDietaBase(db);
  const refeicao = dieta.dietaBase[chave];
  if (!refeicao) return dieta;
  const opcoes = refeicao.opcoes.filter((o) => o.id !== opcaoId);
  const atualizado = { ...dieta, dietaBase: { ...dieta.dietaBase, [chave]: { ...refeicao, opcoes } } };
  await put(db, "dietaBase", atualizado);
  return atualizado;
}

// Soma só as opções que o usuário de fato marcou em cada refeição — refeição
// sem nenhuma marcação não entra no total (nada de estimar com a primeira
// opção por baixo dos panos; menos preciso, mas sem confundir sobre o que
// realmente foi contado). `dataDeHoje` (opcional) também soma o que foi
// registrado em "comeu algo diferente" (listaAlimentosPessoal) NAQUELE dia —
// sem isso o item fica salvo só como histórico, sem contar no total exibido.
export function calcularTotalDoDia(dietaBase, selecoes = {}, dataDeHoje = null) {
  const refeicoes = dietaBase?.dietaBase ?? {};
  const ordemCompleta = ordenarChavesRefeicoes(dietaBase);
  const detalhePorRefeicao = [];
  const total = { kcal: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0, fibra_g: 0 };

  for (const chave of ordemCompleta) {
    const refeicao = refeicoes[chave];
    if (!refeicao || refeicao.opcoes.length === 0) continue;

    // selecoes[chave] é uma lista de ids (uma ou mais opções marcadas).
    // Formato antigo (id único, string) ainda é aceito pra não quebrar
    // seleções salvas antes dessa mudança.
    const selecaoRaw = selecoes[chave];
    const idsSelecionados = Array.isArray(selecaoRaw) ? selecaoRaw : selecaoRaw !== undefined ? [selecaoRaw] : [];
    const confirmada = idsSelecionados.length > 0;
    const opcoesEscolhidas = confirmada
      ? idsSelecionados.map((id) => refeicao.opcoes.find((o) => o.id === id)).filter(Boolean)
      : [];

    for (const opcao of opcoesEscolhidas) {
      total.kcal += opcao.totalEstimado.kcal;
      total.proteina_g += opcao.totalEstimado.proteina_g;
      total.carboidrato_g += opcao.totalEstimado.carboidrato_g;
      total.gordura_g += opcao.totalEstimado.gordura_g;
      total.fibra_g += opcao.totalEstimado.fibra_g ?? 0;
    }

    detalhePorRefeicao.push({ chave, nome: refeicao.nome, opcoes: opcoesEscolhidas, confirmada });
  }

  const alimentosPessoaisDoDia = dataDeHoje
    ? (dietaBase?.listaAlimentosPessoal ?? []).filter((a) => a.adicionadoEm === dataDeHoje)
    : [];
  for (const alimento of alimentosPessoaisDoDia) {
    total.kcal += alimento.kcal ?? 0;
    total.proteina_g += alimento.proteina_g ?? 0;
    total.carboidrato_g += alimento.carboidrato_g ?? 0;
    total.gordura_g += alimento.gordura_g ?? 0;
    total.fibra_g += alimento.fibra_g ?? 0;
  }

  return { total, detalhePorRefeicao, alimentosPessoaisDoDia };
}
