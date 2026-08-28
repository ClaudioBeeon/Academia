import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularSequenciaDias } from "./consistencia.js";

test("sem nenhuma atividade, sequência é 0", () => {
  assert.equal(calcularSequenciaDias([], "2026-08-28"), 0);
});

test("hoje com atividade conta hoje e volta contando os dias anteriores seguidos", () => {
  const datas = ["2026-08-26", "2026-08-27", "2026-08-28"];
  assert.equal(calcularSequenciaDias(datas, "2026-08-28"), 3);
});

test("hoje sem atividade ainda não quebra a sequência — conta a partir de ontem", () => {
  const datas = ["2026-08-25", "2026-08-26", "2026-08-27"];
  assert.equal(calcularSequenciaDias(datas, "2026-08-28"), 3);
});

test("um buraco no meio interrompe a contagem", () => {
  const datas = ["2026-08-20", "2026-08-26", "2026-08-27", "2026-08-28"];
  assert.equal(calcularSequenciaDias(datas, "2026-08-28"), 3);
});

test("ontem sem atividade e hoje também sem: sequência 0", () => {
  const datas = ["2026-08-20"];
  assert.equal(calcularSequenciaDias(datas, "2026-08-28"), 0);
});
