import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarPRs } from "./recordes.js";

test("primeira série do exercício retorna um PR de primeira vez", () => {
  const prs = detectarPRs({ carga: 14, reps: 10 }, []);
  assert.equal(prs.length, 1);
  assert.equal(prs[0].tipo, "primeira_serie");
});

test("detecta PR de carga quando supera o máximo anterior", () => {
  const prs = detectarPRs(
    { carga: 16, reps: 8 },
    [{ carga: 14, reps: 10 }, { carga: 15, reps: 8 }]
  );
  assert.ok(prs.some((p) => p.tipo === "carga"));
});

test("detecta PR de reps na mesma carga", () => {
  const prs = detectarPRs(
    { carga: 14, reps: 12 },
    [{ carga: 14, reps: 10 }]
  );
  assert.ok(prs.some((p) => p.tipo === "reps"));
});

test("não detecta PR de reps se a carga nunca foi usada antes", () => {
  const prs = detectarPRs(
    { carga: 20, reps: 5 },
    [{ carga: 14, reps: 10 }]
  );
  assert.ok(!prs.some((p) => p.tipo === "reps"));
});

test("detecta PR de volume mesmo sem bater carga ou reps isoladamente", () => {
  const prs = detectarPRs(
    { carga: 14, reps: 11 },
    [{ carga: 14, reps: 10 }, { carga: 16, reps: 8 }]
  );
  assert.ok(prs.some((p) => p.tipo === "volume"));
});

test("série pior que tudo anteriormente registrado não gera nenhum PR", () => {
  const prs = detectarPRs(
    { carga: 10, reps: 5 },
    [{ carga: 14, reps: 10 }]
  );
  assert.deepEqual(prs, []);
});

test("cada PR carrega principio e secao", () => {
  const prs = detectarPRs({ carga: 16, reps: 8 }, [{ carga: 14, reps: 10 }]);
  for (const pr of prs) {
    assert.ok(pr.principio);
    assert.ok(pr.secao);
  }
});

test("carga zero (isometria/peso corporal) só gera recorde de reps", () => {
  const prs = detectarPRs({ carga: 0, reps: 70 }, [{ carga: 0, reps: 60 }]);
  assert.deepEqual(prs.map((p) => p.tipo), ["reps"]);
});

test("série acima de 12 reps não gera recorde de 1RM estimado", () => {
  const prs = detectarPRs({ carga: 10, reps: 25 }, [{ carga: 20, reps: 10 }]);
  assert.equal(prs.some((p) => p.tipo === "1rm"), false);
});

test("listarRecordesPorExercicio junta maior carga, mais reps e melhor 1RM de cada exercício", async () => {
  const { listarRecordesPorExercicio } = await import("./recordes.js");
  const series = [
    { exercicioId: "supino", data: "2026-09-01", carga: 20, reps: 12, tipoSerie: "normal" },
    { exercicioId: "supino", data: "2026-09-08", carga: 24, reps: 8, tipoSerie: "normal" },
    { exercicioId: "supino", data: "2026-09-08", carga: 30, reps: 5, tipoSerie: "aquecimento" },
    { exercicioId: "supino", data: "2026-09-09", carga: 16, reps: 15, tipoSerie: "drop" },
    { exercicioId: "prancha", data: "2026-09-02", carga: 0, reps: 60, tipoSerie: "normal" },
  ];
  const [prancha, supino] = listarRecordesPorExercicio(series, [{ id: "supino", nome: "Supino" }, { id: "prancha", nome: "Prancha" }]);
  assert.deepEqual(supino.maiorCarga, { carga: 24, reps: 8, data: "2026-09-08" });
  assert.deepEqual(supino.maisReps, { reps: 12, carga: 20, data: "2026-09-01" });
  assert.equal(supino.melhor1RM.valor, 30.4);
  assert.equal(prancha.maiorCarga, null, "sem carga não tem recorde de carga");
  assert.equal(prancha.maisReps.reps, 60);
});
