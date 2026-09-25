import { test } from "node:test";
import assert from "node:assert/strict";
import { musculosTreinadosRecentemente } from "./recuperacaoMuscular.js";

const catalogo = [
  { id: "cruc", musculoPrimario: "peito", musculosSecundarios: [] },
  { id: "remada", musculoPrimario: "costas", musculosSecundarios: [{ musculo: "biceps", contribuicao: 0.5 }] },
];
const serie = (exercicioId, data, extra = {}) => ({ exercicioId, data, tipoSerie: "normal", ...extra });

test("avisa quando um músculo de hoje teve 3+ séries diretas ontem", () => {
  const todasAsSeries = [1, 2, 3, 4, 5].map(() => serie("cruc", "2026-09-23"));
  const r = musculosTreinadosRecentemente({ todasAsSeries, catalogo, hoje: "2026-09-24", musculosDeHoje: ["peito", "costas"] });
  assert.deepEqual(r, [{ musculo: "peito", series: 5, data: "2026-09-23" }]);
});

test("anteontem já passou das 36 h (sem horário gravado) — não avisa", () => {
  const todasAsSeries = [1, 2, 3].map(() => serie("cruc", "2026-09-22"));
  assert.deepEqual(musculosTreinadosRecentemente({ todasAsSeries, catalogo, hoje: "2026-09-24", musculosDeHoje: ["peito"] }), []);
});

test("com horário gravado usa as 36 h de verdade", () => {
  const agoraMs = Date.parse("2026-09-24T20:00:00");
  const ontemCedo = Date.parse("2026-09-23T07:00:00"); // 37 h antes
  const todasAsSeries = [1, 2, 3].map(() => serie("cruc", "2026-09-23", { registradaEm: ontemCedo }));
  assert.deepEqual(musculosTreinadosRecentemente({ todasAsSeries, catalogo, hoje: "2026-09-24", agoraMs, musculosDeHoje: ["peito"] }), []);
});

test("séries indiretas não disparam o aviso (remada não conta como bíceps direto)", () => {
  const todasAsSeries = [1, 2, 3, 4].map(() => serie("remada", "2026-09-23"));
  assert.deepEqual(musculosTreinadosRecentemente({ todasAsSeries, catalogo, hoje: "2026-09-24", musculosDeHoje: ["biceps"] }), []);
});

test("músculo que não está no dia de hoje é ignorado", () => {
  const todasAsSeries = [1, 2, 3].map(() => serie("cruc", "2026-09-23"));
  assert.deepEqual(musculosTreinadosRecentemente({ todasAsSeries, catalogo, hoje: "2026-09-24", musculosDeHoje: ["quadriceps"] }), []);
});
