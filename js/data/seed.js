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

// Mesma lógica de migrarCadenciaDaFicha: a ficha é dado pessoal, editar
// data/ficha.json não alcança quem já tem o app instalado. Troca 3
// exercícios que causavam dificuldade real (elevação lateral no cabo —
// compensação com trapézio, sentida mais forte no braço esquerdo; tríceps
// testa com barra W — exigia estabilidade fina de cotovelo em bilateral;
// abdominal na máquina — dor lombar) por alternativas equivalentes, com o
// texto de execução/porquê atualizado pra cada uma. Roda uma vez só,
// marcada em config; nunca mexe num dia que já não tenha mais o
// exercicioId antigo (seja porque já migrou, seja porque a pessoa trocou
// esse slot por conta própria via substituição).
const CHAVE_VERSAO_SUBSTITUICOES = "substituicoesFichaVersao";
const VERSAO_SUBSTITUICOES = 1;

const SUBSTITUICOES_FICHA = {
  elevacao_lateral_cabo: {
    exercicioId: "elevacao_lateral_maquina",
    incrementoTexto: "Sobe 2 kg e volta pra 12.",
    porqueEstaAquiSufixo: " Substituiu a versão no cabo depois de dificuldade recorrente controlando o movimento sem compensar com o ombro subindo (trapézio assumindo o lugar do deltoide) — a máquina trava o braço no plano certo e tira essa margem de erro.",
    comoExecutar: "Ajuste o encosto pra o eixo de rotação da máquina ficar na altura do seu ombro — esse ajuste importa mais que a carga aqui. Suba o braço até a altura do ombro, não mais. Desça em 3s resistindo.",
    atencao: "Ajuste o encosto antes de cada série — assento errado muda o ângulo de trabalho inteiro. Se ainda sentir o ombro subindo (encolhendo) no início do movimento, reduza a carga: o trapézio ainda está roubando o trabalho do deltoide.",
  },
  triceps_testa_barra_w: {
    exercicioId: "triceps_frances_halteres",
    incrementoTexto: "Sobe 2 kg e volta pra 10.",
    porqueEstaAquiSufixo: " Substituiu a testa com barra W, que exige estabilidade fina de cotovelo em movimento bilateral — o halter permite ajustar cada braço e é mais fácil de controlar perto da posição alongada.",
    comoExecutar: "Sentado ou em pé, halteres acima da cabeça, cotovelos apontados pro teto e FIXOS. Desça o(s) halter(es) atrás da cabeça em 3 segundos até sentir o tríceps alongar. Suba sem deixar o cotovelo abrir pros lados.",
    atencao: "Se sentir incômodo no cotovelo, reduza a amplitude (não desça tanto atrás da cabeça) ou troque por corda na polia alta. Nunca insista em dor articular.",
  },
  abdominal_maquina: {
    exercicioId: "abdominal_polia_alta",
    incrementoTexto: "Sobe 2,5 kg e volta pra 12.",
    porqueEstaAquiSufixo: " Substituiu a versão na máquina depois de dor na lombar — ajoelhado, o quadril fica livre pra acompanhar o tronco em vez de preso num encosto que pode não bater com a curva natural da sua coluna.",
    comoExecutar: "Ajoelhado de frente pra polia alta, segure a corda perto do rosto. Flexione o TRONCO vindo do abdômen, arredondando a coluna, sem puxar com os braços — eles só seguram a corda no lugar. Volte em 2s sem relaxar totalmente.",
    atencao: "Se sentir o pescoço trabalhando mais que a barriga, reduza a carga. Se a lombar incomodar de novo mesmo nessa versão, para e me avisa — não é pra insistir em dor lombar em exercício nenhum de abdômen.",
  },
};

export async function migrarSubstituicoesFicha(db) {
  const marcador = await get(db, "config", CHAVE_VERSAO_SUBSTITUICOES);
  if (marcador?.valor >= VERSAO_SUBSTITUICOES) return { migrados: 0, jaFeita: true };

  const ficha = await get(db, "ficha", "1.0");
  if (!ficha?.dias) {
    await put(db, "config", { chave: CHAVE_VERSAO_SUBSTITUICOES, valor: VERSAO_SUBSTITUICOES });
    return { migrados: 0, jaFeita: false };
  }

  let migrados = 0;
  for (const dia of ficha.dias) {
    for (const exercicio of dia.exercicios ?? []) {
      const troca = SUBSTITUICOES_FICHA[exercicio.exercicioId];
      if (!troca) continue;
      exercicio.exercicioId = troca.exercicioId;
      exercicio.porqueEstaAqui = `${exercicio.porqueEstaAqui}${troca.porqueEstaAquiSufixo}`;
      exercicio.comoExecutar = troca.comoExecutar;
      exercicio.atencao = troca.atencao;
      const prefixoIncremento = exercicio.quandoSubirCarga.split(/\.\s*Sobe/)[0];
      exercicio.quandoSubirCarga = `${prefixoIncremento}. ${troca.incrementoTexto}`;
      migrados++;
    }
  }

  if (migrados > 0) await put(db, "ficha", ficha);
  await put(db, "config", { chave: CHAVE_VERSAO_SUBSTITUICOES, valor: VERSAO_SUBSTITUICOES });
  return { migrados, jaFeita: false };
}

