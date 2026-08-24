import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, clearStore } from "./db.js";
import { getDietaBase, getSelecoesDoDia, salvarSelecaoRefeicao, adicionarAlimentoPessoal, calcularTotalDoDia, getSelecoesRecentes, adicionarRefeicao, removerRefeicao, adicionarOpcaoRefeicao, removerOpcaoRefeicao, ordenarChavesRefeicoes } from "./dieta.js";

const DIETA_EXEMPLO = {
  versao: "1.0",
  listaAlimentosPessoal: [],
  dietaBase: {
    cafeDaManha: {
      nome: "Café da manhã",
      opcoes: [{ id: "unica", alimentos: [{ nome: "banana" }], totalEstimado: { kcal: 200, proteina_g: 2, carboidrato_g: 50, gordura_g: 1 } }],
    },
    cafeDaTarde: {
      nome: "Café da tarde",
      opcoes: [
        { id: "whey", alimentos: [{ nome: "whey" }], totalEstimado: { kcal: 120, proteina_g: 24, carboidrato_g: 3, gordura_g: 1.5 } },
        { id: "fruta", alimentos: [{ nome: "banana" }], totalEstimado: { kcal: 100, proteina_g: 1, carboidrato_g: 25, gordura_g: 0.5 } },
      ],
    },
  },
};

test("getDietaBase retorna undefined quando a loja está vazia", async () => {
  const db = await openDatabase();
  await clearStore(db, "dietaBase");
  const antes = await getDietaBase(db);
  assert.equal(antes, undefined);
  db.close();
});

test("salvarSelecaoRefeicao grava e getSelecoesDoDia lê de volta", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosDiarios");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "fruta");
  const selecoes = await getSelecoesDoDia(db, "2026-08-22");
  assert.deepEqual(selecoes.cafeDaTarde, ["fruta"]);
  db.close();
});

test("salvarSelecaoRefeicao mescla refeições diferentes no mesmo dia sem se sobrescrever", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosDiarios");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaManha", "unica");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "whey");
  const selecoes = await getSelecoesDoDia(db, "2026-08-22");
  assert.deepEqual(selecoes.cafeDaManha, ["unica"]);
  assert.deepEqual(selecoes.cafeDaTarde, ["whey"]);
  db.close();
});

test("salvarSelecaoRefeicao permite mais de uma opção marcada na mesma refeição", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosDiarios");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "whey");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "fruta");
  const selecoes = await getSelecoesDoDia(db, "2026-08-22");
  assert.deepEqual(selecoes.cafeDaTarde, ["whey", "fruta"]);
  db.close();
});

test("salvarSelecaoRefeicao não perde marcação quando dois cliques disparam sem esperar um pelo outro", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosDiarios");
  // Sem await entre as duas chamadas — simula dois cliques rápidos em
  // opções diferentes da mesma refeição, que antes causava leitura-antes-da-
  // escrita e perdia a primeira marcação.
  const p1 = salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaManha", "banana_morango");
  const p2 = salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaManha", "2_bananas");
  await Promise.all([p1, p2]);
  const selecoes = await getSelecoesDoDia(db, "2026-08-22");
  assert.deepEqual(selecoes.cafeDaManha, ["banana_morango", "2_bananas"]);
  db.close();
});

test("salvarSelecaoRefeicao clicar de novo na mesma opção desmarca ela", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosDiarios");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "whey");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "fruta");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "whey");
  const selecoes = await getSelecoesDoDia(db, "2026-08-22");
  assert.deepEqual(selecoes.cafeDaTarde, ["fruta"]);
  db.close();
});

test("adicionarAlimentoPessoal acrescenta à lista sem apagar os anteriores", async () => {
  const db = await openDatabase();
  await clearStore(db, "dietaBase");
  const { put } = await import("./db.js");
  await put(db, "dietaBase", DIETA_EXEMPLO);
  await adicionarAlimentoPessoal(db, { nome: "pizza", kcal: 300 });
  const dieta = await getDietaBase(db);
  assert.equal(dieta.listaAlimentosPessoal.length, 1);
  assert.equal(dieta.listaAlimentosPessoal[0].nome, "pizza");
  db.close();
});

test("getSelecoesRecentes só retorna dias com ao menos uma refeição marcada", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosDiarios");
  await salvarSelecaoRefeicao(db, "2026-08-20", "cafeDaManha", "unica");
  const { registrarCheckin } = await import("./checkin.js");
  await registrarCheckin(db, "2026-08-21", { qualidadePercebida: 4 }); // check-in sem refeições marcadas
  const recentes = await getSelecoesRecentes(db);
  assert.deepEqual(recentes.map((r) => r.data), ["2026-08-20"]);
  db.close();
});

