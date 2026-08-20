import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarAlertasRecuperacao } from "./alertasRecuperacao.js";

test("array vazio não gera nenhum alerta", () => {
  assert.deepEqual(avaliarAlertasRecuperacao([]), []);
});

test("dor articular/tendínea no check-in mais recente gera alerta", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 4, bemEstarBaixo: false, dorArticularOuTendinea: true, domsPersistente: false }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].tipo, "dor_articular");
});

test("DOMS persistente no check-in mais recente gera alerta", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 4, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: true }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].tipo, "doms_persistente");
});

test("bem-estar baixo em 3 check-ins consecutivos mais recentes gera alerta", () => {
  const base = { qualidadePercebida: 3, dorArticularOuTendinea: false, domsPersistente: false };
  const checkins = [
    { ...base, data: "2026-08-20", bemEstarBaixo: true },
    { ...base, data: "2026-08-19", bemEstarBaixo: true },
    { ...base, data: "2026-08-18", bemEstarBaixo: true },
  ];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(alertas.some((a) => a.tipo === "bem_estar_baixo_sustentado"));
});

test("bem-estar baixo em só 2 dos 3 mais recentes NÃO gera alerta de sustentado", () => {
  const base = { qualidadePercebida: 3, dorArticularOuTendinea: false, domsPersistente: false };
  const checkins = [
    { ...base, data: "2026-08-20", bemEstarBaixo: true },
    { ...base, data: "2026-08-19", bemEstarBaixo: false },
    { ...base, data: "2026-08-18", bemEstarBaixo: true },
  ];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(!alertas.some((a) => a.tipo === "bem_estar_baixo_sustentado"));
});

test("qualidade percebida <= 2 em 2 sessões consecutivas mais recentes gera alerta", () => {
  const base = { bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false };
  const checkins = [
    { ...base, data: "2026-08-20", qualidadePercebida: 2 },
    { ...base, data: "2026-08-19", qualidadePercebida: 1 },
  ];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(alertas.some((a) => a.tipo === "qualidade_baixa_sequencia"));
});

test("qualidade percebida <= 2 em só 1 sessão não gera alerta de sequência", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 2, bemEstarBaixo: false, dorArticularOuTendinea: false, domsPersistente: false }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.ok(!alertas.some((a) => a.tipo === "qualidade_baixa_sequencia"));
});

test("múltiplas condições simultâneas geram múltiplos alertas", () => {
  const checkins = [{ data: "2026-08-20", qualidadePercebida: 3, bemEstarBaixo: false, dorArticularOuTendinea: true, domsPersistente: true }];
  const alertas = avaliarAlertasRecuperacao(checkins);
  assert.equal(alertas.length, 2);
});
