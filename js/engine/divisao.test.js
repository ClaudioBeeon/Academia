import { test } from "node:test";
import assert from "node:assert/strict";
import { GRUPO_POR_MUSCULO, obterGrupoDoMusculo, determinarProximoGrupo } from "./divisao.js";

test("GRUPO_POR_MUSCULO mapeia todos os 10 músculos semeados", () => {
  assert.equal(GRUPO_POR_MUSCULO.peito, "superior");
  assert.equal(GRUPO_POR_MUSCULO.costas, "superior");
  assert.equal(GRUPO_POR_MUSCULO.ombro, "superior");
  assert.equal(GRUPO_POR_MUSCULO.biceps, "superior");
  assert.equal(GRUPO_POR_MUSCULO.triceps, "superior");
  assert.equal(GRUPO_POR_MUSCULO.abdomen, "superior");
  assert.equal(GRUPO_POR_MUSCULO.quadriceps, "inferior");
  assert.equal(GRUPO_POR_MUSCULO.posterior_coxa, "inferior");
  assert.equal(GRUPO_POR_MUSCULO.gluteo, "inferior");
  assert.equal(GRUPO_POR_MUSCULO.panturrilha, "inferior");
});

test("obterGrupoDoMusculo retorna o grupo para músculos mapeados", () => {
  assert.equal(obterGrupoDoMusculo("peito"), "superior");
  assert.equal(obterGrupoDoMusculo("quadriceps"), "inferior");
});

test("obterGrupoDoMusculo retorna null para músculo não mapeado, sem lançar erro", () => {
  assert.equal(obterGrupoDoMusculo("core_customizado"), null);
});

test("determinarProximoGrupo retorna superior quando não há série anterior", () => {
  assert.equal(determinarProximoGrupo(null), "superior");
  assert.equal(determinarProximoGrupo(undefined), "superior");
});

test("determinarProximoGrupo alterna com base no músculo da última série", () => {
  assert.equal(determinarProximoGrupo({ musculo: "peito" }), "inferior");
  assert.equal(determinarProximoGrupo({ musculo: "quadriceps" }), "superior");
});

test("determinarProximoGrupo cai em superior quando a última série tem músculo não mapeado", () => {
  assert.equal(determinarProximoGrupo({ musculo: "core_customizado" }), "superior");
});
