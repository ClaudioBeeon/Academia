import { get, put, putAll, getAll, clearStore } from "./db.js";
import { interpretarTempo, textoDaCadencia } from "../engine/cadencia.js";

// Duas categorias de dado semeado, com regras opostas de propósito:
//
// PESSOAIS (perfil, protocolo, ficha, dieta) — pertencem a QUEM usa a conta,
// não ao repositório. Os JSONs em data/ são só o ponto de partida de uma
// conta nova e vazia: uma vez que a store tem conteúdo, o seed nunca mais
// encosta nela. Antes disso o seed regravava tudo a cada versão nova do
// protocolo, o que apagava a ficha e o perfil de qualquer pessoa que não
// fosse o dono do repositório — o que impedia duas pessoas de usarem o app
// com fichas diferentes.
//
// BIBLIOTECA (exercicios) — catálogo genérico, igual pra todo mundo, e é
// bom que continue chegando atualizado do repositório. Segue a regra antiga,
// versionada, preservando as observações de execução que a pessoa escreveu.
const ARQUIVOS_PESSOAIS = {
  perfil: "data/perfil.json",
  protocolo: "data/protocolo.json",
  dietaBase: "data/dieta.json",
  ficha: "data/ficha.json",
};

const ARQUIVO_EXERCICIOS = "data/exercicios.json";
const CHAVE_VERSAO_BIBLIOTECA = "seedVersion";
const ARQUIVO_PERFIS = "data/perfis.json";

async function estaVazia(db, storeName) {
  const registros = await getAll(db, storeName);
  return registros.length === 0;
}

// Semeia só as stores pessoais que ainda não têm nada. Devolve os nomes das
// que foram de fato preenchidas — vazio quer dizer "esta conta já tem os
// dados dela, não toquei em nada".
async function semearPessoaisSeVazias(db, fetchImpl) {
  const vazias = [];
  for (const store of Object.keys(ARQUIVOS_PESSOAIS)) {
    if (await estaVazia(db, store)) vazias.push(store);
  }
  if (vazias.length === 0) return [];

  await Promise.all(
    vazias.map(async (store) => {
      const conteudo = await fetchImpl(ARQUIVOS_PESSOAIS[store]).then((r) => r.json());
      await put(db, store, conteudo);
    })
  );
  return vazias;
}

// Catálogo de exercícios: regrava quando a versão do arquivo muda, mesclando
// as observacoesExecucao já escritas pela pessoa pra não perdê-las.
async function atualizarBiblioteca(db, fetchImpl) {
  const exercicios = await fetchImpl(ARQUIVO_EXERCICIOS).then((r) => r.json());

  const versaoAtual = await get(db, "config", CHAVE_VERSAO_BIBLIOTECA);
  if (versaoAtual && versaoAtual.valor === exercicios.versao) return false;

  const existentes = await getAll(db, "exercicios");
  const observacoesExistentes = new Map(existentes.map((e) => [e.id, e.observacoesExecucao]));
  const mesclados = exercicios.exercicios.map((seedExercicio) => {
    const observacaoExistente = observacoesExistentes.get(seedExercicio.id);
    return observacaoExistente
      ? { ...seedExercicio, observacoesExecucao: observacaoExistente }
      : seedExercicio;
  });

  await putAll(db, "exercicios", mesclados);
  await put(db, "config", { chave: CHAVE_VERSAO_BIBLIOTECA, valor: exercicios.versao });
  return true;
}

// A ficha é dado pessoal: o seed só a escreve numa conta vazia, então mudar
// data/ficha.json não alcança quem já tem o app instalado. Esta migração
// existe pra isso — dá à ficha que já está no banco o campo `cadencia`
// estruturado (a prosa sozinha não serve pro guia visual seguir) e sobe a
// subida de 1s pra 2s, que é a mudança de programa. Roda uma vez só,
// marcada em config, e nunca toca em exercício que já tenha `cadencia`
// (senão desfaria um ajuste feito pela pessoa).
const CHAVE_VERSAO_CADENCIA = "cadenciaEstruturadaVersao";
const VERSAO_CADENCIA = 1;

