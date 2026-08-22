import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDataReavaliacaoSugerida, devePedirReavaliacaoFase, deveLembrarFotosMedidas, deveLembrarCreatina } from "./lembretes.js";

test("calcularDataReavaliacaoSugerida soma 7 semanas à data de início da fase", () => {
  assert.equal(calcularDataReavaliacaoSugerida("2026-08-19"), "2026-10-07");
});

test("devePedirReavaliacaoFase retorna false sem data definida", () => {
  assert.equal(devePedirReavaliacaoFase(undefined, "2026-08-22"), false);
});

test("devePedirReavaliacaoFase retorna false antes da data", () => {
  assert.equal(devePedirReavaliacaoFase("2026-10-07", "2026-09-01"), false);
});

test("devePedirReavaliacaoFase retorna true na data ou depois", () => {
  assert.equal(devePedirReavaliacaoFase("2026-10-07", "2026-10-07"), true);
  assert.equal(devePedirReavaliacaoFase("2026-10-07", "2026-10-20"), true);
});

test("deveLembrarFotosMedidas retorna true quando nunca houve registro", () => {
  assert.equal(deveLembrarFotosMedidas(undefined, "2026-08-22"), true);
});

test("deveLembrarFotosMedidas retorna false dentro do intervalo de 14 dias", () => {
  assert.equal(deveLembrarFotosMedidas("2026-08-15", "2026-08-22"), false);
});

test("deveLembrarFotosMedidas retorna true a partir de 14 dias", () => {
  assert.equal(deveLembrarFotosMedidas("2026-08-08", "2026-08-22"), true);
});

test("deveLembrarCreatina retorna true sem hábito registrado hoje", () => {
  assert.equal(deveLembrarCreatina(undefined), true);
});

test("deveLembrarCreatina retorna false quando já marcado", () => {
  assert.equal(deveLembrarCreatina({ creatina: true }), false);
});

test("deveLembrarCreatina retorna true quando explicitamente marcado como não tomada", () => {
  assert.equal(deveLembrarCreatina({ creatina: false }), true);
});
