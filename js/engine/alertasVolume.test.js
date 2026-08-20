import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarAlertasVolume } from "./alertasVolume.js";

const semDados = {
  seriesUltimos7Dias: [],
  seriesHoje: [],
  sessoesPorExercicio: [],
  musculosComDesempenhoCaindo: new Set(),
  hoje: "2026-08-20",
};

test("sem dados nenhum, nenhum alerta é gerado", () => {
  assert.deepEqual(avaliarAlertasVolume(semDados), []);
});

test("músculo com menos de 4 séries diretas na semana gera alerta de volume abaixo do mínimo", () => {
  const series = [
    { musculo: "peito", tipoSerie: "normal" },
    { musculo: "peito", tipoSerie: "normal" },
  ];
  const alertas = avaliarAlertasVolume({ ...semDados, seriesUltimos7Dias: series });
  assert.ok(alertas.some((a) => a.tipo === "volume_abaixo_minimo" && a.musculo === "peito"));
});

test("músculo com 4+ séries diretas na semana não gera alerta de volume abaixo do mínimo", () => {
  const series = Array.from({ length: 4 }, () => ({ musculo: "peito", tipoSerie: "normal" }));
  const alertas = avaliarAlertasVolume({ ...semDados, seriesUltimos7Dias: series });
  assert.ok(!alertas.some((a) => a.tipo === "volume_abaixo_minimo"));
});

test("séries de aquecimento não contam pro volume semanal (não reduzem a contagem de séries diretas)", () => {
  const series = [
    { musculo: "peito", tipoSerie: "aquecimento" },
    { musculo: "peito", tipoSerie: "normal" },
    { musculo: "peito", tipoSerie: "normal" },
    { musculo: "peito", tipoSerie: "normal" },
    { musculo: "peito", tipoSerie: "normal" },
  ];
  const alertas = avaliarAlertasVolume({ ...semDados, seriesUltimos7Dias: series });
  assert.ok(!alertas.some((a) => a.tipo === "volume_abaixo_minimo" && a.musculo === "peito"));
});

test("músculo com mais de 22 séries na semana E desempenho caindo gera alerta de volume excessivo", () => {
  const series = Array.from({ length: 23 }, () => ({ musculo: "costas", tipoSerie: "normal" }));
  const alertas = avaliarAlertasVolume({
    ...semDados,
    seriesUltimos7Dias: series,
    musculosComDesempenhoCaindo: new Set(["costas"]),
  });
  assert.ok(alertas.some((a) => a.tipo === "volume_excessivo_com_queda" && a.musculo === "costas"));
});

test("mais de 22 séries na semana SEM desempenho caindo não gera alerta de volume excessivo", () => {
  const series = Array.from({ length: 23 }, () => ({ musculo: "costas", tipoSerie: "normal" }));
  const alertas = avaliarAlertasVolume({ ...semDados, seriesUltimos7Dias: series });
  assert.ok(!alertas.some((a) => a.tipo === "volume_excessivo_com_queda"));
});

test("mais de 8 séries diretas do mesmo músculo hoje gera alerta de séries excessivas na sessão", () => {
  const seriesHoje = Array.from({ length: 9 }, () => ({ musculo: "quadriceps", tipoSerie: "normal" }));
  const alertas = avaliarAlertasVolume({ ...semDados, seriesHoje });
  assert.ok(alertas.some((a) => a.tipo === "series_excessivas_sessao" && a.musculo === "quadriceps"));
});

test("8 séries diretas do mesmo músculo hoje não gera alerta (limite é 'mais de 8')", () => {
  const seriesHoje = Array.from({ length: 8 }, () => ({ musculo: "quadriceps", tipoSerie: "normal" }));
  const alertas = avaliarAlertasVolume({ ...semDados, seriesHoje });
  assert.ok(!alertas.some((a) => a.tipo === "series_excessivas_sessao"));
});

test("exercício sem progressão em 28+ dias, carga não subiu, gera alerta", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 10 }] },
        { data: "2026-07-20", series: [{ carga: 10 }] },
      ],
    },
  ];
  const alertas = avaliarAlertasVolume({ ...semDados, sessoesPorExercicio });
  assert.ok(alertas.some((a) => a.tipo === "sem_progressao_exercicio" && a.exercicioId === "a"));
});

test("exercício com carga maior na sessão mais recente não gera alerta de ausência de progressão", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 12 }] },
        { data: "2026-07-20", series: [{ carga: 10 }] },
      ],
    },
  ];
  const alertas = avaliarAlertasVolume({ ...semDados, sessoesPorExercicio });
  assert.ok(!alertas.some((a) => a.tipo === "sem_progressao_exercicio"));
});

test("menos de 28 dias de histórico não gera alerta de ausência de progressão (dado insuficiente)", () => {
  const sessoesPorExercicio = [
    {
      exercicioId: "a",
      sessoes: [
        { data: "2026-08-20", series: [{ carga: 10 }] },
        { data: "2026-08-10", series: [{ carga: 10 }] },
      ],
    },
  ];
  const alertas = avaliarAlertasVolume({ ...semDados, sessoesPorExercicio });
  assert.ok(!alertas.some((a) => a.tipo === "sem_progressao_exercicio"));
});
