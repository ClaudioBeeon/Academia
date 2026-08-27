import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTOES_DIARIAS, obterPerguntasPendentes, obterPerguntasCheckinPendentes, QUESTOES_CHECKIN } from "./perguntasDiarias.js";

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
  const habitoCompleto = { sonoOntem: "bom", creatina: true, hidratacao: "clara", hidratacaoRespondidaEm: Date.now(), alcool: false };
  assert.deepEqual(obterPerguntasPendentes(habitoCompleto), []);
});

test("hidratação tem recorrência: some da lista de pendentes por 3h, depois volta", () => {
  const agora = Date.now();
  const habito = { sonoOntem: "bom", creatina: true, alcool: false, hidratacao: "clara", hidratacaoRespondidaEm: agora - 2 * 60 * 60 * 1000 };
  assert.equal(obterPerguntasPendentes(habito, QUESTOES_DIARIAS, agora).length, 0);

  const habitoVencido = { ...habito, hidratacaoRespondidaEm: agora - 4 * 60 * 60 * 1000 };
  const pendentes = obterPerguntasPendentes(habitoVencido, QUESTOES_DIARIAS, agora);
  assert.deepEqual(pendentes.map((q) => q.id), ["hidratacao"]);
});

test("hidratação sem hidratacaoRespondidaEm fica pendente mesmo com um valor antigo salvo", () => {
  const pendentes = obterPerguntasPendentes({ hidratacao: "clara" });
  assert.ok(pendentes.some((q) => q.id === "hidratacao"));
});

test("obterPerguntasCheckinPendentes: sem treinar hoje, nenhuma pergunta de sessão entra na fila", () => {
  assert.deepEqual(obterPerguntasCheckinPendentes(undefined, false), []);
  assert.deepEqual(obterPerguntasCheckinPendentes({}, false), []);
});

test("obterPerguntasCheckinPendentes: já treinou hoje e ainda não respondeu, entram as 4", () => {
  assert.deepEqual(obterPerguntasCheckinPendentes(undefined, true), QUESTOES_CHECKIN);
});

test("obterPerguntasCheckinPendentes: já treinou e já respondeu hoje, lista vazia", () => {
  assert.deepEqual(obterPerguntasCheckinPendentes({ qualidadePercebida: 4 }, true), []);
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