// dietaBase é dado pessoal igual à ficha: o seed só a escreve numa conta
// vazia, então editar data/dieta.json não alcança quem já tem o app
// instalado. Acrescenta a opção "iogurte grego caseiro + banana + whey +
// aveia" no café da tarde de quem já tinha a dieta semeada antes dela
// existir. Roda uma vez só, marcada em config; nunca mexe se a opção já
// estiver lá (seja pela migração, seja porque a pessoa editou por conta
// própria e por acaso usou o mesmo id).
const CHAVE_VERSAO_OPCAO_CAFE_DA_TARDE = "opcaoIogurteCafeDaTardeVersao";
const VERSAO_OPCAO_CAFE_DA_TARDE = 1;
const OPCAO_IOGURTE_CAFE_DA_TARDE = {
  id: "iogurte_whey_fruta_aveia",
  alimentos: [
    { nome: "iogurte grego caseiro (leite proteico Camponesa + fermento + leite em pó)", quantidade: "200g", kcal: 138, proteina_g: 15.5, carboidrato_g: 13.9, gordura_g: 1.2, estimativa: true, margemPercentual: 20 },
    { nome: "banana", quantidade: "1 unidade média", kcal: 105, proteina_g: 1.3, carboidrato_g: 27, gordura_g: 0.4, estimativa: true, margemPercentual: 15 },
    { nome: "whey protein", quantidade: "1 dose (~30g)", kcal: 120, proteina_g: 24, carboidrato_g: 3, gordura_g: 1.5, estimativa: true, margemPercentual: 10 },
    { nome: "aveia em flocos", quantidade: "30g (3 colheres de sopa)", kcal: 117, proteina_g: 4.2, carboidrato_g: 20.1, gordura_g: 2.1, estimativa: true, margemPercentual: 15 },
  ],
  totalEstimado: { kcal: 480, proteina_g: 45, carboidrato_g: 64, gordura_g: 5.2 },
};

export async function migrarOpcaoIogurteCafeDaTarde(db) {
  const marcador = await get(db, "config", CHAVE_VERSAO_OPCAO_CAFE_DA_TARDE);
  if (marcador?.valor >= VERSAO_OPCAO_CAFE_DA_TARDE) return { migrado: false, jaFeita: true };

  const dieta = await get(db, "dietaBase", "1.0");
  const cafeDaTarde = dieta?.dietaBase?.cafeDaTarde;
  if (!cafeDaTarde) {
    await put(db, "config", { chave: CHAVE_VERSAO_OPCAO_CAFE_DA_TARDE, valor: VERSAO_OPCAO_CAFE_DA_TARDE });
    return { migrado: false, jaFeita: false };
  }

  const jaTem = cafeDaTarde.opcoes.some((o) => o.id === OPCAO_IOGURTE_CAFE_DA_TARDE.id);
  if (!jaTem) {
    cafeDaTarde.opcoes.push(OPCAO_IOGURTE_CAFE_DA_TARDE);
    await put(db, "dietaBase", dieta);
  }

  await put(db, "config", { chave: CHAVE_VERSAO_OPCAO_CAFE_DA_TARDE, valor: VERSAO_OPCAO_CAFE_DA_TARDE });
  return { migrado: !jaTem, jaFeita: false };
}

export async function seedIfNeeded(db, fetchImpl = globalThis.fetch) {
  const [storesPessoaisSemeadas, bibliotecaAtualizada] = await Promise.all([
    semearPessoaisSeVazias(db, fetchImpl),
    atualizarBiblioteca(db, fetchImpl),
  ]);

  // Depois do seed: numa conta nova a ficha recém-escrita já vem com
  // cadência do JSON e as migrações não acham nada pra fazer.
  const cadencia = await migrarCadenciaDaFicha(db);
  const substituicoes = await migrarSubstituicoesFicha(db);
  const opcaoCafeDaTarde = await migrarOpcaoIogurteCafeDaTarde(db);

  return {
    seeded: storesPessoaisSemeadas.length > 0 || bibliotecaAtualizada,
    storesPessoaisSemeadas,
    bibliotecaAtualizada,
    cadenciaMigrada: cadencia.migrados,
    substituicoesMigradas: substituicoes.migrados,
    opcaoCafeDaTardeMigrada: opcaoCafeDaTarde.migrado,
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