export async function migrarCadenciaDaFicha(db) {
  const marcador = await get(db, "config", CHAVE_VERSAO_CADENCIA);
  if (marcador?.valor >= VERSAO_CADENCIA) return { migrados: 0, jaFeita: true };

  const ficha = await get(db, "ficha", "1.0");
  if (!ficha?.dias) {
    await put(db, "config", { chave: CHAVE_VERSAO_CADENCIA, valor: VERSAO_CADENCIA });
    return { migrados: 0, jaFeita: false };
  }

  let migrados = 0;
  for (const dia of ficha.dias) {
    for (const exercicio of dia.exercicios ?? []) {
      if (exercicio.cadencia) continue;
      const base = interpretarTempo(exercicio.tempo);
      if (!base) continue; // isometria não tem cadência
      const nova = { ...base, concentrica: base.concentrica === 1 ? 2 : base.concentrica };
      exercicio.cadencia = nova;
      exercicio.tempo = textoDaCadencia(nova);
      migrados++;
    }
  }

  if (migrados > 0) await put(db, "ficha", ficha);
  await put(db, "config", { chave: CHAVE_VERSAO_CADENCIA, valor: VERSAO_CADENCIA });
  return { migrados, jaFeita: false };
}

export async function seedIfNeeded(db, fetchImpl = globalThis.fetch) {
  const [storesPessoaisSemeadas, bibliotecaAtualizada] = await Promise.all([
    semearPessoaisSeVazias(db, fetchImpl),
    atualizarBiblioteca(db, fetchImpl),
  ]);

  // Depois do seed: numa conta nova a ficha recém-escrita já vem com
  // cadência do JSON e a migração não acha nada pra fazer.
  const cadencia = await migrarCadenciaDaFicha(db);

  return {
    seeded: storesPessoaisSemeadas.length > 0 || bibliotecaAtualizada,
    storesPessoaisSemeadas,
    bibliotecaAtualizada,
    cadenciaMigrada: cadencia.migrados,
  };
}

// Usado pelo boot (js/app.js) pra decidir se vale a pena esperar o servidor
// antes de semear: só um aparelho realmente zerado precisa disso.
export async function bancoPessoalVazio(db) {
  for (const store of Object.keys(ARQUIVOS_PESSOAIS)) {
    if (!(await estaVazia(db, store))) return false;
  }
  return true;
}

// Seletor de perfil "estilo Netflix" (js/screens/config.js > aposLogin):
// quando uma conta do Supabase loga pela primeira vez e não traz nada do
// servidor, é sinal de conta nova — em vez de a pessoa ficar com o que foi
// auto-semeado (sempre o perfil "claudio", o dono do repositório), ela
// escolhe o nome dela numa lista definida em data/perfis.json e o app
// troca perfil/protocolo/ficha/dietaBase pelos arquivos daquele perfil.
export async function listarPerfisDisponiveis(fetchImpl = globalThis.fetch) {
  const manifesto = await fetchImpl(ARQUIVO_PERFIS).then((r) => r.json());
  return manifesto.perfis.map(({ id, nome }) => ({ id, nome }));
}

// Sobrescreve as stores pessoais com os arquivos do perfil escolhido — ação
// explícita da pessoa, então pode substituir o que já estava lá (diferente
// do seed automático, que nunca sobrescreve). Uma store pessoal que o
// perfil escolhido não define (ex.: francesco não tem dietaBase própria)
// é limpa em vez de deixar o conteúdo de outro perfil parecendo ser dela.
export async function semearPerfilNomeado(db, perfilId, fetchImpl = globalThis.fetch) {
  const manifesto = await fetchImpl(ARQUIVO_PERFIS).then((r) => r.json());
  const perfil = manifesto.perfis.find((p) => p.id === perfilId);
  if (!perfil) throw new Error(`Perfil "${perfilId}" não encontrado em data/perfis.json.`);

  await Promise.all(
    Object.keys(ARQUIVOS_PESSOAIS).map(async (store) => {
      const caminho = perfil.arquivos[store];
      if (!caminho) {
        await clearStore(db, store);
        return;
      }
      const conteudo = await fetchImpl(caminho).then((r) => r.json());
      await put(db, store, conteudo);
    })
  );
}
