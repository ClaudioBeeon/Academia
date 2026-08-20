// js/engine/substituicao.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sugerirSubstitutos } from "./substituicao.js";

const exercicios = [
  { id: "supino_inclinado_halteres", musculoPrimario: "peito", tipo: "composto_moderado" },
  { id: "supino_reto_maquina", musculoPrimario: "peito", tipo: "maquina" },
  { id: "crucifixo_cabo_cross", musculoPrimario: "peito", tipo: "isolador" },
  { id: "rosca_direta_barra_w", musculoPrimario: "biceps", tipo: "isolador" },
  { id: "outro_isolador_peito", musculoPrimario: "peito", tipo: "isolador" },
];

test("retorna alternativas do mesmo músculo e tipo, excluindo o próprio exercício", () => {
  const resultado = sugerirSubstitutos("crucifixo_cabo_cross", exercicios);
  const ids = resultado.map((e) => e.id);
  assert.ok(!ids.includes("crucifixo_cabo_cross"));
  assert.ok(ids.includes("outro_isolador_peito"));
  assert.ok(!ids.includes("rosca_direta_barra_w"));
});

test("respeita o limite informado", () => {
  const resultado = sugerirSubstitutos("crucifixo_cabo_cross", exercicios, 1);
  assert.equal(resultado.length, 1);
});

test("exercício inexistente retorna lista vazia", () => {
  const resultado = sugerirSubstitutos("nao_existe", exercicios);
  assert.deepEqual(resultado, []);
});

test("inclui alternativas do mesmo músculo mesmo com tipo diferente (sem dado de padrão de movimento ainda)", () => {
  const resultado = sugerirSubstitutos("supino_inclinado_halteres", exercicios);
  const ids = resultado.map((e) => e.id);
  assert.ok(ids.includes("supino_reto_maquina"));
});
