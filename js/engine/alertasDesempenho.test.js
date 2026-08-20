import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarAlertasDesempenho } from "./alertasDesempenho.js";

test("array vazio não gera nenhum alerta", () => {
  assert.deepEqual(avaliarAlertasDesempenho([]), []);
});

test("exercício com só 1 sessão não gera alerta (sem sessão anterior pra comparar)", () => {
  const sessoesPorExercicio = [
    { exercicioId: "a", sessoes: [{ data: "2026-08-20", series: [{ carga: 10, reps: 10, rir: 2 }] }] },
  ];
  assert.deepEqual(avaliarAlertasDesempenho(sessoesPorExercicio), []);
});

test("mesmo peso e reps caindo gera alerta de desempenho caindo", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 10, reps: 8, rir: 2 }] },
        { data: "2026-08-13", series: [{ carga: 10, reps: 10, rir: 2 }] },
      ],
    },
  ];
  const alertas = avaliarAlertasDesempenho(sessoesPorExercicio);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].tipo, "desempenho_caindo");
  assert.equal(alertas[0].exercicioId, "a");
});

test("mesmo peso e RIR subindo gera alerta de RIR subindo sem carga", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 10, reps: 10, rir: 4 }] },
        { data: "2026-08-13", series: [{ carga: 10, reps: 10, rir: 2 }] },
      ],
    },
  ];
  const alertas = avaliarAlertasDesempenho(sessoesPorExercicio);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].tipo, "rir_subindo_sem_carga");
});

test("peso diferente entre as sessões não gera nenhum alerta, mesmo com reps caindo", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 8, reps: 8, rir: 2 }] },
        { data: "2026-08-13", series: [{ carga: 10, reps: 10, rir: 2 }] },
      ],
    },
  ];
  assert.deepEqual(avaliarAlertasDesempenho(sessoesPorExercicio), []);
});

test("mesmo peso, reps e RIR estáveis não gera alerta", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 10, reps: 10, rir: 2 }] },
        { data: "2026-08-13", series: [{ carga: 10, reps: 10, rir: 2 }] },
      ],
    },
  ];
  assert.deepEqual(avaliarAlertasDesempenho(sessoesPorExercicio), []);
});

test("múltiplos exercícios são avaliados independentemente", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 10, reps: 8, rir: 2 }] },
        { data: "2026-08-13", series: [{ carga: 10, reps: 10, rir: 2 }] },
      ],
    },
    {
      exercicioId: "b",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 20, reps: 10, rir: 2 }] },
        { data: "2026-08-13", series: [{ carga: 20, reps: 10, rir: 2 }] },
      ],
    },
  ];
  const alertas = avaliarAlertasDesempenho(sessoesPorExercicio);
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].exercicioId, "a");
});
