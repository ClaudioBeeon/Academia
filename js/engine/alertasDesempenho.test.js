import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarAlertasDesempenho, avaliarSugestaoDeDeload } from "./alertasDesempenho.js";

const s = (carga, reps, rir = 2, extra = {}) => ({ carga, reps, rir, tipoSerie: "normal", ...extra });
const ses = (data, series) => ({ data, series });

test("array vazio não gera nenhum alerta", () => {
  assert.deepEqual(avaliarAlertasDesempenho([]), []);
});

test("menos de 3 sessões não gera alerta — uma queda isolada é ruído", () => {
  const r = avaliarAlertasDesempenho([{ exercicioId: "a", sessoes: [ses("d2", [s(20, 8)]), ses("d1", [s(20, 12)])] }]);
  assert.deepEqual(r, []);
});

test("capacidade (reps + RIR) caindo em 2 sessões seguidas com a mesma carga gera alerta", () => {
  const r = avaliarAlertasDesempenho([{ exercicioId: "a", sessoes: [
    ses("d3", [s(20, 8, 1), s(20, 8, 1)]),
    ses("d2", [s(20, 10, 1), s(20, 9, 1)]),
    ses("d1", [s(20, 12, 1), s(20, 11, 1)]),
  ] }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "desempenho_caindo");
});

test("RIR SUBINDO com a mesma carga e as mesmas reps não é fadiga (é progresso) — sem alerta", () => {
  const r = avaliarAlertasDesempenho([{ exercicioId: "a", sessoes: [
    ses("d3", [s(20, 10, 3)]),
    ses("d2", [s(20, 10, 2)]),
    ses("d1", [s(20, 10, 1)]),
  ] }]);
  assert.deepEqual(r, []);
});

test("RIR CAINDO com as mesmas reps e a mesma carga é fadiga — gera alerta", () => {
  const r = avaliarAlertasDesempenho([{ exercicioId: "a", sessoes: [
    ses("d3", [s(20, 10, 0)]),
    ses("d2", [s(20, 10, 1)]),
    ses("d1", [s(20, 10, 2)]),
  ] }]);
  assert.equal(r.length, 1);
});

test("carga diferente entre as sessões não gera alerta", () => {
  const r = avaliarAlertasDesempenho([{ exercicioId: "a", sessoes: [
    ses("d3", [s(22, 8)]), ses("d2", [s(20, 10)]), ses("d1", [s(20, 12)]),
  ] }]);
  assert.deepEqual(r, []);
});

test("sessão incompleta não gera falso alerta (média por série, não total)", () => {
  const r = avaliarAlertasDesempenho([{ exercicioId: "a", sessoes: [
    ses("d3", [s(20, 10)]),
    ses("d2", [s(20, 10), s(20, 10), s(20, 10)]),
    ses("d1", [s(20, 10), s(20, 10), s(20, 10)]),
  ] }]);
  assert.deepEqual(r, []);
});

test("sessões de deload e séries de aquecimento são ignoradas", () => {
  const r = avaliarAlertasDesempenho([{ exercicioId: "a", sessoes: [
    ses("deload", [s(20, 6, 4, { semanaBloco: 7 })]),
    ses("d2", [s(10, 15, 5, { tipoSerie: "aquecimento" }), s(20, 10)]),
    ses("d1", [s(20, 10)]),
  ] }]);
  assert.deepEqual(r, []);
});

test("sugestão de deload: 2+ exercícios caindo, dor articular ou bem-estar baixo", () => {
  assert.equal(avaliarSugestaoDeDeload().sugerir, false);
  const umSo = avaliarSugestaoDeDeload({ alertasDesempenho: [{ tipo: "desempenho_caindo", exercicioId: "a" }] });
  assert.equal(umSo.sugerir, false);
  assert.equal(umSo.fadigaDetectada, true, "1 exercício caindo já segura a série extra");
  const dois = avaliarSugestaoDeDeload({ alertasDesempenho: [
    { tipo: "desempenho_caindo", exercicioId: "a" }, { tipo: "desempenho_caindo", exercicioId: "b" },
  ] });
  assert.equal(dois.sugerir, true);
  assert.equal(avaliarSugestaoDeDeload({ alertasRecuperacao: [{ tipo: "dor_articular" }] }).sugerir, true);
});
