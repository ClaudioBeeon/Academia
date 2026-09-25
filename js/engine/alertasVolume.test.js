import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarAlertasVolume } from "./alertasVolume.js";

const semDados = { seriesHoje: [], sessoesPorExercicio: [], hoje: "2026-08-20" };
const ses = (data, carga, reps) => ({ data, series: [{ carga, reps, tipoSerie: "normal" }] });

test("sem dados nenhum, nenhum alerta é gerado", () => {
  assert.deepEqual(avaliarAlertasVolume(semDados), []);
});

test("mais de 8 séries diretas do mesmo músculo hoje gera alerta de séries excessivas na sessão", () => {
  const seriesHoje = Array.from({ length: 9 }, () => ({ musculo: "quadriceps", tipoSerie: "normal" }));
  const alertas = avaliarAlertasVolume({ ...semDados, seriesHoje });
  assert.ok(alertas.some((a) => a.tipo === "series_excessivas_sessao" && a.musculo === "quadriceps"));
});

test("séries indiretas e de aquecimento não contam como diretas na sessão", () => {
  const seriesHoje = [
    ...Array.from({ length: 6 }, () => ({ musculo: "triceps", tipoSerie: "normal", direta: false })),
    ...Array.from({ length: 3 }, () => ({ musculo: "triceps", tipoSerie: "aquecimento" })),
    ...Array.from({ length: 3 }, () => ({ musculo: "triceps", tipoSerie: "normal" })),
  ];
  assert.deepEqual(avaliarAlertasVolume({ ...semDados, seriesHoje }), []);
});

test("8 séries diretas do mesmo músculo hoje não gera alerta (limite é 'mais de 8')", () => {
  const seriesHoje = Array.from({ length: 8 }, () => ({ musculo: "quadriceps", tipoSerie: "normal" }));
  assert.ok(!avaliarAlertasVolume({ ...semDados, seriesHoje }).some((a) => a.tipo === "series_excessivas_sessao"));
});

test("sem progresso de carga nem de reps em 28+ dias gera alerta", () => {
  const sessoesPorExercicio = [{ exercicioId: "a", sessoes: [ses("2026-08-20", 8, 12), ses("2026-07-20", 8, 12)] }];
  assert.ok(avaliarAlertasVolume({ ...semDados, sessoesPorExercicio }).some((a) => a.tipo === "sem_progressao_exercicio"));
});

test("mais reps com a mesma carga conta como progresso", () => {
  const sessoesPorExercicio = [{ exercicioId: "a", sessoes: [ses("2026-08-20", 8, 12), ses("2026-07-20", 8, 10)] }];
  assert.deepEqual(avaliarAlertasVolume({ ...semDados, sessoesPorExercicio }), []);
});

test("carga maior na sessão mais recente não gera alerta", () => {
  const sessoesPorExercicio = [{ exercicioId: "a", sessoes: [ses("2026-08-20", 12, 8), ses("2026-07-20", 10, 8)] }];
  assert.deepEqual(avaliarAlertasVolume({ ...semDados, sessoesPorExercicio }), []);
});

test("menos de 28 dias de histórico não gera alerta (dado insuficiente)", () => {
  const sessoesPorExercicio = [{ exercicioId: "a", sessoes: [ses("2026-08-20", 10, 8), ses("2026-08-10", 10, 8)] }];
  assert.deepEqual(avaliarAlertasVolume({ ...semDados, sessoesPorExercicio }), []);
});

test("série de aquecimento mais leve no começo não mascara nem inventa progresso", () => {
  const sessoesPorExercicio = [{ exercicioId: "a", sessoes: [
    { data: "2026-08-20", series: [{ carga: 5, reps: 12, tipoSerie: "aquecimento" }, { carga: 20, reps: 10, tipoSerie: "normal" }] },
    { data: "2026-07-20", series: [{ carga: 20, reps: 10, tipoSerie: "normal" }] },
  ] }];
  assert.ok(avaliarAlertasVolume({ ...semDados, sessoesPorExercicio }).some((a) => a.tipo === "sem_progressao_exercicio"));
});

test("exercício que saiu da ficha (última sessão há mais de 2 semanas) não gera alerta", () => {
  const sessoesPorExercicio = [{ exercicioId: "a", sessoes: [ses("2026-07-20", 8, 12), ses("2026-06-10", 8, 12)] }];
  assert.deepEqual(avaliarAlertasVolume({ ...semDados, sessoesPorExercicio }), []);
});
