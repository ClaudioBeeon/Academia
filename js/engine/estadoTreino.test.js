import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparSessoesPorExercicio, avaliarEstadoDoTreino } from "./estadoTreino.js";

const s = (exercicioId, data, carga, reps, rir, extra = {}) => ({ exercicioId, data, carga, reps, rir, tipoSerie: "normal", ...extra });

test("agrupa por exercício e data, mais recente primeiro, sem hoje e sem aquecimento", () => {
  const r = agruparSessoesPorExercicio([
    s("a", "2026-09-01", 10, 10, 2),
    s("a", "2026-09-03", 10, 10, 2),
    s("a", "2026-09-03", 5, 10, 5, { tipoSerie: "aquecimento" }),
    s("a", "2026-09-05", 10, 10, 2),
  ], "2026-09-05");
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].sessoes.map((x) => x.data), ["2026-09-03", "2026-09-01"]);
  assert.equal(r[0].sessoes[0].series.length, 1);
});

test("queda em 2 exercícios vira sugestão de deload e marca fadiga", () => {
  const series = [];
  for (const id of ["a", "b"]) {
    series.push(s(id, "2026-09-01", 20, 12, 1), s(id, "2026-09-03", 20, 10, 1), s(id, "2026-09-05", 20, 8, 1));
  }
  const r = avaliarEstadoDoTreino({ todasAsSeries: series, hoje: "2026-09-07" });
  assert.equal(r.alertasDesempenho.length, 2);
  assert.equal(r.sugestaoDeload.sugerir, true);
  assert.equal(r.fadigaDetectada, true);
});

test("sem dados, sem alertas nem sugestão", () => {
  const r = avaliarEstadoDoTreino({ hoje: "2026-09-07" });
  assert.equal(r.sugestaoDeload.sugerir, false);
  assert.equal(r.fadigaDetectada, false);
});
