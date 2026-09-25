import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularSemanaVolei, sortearAlvo, taxaDeAcerto, serieDoTeste } from "./volei.js";

test("semana do programa: 7 dias por semana, trava na 6 e marca concluído", () => {
  assert.deepEqual(calcularSemanaVolei(null, "2026-09-24"), { semana: 1, concluido: false });
  assert.deepEqual(calcularSemanaVolei("2026-09-24", "2026-09-30"), { semana: 1, concluido: false });
  assert.deepEqual(calcularSemanaVolei("2026-09-24", "2026-10-01"), { semana: 2, concluido: false });
  assert.deepEqual(calcularSemanaVolei("2026-09-24", "2026-11-04"), { semana: 6, concluido: false });
  assert.deepEqual(calcularSemanaVolei("2026-09-24", "2026-11-05"), { semana: 6, concluido: true });
});

test("sorteio fica mais variado com as semanas", () => {
  const sempreUltimo = () => 0.99;
  const s2 = sortearAlvo(2, sempreUltimo);
  assert.equal(s2.altura, "alto (2,6 m)");
  assert.equal(s2.distancia, "perto (2,5 m)", "semana 2: distância fixa");
  assert.equal(s2.tipo, "de frente");
  const s4 = sortearAlvo(4, sempreUltimo);
  assert.equal(s4.distancia, "longe (3,5 m)");
  assert.equal(s4.tipo, "de costas", "a partir da semana 4 sorteia costas");
});

test("taxa de acerto em %", () => {
  assert.equal(taxaDeAcerto(14, 20), 70);
  assert.equal(taxaDeAcerto(25, 20), 100, "nunca passa de 100%");
  assert.equal(taxaDeAcerto(5, 0), null);
});

test("série de um teste ordenada por data, ignorando sessões sem ele", () => {
  const r = serieDoTeste([
    { data: "2026-10-20", testes: { T1: 40 } },
    { data: "2026-09-24", testes: { T1: 31, T2: 20 } },
    { data: "2026-10-01", testes: {} },
  ], "T1");
  assert.deepEqual(r, [{ data: "2026-09-24", valor: 31 }, { data: "2026-10-20", valor: 40 }]);
});
