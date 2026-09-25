import { test } from "node:test";
import assert from "node:assert/strict";
import { resumirSemana } from "./resumoSemana.js";

const catalogo = [
  { id: "supino", nome: "Supino", musculoPrimario: "peito" },
  { id: "rosca", nome: "Rosca", musculoPrimario: "biceps" },
];
const s = (exercicioId, data, carga, extra = {}) => ({ exercicioId, data, carga, reps: 10, tipoSerie: "normal", ...extra });

test("compara a semana com a anterior e lista o que subiu de carga", () => {
  const r = resumirSemana({
    todasAsSeries: [
      s("supino", "2026-09-12", 20), s("supino", "2026-09-12", 20),
      s("supino", "2026-09-20", 22), s("supino", "2026-09-22", 22), s("supino", "2026-09-22", 5, { tipoSerie: "aquecimento" }),
    ],
    catalogo, musculosDaFicha: ["peito", "biceps"], hoje: "2026-09-24",
  });
  assert.equal(r.treinos, 2);
  assert.equal(r.treinosAnterior, 1);
  assert.equal(r.series, 2, "o aquecimento não conta");
  assert.deepEqual(r.subiram, [{ nome: "Supino", de: 20, para: 22 }]);
  assert.equal(r.recordes, 1);
  assert.deepEqual(r.semTreinoDireto, ["biceps"]);
});

test("exercício feito pela primeira vez não conta como 'subiu' nem recorde", () => {
  const r = resumirSemana({ todasAsSeries: [s("rosca", "2026-09-23", 12)], catalogo, hoje: "2026-09-24" });
  assert.deepEqual(r.subiram, []);
  assert.equal(r.recordes, 0);
});
