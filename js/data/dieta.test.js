import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, clearStore } from "./db.js";
import { getDietaBase, getSelecoesDoDia, salvarSelecaoRefeicao, adicionarAlimentoPessoal, calcularTotalDoDia, getSelecoesRecentes, adicionarRefeicao, removerRefeicao } from "./dieta.js";

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
  assert.equal(selecoes.cafeDaTarde, "fruta");
  db.close();
});

test("salvarSelecaoRefeicao mescla refeições diferentes no mesmo dia sem se sobrescrever", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosDiarios");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaManha", "unica");
  await salvarSelecaoRefeicao(db, "2026-08-22", "cafeDaTarde", "whey");
  const selecoes = await getSelecoesDoDia(db, "2026-08-22");
  assert.equal(selecoes.cafeDaManha, "unica");
  assert.equal(selecoes.cafeDaTarde, "whey");
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

test("calcularTotalDoDia soma refeições confirmadas e usa a primeira opção como estimativa nas não confirmadas", () => {
  const { total, detalhePorRefeicao } = calcularTotalDoDia(DIETA_EXEMPLO, { cafeDaTarde: "fruta" });
  assert.equal(total.kcal, 200 + 100);
  const cafeManha = detalhePorRefeicao.find((r) => r.chave === "cafeDaManha");
  const cafeTarde = detalhePorRefeicao.find((r) => r.chave === "cafeDaTarde");
  assert.equal(cafeManha.confirmada, false);
  assert.equal(cafeTarde.confirmada, true);
  assert.equal(cafeTarde.opcao.id, "fruta");
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
  const { total, detalhePorRefeicao } = calcularTotalDoDia(dietaComExtra, {});
  assert.equal(total.kcal, 200 + 120 + 150);
  assert.ok(detalhePorRefeicao.some((r) => r.chave === "ceia_de_teste"));
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