test("calcularTotalDoDia só soma refeições confirmadas — a sem marcação nenhuma entra zerada, não estimada", () => {
  const { total, detalhePorRefeicao } = calcularTotalDoDia(DIETA_EXEMPLO, { cafeDaTarde: ["fruta"] });
  assert.equal(total.kcal, 100);
  const cafeManha = detalhePorRefeicao.find((r) => r.chave === "cafeDaManha");
  const cafeTarde = detalhePorRefeicao.find((r) => r.chave === "cafeDaTarde");
  assert.equal(cafeManha.confirmada, false);
  assert.deepEqual(cafeManha.opcoes, []);
  assert.equal(cafeTarde.confirmada, true);
  assert.equal(cafeTarde.opcoes[0].id, "fruta");
});

test("calcularTotalDoDia soma todas as opções marcadas quando mais de uma está confirmada na mesma refeição", () => {
  const { total, detalhePorRefeicao } = calcularTotalDoDia(DIETA_EXEMPLO, { cafeDaTarde: ["whey", "fruta"] });
  assert.equal(total.kcal, 120 + 100);
  const cafeTarde = detalhePorRefeicao.find((r) => r.chave === "cafeDaTarde");
  assert.equal(cafeTarde.opcoes.length, 2);
});

test("calcularTotalDoDia aceita formato antigo (id único, string) sem quebrar", () => {
  const { total, detalhePorRefeicao } = calcularTotalDoDia(DIETA_EXEMPLO, { cafeDaTarde: "fruta" });
  assert.equal(total.kcal, 100);
  const cafeTarde = detalhePorRefeicao.find((r) => r.chave === "cafeDaTarde");
  assert.equal(cafeTarde.confirmada, true);
  assert.equal(cafeTarde.opcoes[0].id, "fruta");
});

test("calcularTotalDoDia inclui refeições adicionadas manualmente, fora das 4 refeições base", () => {
  const dietaComExtra = {
    ...DIETA_EXEMPLO,
    dietaBase: {
      ...DIETA_EXEMPLO.dietaBase,
      ceia_de_teste: {
        nome: "Ceia de teste",
        opcoes: [{ id: "unica", alimentos: [{ nome: "iogurte" }], totalEstimado: { kcal: 150, proteina_g: 10, carboidrato_g: 15, gordura_g: 4 } }],
      },
    },
  };
  const { total, detalhePorRefeicao } = calcularTotalDoDia(dietaComExtra, { cafeDaManha: ["unica"], ceia_de_teste: ["unica"] });
  assert.equal(total.kcal, 200 + 150);
  assert.ok(detalhePorRefeicao.some((r) => r.chave === "ceia_de_teste"));
});

test("calcularTotalDoDia soma o que foi registrado em listaAlimentosPessoal no dia informado", () => {
  const dietaComAlimentoPessoal = {
    ...DIETA_EXEMPLO,
    listaAlimentosPessoal: [
      { nome: "pizza", kcal: 300, proteina_g: 12, carboidrato_g: 35, gordura_g: 10, adicionadoEm: "2026-08-24" },
      { nome: "sorvete", kcal: 200, proteina_g: 3, carboidrato_g: 25, gordura_g: 9, adicionadoEm: "2026-08-20" },
    ],
  };
  const { total, alimentosPessoaisDoDia } = calcularTotalDoDia(dietaComAlimentoPessoal, { cafeDaManha: ["unica"] }, "2026-08-24");
  assert.equal(total.kcal, 200 + 300);
  assert.equal(alimentosPessoaisDoDia.length, 1);
  assert.equal(alimentosPessoaisDoDia[0].nome, "pizza");
});

test("calcularTotalDoDia sem data informada não soma listaAlimentosPessoal (compatibilidade)", () => {
  const dietaComAlimentoPessoal = {
    ...DIETA_EXEMPLO,
    listaAlimentosPessoal: [{ nome: "pizza", kcal: 300, proteina_g: 12, carboidrato_g: 35, gordura_g: 10, adicionadoEm: "2026-08-24" }],
  };
  const { total, alimentosPessoaisDoDia } = calcularTotalDoDia(dietaComAlimentoPessoal, { cafeDaManha: ["unica"] });
  assert.equal(total.kcal, 200);
  assert.deepEqual(alimentosPessoaisDoDia, []);
});

test("adicionarRefeicao cria uma refeição com chave derivada do nome, sem acentos/espaços", async () => {
  const db = await openDatabase();
  await clearStore(db, "dietaBase");
  const { put } = await import("./db.js");
  await put(db, "dietaBase", DIETA_EXEMPLO);
  const opcoes = [{ id: "unica", alimentos: [{ nome: "iogurte" }], totalEstimado: { kcal: 150, proteina_g: 10, carboidrato_g: 15, gordura_g: 4 } }];
  const atualizado = await adicionarRefeicao(db, { nome: "Ceia da Noite", opcoes });
  assert.ok(atualizado.dietaBase.ceia_da_noite);
  assert.equal(atualizado.dietaBase.ceia_da_noite.nome, "Ceia da Noite");
  assert.deepEqual(atualizado.dietaBase.ceia_da_noite.opcoes, opcoes);
  assert.ok(atualizado.dietaBase.cafeDaManha, "refeições existentes continuam intactas");
  db.close();
});

