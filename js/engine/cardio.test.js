import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarCardio } from "./cardio.js";

test("nenhum alerta quando tudo está dentro dos limites", () => {
  const alertas = avaliarCardio({ modalidade: "caminhada", intensidadePercebida: 1, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 1 });
  assert.deepEqual(alertas, []);
});

test("corrida em dia de pernas sempre alerta, mesmo com intensidade baixa", () => {
  const alertas = avaliarCardio({ modalidade: "corrida", intensidadePercebida: 1, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(alertas.some((a) => a.tipo === "modalidade_nao_recomendada"));
});

test("corrida fora de dia de pernas não alerta por modalidade", () => {
  const alertas = avaliarCardio({ modalidade: "corrida", intensidadePercebida: 1, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(!alertas.some((a) => a.tipo === "modalidade_nao_recomendada"));
});

test("bicicleta intensa (>=3) em dia de pernas alerta por intensidade", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 3, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(alertas.some((a) => a.tipo === "intenso_dia_pernas"));
});

test("bicicleta leve (<3) em dia de pernas não alerta por intensidade", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 2, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 1 });
  assert.ok(!alertas.some((a) => a.tipo === "intenso_dia_pernas"));
});

test("5 ou mais sessões intensas em 7 dias alerta por frequência", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 3, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 5 });
  assert.ok(alertas.some((a) => a.tipo === "frequencia_alta"));
});

test("4 sessões intensas em 7 dias não alerta por frequência (ainda dentro da faixa recomendada)", () => {
  const alertas = avaliarCardio({ modalidade: "bicicleta", intensidadePercebida: 3, ehDiaDePernas: false, cardiosIntensosUltimos7Dias: 4 });
  assert.ok(!alertas.some((a) => a.tipo === "frequencia_alta"));
});

test("múltiplos alertas podem disparar juntos", () => {
  const alertas = avaliarCardio({ modalidade: "corrida", intensidadePercebida: 4, ehDiaDePernas: true, cardiosIntensosUltimos7Dias: 5 });
  assert.equal(alertas.length, 2);
  assert.ok(alertas.some((a) => a.tipo === "modalidade_nao_recomendada"));
  assert.ok(alertas.some((a) => a.tipo === "frequencia_alta"));
});
