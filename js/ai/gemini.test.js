import { test } from "node:test";
import assert from "node:assert/strict";
import { chamarGemini, interpretarComida, interpretarComidaPorFoto } from "./gemini.js";

test("chamarGemini retorna fallback gracioso quando não há chave", async () => {
  const resultado = await chamarGemini("prompt qualquer", { apiKey: "" });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, "sem_chave");
});

test("chamarGemini retorna fallback gracioso quando a API responde com erro", async () => {
  const fetchFalso = async () => ({ ok: false, status: 500 });
  const resultado = await chamarGemini("prompt", { apiKey: "abc", fetchImpl: fetchFalso });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, "erro_api_500");
});

test("chamarGemini retorna fallback gracioso quando o fetch lança exceção (offline)", async () => {
  const fetchFalso = async () => { throw new Error("network down"); };
  const resultado = await chamarGemini("prompt", { apiKey: "abc", fetchImpl: fetchFalso });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, "erro_rede");
});

test("chamarGemini devolve o texto quando a API responde normalmente", async () => {
  const fetchFalso = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: "resposta da IA" }] } }] }),
  });
  const resultado = await chamarGemini("prompt", { apiKey: "abc", fetchImpl: fetchFalso });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.texto, "resposta da IA");
});

test("interpretarComida faz o parse do JSON devolvido pela IA", async () => {
  const alimentoEsperado = { nome: "pizza", kcal: 300, proteina_g: 12, carboidrato_g: 35, gordura_g: 12, confianca: "media" };
  const fetchFalso = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(alimentoEsperado) }] } }] }),
  });
  const resultado = await interpretarComida("1 fatia de pizza", { apiKey: "abc", fetchImpl: fetchFalso });
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.alimento, alimentoEsperado);
});

test("interpretarComida lida com resposta cercada por ```json sem quebrar", async () => {
  const fetchFalso = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: "```json\n{\"nome\":\"maçã\",\"kcal\":95,\"proteina_g\":0.5,\"carboidrato_g\":25,\"gordura_g\":0.3,\"confianca\":\"alta\"}\n```" }] } }] }),
  });
  const resultado = await interpretarComida("uma maçã", { apiKey: "abc", fetchImpl: fetchFalso });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.alimento.nome, "maçã");
});

test("interpretarComida devolve fallback gracioso quando a resposta não é JSON válido", async () => {
  const fetchFalso = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: "não sei dizer" }] } }] }),
  });
  const resultado = await interpretarComida("algo estranho", { apiKey: "abc", fetchImpl: fetchFalso });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, "resposta_invalida");
});

test("interpretarComidaPorFoto manda a imagem como inlineData e faz parse do JSON devolvido", async () => {
  const alimentoEsperado = { nome: "barrinha de proteína", kcal: 200, proteina_g: 20, carboidrato_g: 18, gordura_g: 7, confianca: "media" };
  let corpoRecebido;
  const fetchFalso = async (_url, init) => {
    corpoRecebido = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(alimentoEsperado) }] } }] }),
    };
  };
  const resultado = await interpretarComidaPorFoto("ZmFrZWJhc2U2NA==", "image/jpeg", "", { apiKey: "abc", fetchImpl: fetchFalso });
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.alimento, alimentoEsperado);
  const partes = corpoRecebido.contents[0].parts;
  assert.equal(partes[1].inlineData.mimeType, "image/jpeg");
  assert.equal(partes[1].inlineData.data, "ZmFrZWJhc2U2NA==");
});

test("interpretarComidaPorFoto devolve fallback gracioso sem chave", async () => {
  const resultado = await interpretarComidaPorFoto("ZmFrZQ==", "image/jpeg", "", { apiKey: "" });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.motivo, "sem_chave");
});