test("removerRefeicao remove apenas a refeição indicada", async () => {
  const db = await openDatabase();
  await clearStore(db, "dietaBase");
  const { put } = await import("./db.js");
  await put(db, "dietaBase", DIETA_EXEMPLO);
  const atualizado = await removerRefeicao(db, "cafeDaTarde");
  assert.equal(atualizado.dietaBase.cafeDaTarde, undefined);
  assert.ok(atualizado.dietaBase.cafeDaManha);
  db.close();
});

test("adicionarOpcaoRefeicao acrescenta uma opção a uma refeição existente, sem apagar as outras", async () => {
  const db = await openDatabase();
  await clearStore(db, "dietaBase");
  const { put } = await import("./db.js");
  await put(db, "dietaBase", DIETA_EXEMPLO);
  const novaOpcao = { alimentos: [{ nome: "iogurte" }], totalEstimado: { kcal: 150, proteina_g: 10, carboidrato_g: 15, gordura_g: 4 } };
  const atualizado = await adicionarOpcaoRefeicao(db, "cafeDaManha", novaOpcao);
  assert.equal(atualizado.dietaBase.cafeDaManha.opcoes.length, 2);
  assert.equal(atualizado.dietaBase.cafeDaManha.opcoes[1].id, "iogurte");
  assert.equal(atualizado.dietaBase.cafeDaManha.opcoes[0].id, "unica", "opção original continua intacta");
  db.close();
});

test("adicionarOpcaoRefeicao gera id único quando o nome do alimento colide", async () => {
  const db = await openDatabase();
  await clearStore(db, "dietaBase");
  const { put } = await import("./db.js");
  await put(db, "dietaBase", DIETA_EXEMPLO);
  const opcao = { alimentos: [{ nome: "whey" }], totalEstimado: { kcal: 100, proteina_g: 20, carboidrato_g: 2, gordura_g: 1 } };
  const atualizado = await adicionarOpcaoRefeicao(db, "cafeDaTarde", opcao);
  assert.equal(atualizado.dietaBase.cafeDaTarde.opcoes.length, 3);
  assert.notEqual(atualizado.dietaBase.cafeDaTarde.opcoes[2].id, "whey", "já existia uma opção com id whey");
  db.close();
});

test("removerOpcaoRefeicao remove apenas a opção indicada, mantendo as outras da mesma refeição", async () => {
  const db = await openDatabase();
  await clearStore(db, "dietaBase");
  const { put } = await import("./db.js");
  await put(db, "dietaBase", DIETA_EXEMPLO);
  const atualizado = await removerOpcaoRefeicao(db, "cafeDaTarde", "whey");
  assert.equal(atualizado.dietaBase.cafeDaTarde.opcoes.length, 1);
  assert.equal(atualizado.dietaBase.cafeDaTarde.opcoes[0].id, "fruta");
  db.close();
});

test("ordenarChavesRefeicoes devolve sempre café da manhã, almoço, café da tarde, janta nessa ordem, não importa a ordem das chaves no objeto", () => {
  const dietaForaDeOrdem = {
    dietaBase: { janta: {}, cafeDaManha: {}, cafeDaTarde: {}, almoco: {} },
  };
  assert.deepEqual(ordenarChavesRefeicoes(dietaForaDeOrdem), ["cafeDaManha", "almoco", "cafeDaTarde", "janta"]);
});

test("ordenarChavesRefeicoes coloca refeições extras (fora das 4 base) depois, e ignora refeição base ausente", () => {
  const dieta = {
    dietaBase: { janta: {}, ceia_de_teste: {}, cafeDaManha: {} },
  };
  assert.deepEqual(ordenarChavesRefeicoes(dieta), ["cafeDaManha", "janta", "ceia_de_teste"]);
});

test("calcularTotalDoDia ignora refeição sem nenhuma opção restante em vez de quebrar", () => {
  const dietaComRefeicaoVazia = {
    ...DIETA_EXEMPLO,
    dietaBase: { ...DIETA_EXEMPLO.dietaBase, almoco: { nome: "Almoço", opcoes: [] } },
  };
  const { total, detalhePorRefeicao } = calcularTotalDoDia(dietaComRefeicaoVazia, { cafeDaManha: ["unica"], cafeDaTarde: ["whey"] });
  assert.equal(total.kcal, 200 + 120);
  assert.ok(!detalhePorRefeicao.some((r) => r.chave === "almoco"));
});
