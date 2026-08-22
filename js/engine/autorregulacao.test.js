import { test } from "node:test";
import assert from "node:assert/strict";
import { apontarCausaProvavelDesempenho, avaliarFatorCreatina } from "./autorregulacao.js";

test("aponta sono como causa provável quando sono ruim está na janela recente", () => {
  const resultado = apontarCausaProvavelDesempenho({
    habitosRecentes: [{ data: "2026-08-22", sonoOntem: "ruim" }],
    houveDeficitConsistente: true,
  });
  assert.equal(resultado.causa, "sono");
});

test("aponta álcool antes de déficit quando não há sono ruim", () => {
  const resultado = apontarCausaProvavelDesempenho({
    habitosRecentes: [{ data: "2026-08-22", sonoOntem: "bom", alcool: true }],
    houveDeficitConsistente: true,
  });
  assert.equal(resultado.causa, "alcool");
});

test("só aponta déficit quando não há sono ruim nem álcool na janela", () => {
  const resultado = apontarCausaProvavelDesempenho({
    habitosRecentes: [{ data: "2026-08-22", sonoOntem: "bom", alcool: false }],
    houveDeficitConsistente: true,
  });
  assert.equal(resultado.causa, "deficit");
});

test("retorna null quando nenhum fator está presente", () => {
  const resultado = apontarCausaProvavelDesempenho({
    habitosRecentes: [{ data: "2026-08-22", sonoOntem: "bom", alcool: false }],
    houveDeficitConsistente: false,
  });
  assert.equal(resultado, null);
});

test("ignora sono ruim fora da janela dos últimos 3 dias", () => {
  const resultado = apontarCausaProvavelDesempenho({
    habitosRecentes: [
      { data: "2026-08-22", sonoOntem: "bom" },
      { data: "2026-08-21", sonoOntem: "bom" },
      { data: "2026-08-20", sonoOntem: "bom" },
      { data: "2026-08-19", sonoOntem: "ruim" },
    ],
    houveDeficitConsistente: false,
  });
  assert.equal(resultado, null);
});

test("avaliarFatorCreatina retorna null sem estagnação de força", () => {
  const resultado = avaliarFatorCreatina({
    habitosRecentes: [{ creatina: false }, { creatina: false }, { creatina: false }],
    estagnacaoForca: false,
  });
  assert.equal(resultado, null);
});

test("avaliarFatorCreatina menciona creatina com 3+ dias sem registro e estagnação de força", () => {
  const resultado = avaliarFatorCreatina({
    habitosRecentes: [{ creatina: false }, { creatina: false }, { creatina: false }],
    estagnacaoForca: true,
  });
  assert.equal(resultado.causa, "creatina");
});

test("avaliarFatorCreatina não menciona com menos de 3 dias sem creatina", () => {
  const resultado = avaliarFatorCreatina({
    habitosRecentes: [{ creatina: false }, { creatina: true }, { creatina: true }],
    estagnacaoForca: true,
  });
  assert.equal(resultado, null);
});
