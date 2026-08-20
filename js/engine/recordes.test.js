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
