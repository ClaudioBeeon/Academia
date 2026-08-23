import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTOES_DIARIAS, obterPerguntasPendentes } from "./perguntasDiarias.js";

test("sem nenhum hábito registrado, todas as perguntas estão pendentes", () => {
  const pendentes = obterPerguntasPendentes(undefined);
  assert.equal(pendentes.length, QUESTOES_DIARIAS.length);
});

test("com o registro vazio ({}), todas as perguntas estão pendentes", () => {
  const pendentes = obterPerguntasPendentes({});
  assert.equal(pendentes.length, QUESTOES_DIARIAS.length);
});

test("uma pergunta respondida sai da lista de pendentes", () => {
  const pendentes = obterPerguntasPendentes({ sonoOntem: "bom" });
  assert.equal(pendentes.some((q) => q.id === "sono"), false);
  assert.equal(pendentes.length, QUESTOES_DIARIAS.length - 1);
});

test("resposta false conta como respondida — não é a mesma coisa que não respondida", () => {
  const pendentes = obterPerguntasPendentes({ creatina: false, alcool: false });
  assert.equal(pendentes.some((q) => q.id === "creatina"), false);
  assert.equal(pendentes.some((q) => q.id === "alcool"), false);
});

test("todas respondidas devolve lista vazia", () => {
  const habitoCompleto = { sonoOntem: "bom", creatina: true, hidratacao: "clara", alcool: false };
  assert.deepEqual(obterPerguntasPendentes(habitoCompleto), []);
});

test("preserva a ordem definida em QUESTOES_DIARIAS", () => {
  const pendentes = obterPerguntasPendentes({ creatina: true });
  assert.deepEqual(pendentes.map((q) => q.id), ["sono", "hidratacao", "alcool"]);
});

test("cada questão tem pergunta, campo e ao menos 2 opções com valor e rótulo", () => {
  for (const q of QUESTOES_DIARIAS) {
    assert.ok(q.id);
    assert.ok(q.campo);
    assert.ok(q.pergunta);
    assert.ok(q.opcoes.length >= 2);
    for (const opcao of q.opcoes) {
      assert.ok("valor" in opcao);
      assert.ok(opcao.rotulo);
    }
  }
});
