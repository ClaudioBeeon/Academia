import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularReadiness } from "./readiness.js";

const TUDO_EM_DIA = {
  sonoOntem: "bom", alcoolOntem: false, sequenciaDias: 5,
  creatinaHoje: true, proteinaAbaixoDaMeta: false, treinouHoje: true,
};

test("calcularReadiness retorna 100/ótimo quando tudo já foi feito e nenhum fator negativo", () => {
  const r = calcularReadiness(TUDO_EM_DIA);
  assert.equal(r.score, 100);
  assert.equal(r.categoria, "otimo");
  assert.deepEqual(r.fatores, []);
});

test("calcularReadiness desconta por creatina ainda não marcada hoje", () => {
  const r = calcularReadiness({ ...TUDO_EM_DIA, creatinaHoje: false });
  assert.ok(r.score < 100);
  assert.ok(r.fatores.some((f) => f.includes("Creatina")));
});

test("calcularReadiness desconta por creatina nunca perguntada (null) igual a não marcada", () => {
  const r1 = calcularReadiness({ ...TUDO_EM_DIA, creatinaHoje: null });
  const r2 = calcularReadiness({ ...TUDO_EM_DIA, creatinaHoje: false });
  assert.equal(r1.score, r2.score);
});

test("calcularReadiness desconta por proteína abaixo da meta", () => {
  const r = calcularReadiness({ ...TUDO_EM_DIA, proteinaAbaixoDaMeta: true });
  assert.ok(r.score < 100);
  assert.ok(r.fatores.some((f) => f.includes("Proteína")));
});

test("calcularReadiness desconta por ainda não ter treinado hoje", () => {
  const r = calcularReadiness({ ...TUDO_EM_DIA, treinouHoje: false });
  assert.ok(r.score < 100);
  assert.ok(r.fatores.some((f) => f.includes("treinou")));
});

test("calcularReadiness desconta mais por sono ruim que por sono médio", () => {
  const ruim = calcularReadiness({ ...TUDO_EM_DIA, sonoOntem: "ruim" });
  const medio = calcularReadiness({ ...TUDO_EM_DIA, sonoOntem: "medio" });
  assert.ok(ruim.score < medio.score);
});

test("calcularReadiness soma vários fatores negativos ao mesmo tempo", () => {
  const r = calcularReadiness({
    sonoOntem: "ruim", alcoolOntem: true, sequenciaDias: 0,
    creatinaHoje: false, proteinaAbaixoDaMeta: true, treinouHoje: false,
  });
  assert.equal(r.score, 100 - 30 - 18 - 12 - 10 - 10 - 8);
  assert.equal(r.fatores.length, 6);
});

test("calcularReadiness nunca fica negativo mesmo empilhando todos os fatores", () => {
  const r = calcularReadiness({
    sonoOntem: "ruim", alcoolOntem: true, sequenciaDias: 0,
    creatinaHoje: false, proteinaAbaixoDaMeta: true, treinouHoje: false,
  });
  assert.ok(r.score >= 0);
});

test("calcularReadiness sem nenhum argumento (todos os padrões) já reflete nada feito ainda", () => {
  const r = calcularReadiness();
  assert.ok(r.score < 100);
  assert.ok(r.fatores.includes("Creatina ainda não marcada hoje"));
  assert.ok(r.fatores.includes("Ainda não treinou hoje"));
});

test("calcularReadiness categoriza corretamente nas quatro faixas", () => {
  assert.equal(calcularReadiness(TUDO_EM_DIA).categoria, "otimo");
  assert.equal(calcularReadiness({ ...TUDO_EM_DIA, sonoOntem: "ruim" }).categoria, "bom");
  assert.equal(calcularReadiness({ ...TUDO_EM_DIA, sonoOntem: "ruim", alcoolOntem: true }).categoria, "atencao");
  assert.equal(
    calcularReadiness({
      sonoOntem: "ruim", alcoolOntem: true, sequenciaDias: 0,
      creatinaHoje: false, proteinaAbaixoDaMeta: true, treinouHoje: false,
    }).categoria,
    "baixo"
  );
});
