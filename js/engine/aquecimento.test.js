import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarEscadaAquecimento } from "./aquecimento.js";

test("gera a escada padrão (barra, 50%, 65%, 80%) para um peso de trabalho alto", () => {
  const escada = gerarEscadaAquecimento(60, 20);
  assert.equal(escada.length, 4);
  assert.equal(escada[0].peso, 20);
  assert.equal(escada[1].peso, 30);
  assert.equal(escada[2].peso, 39);
  assert.equal(escada[3].peso, 48);
});

test("arredonda cada passo para o meio quilo mais próximo", () => {
  const escada = gerarEscadaAquecimento(37, 20);
  for (const passo of escada) {
    assert.equal(passo.peso, Math.round(passo.peso * 2) / 2);
  }
});

test("descarta passos abaixo do peso da barra", () => {
  const escada = gerarEscadaAquecimento(22, 20);
  for (const passo of escada) {
    assert.ok(passo.peso >= 20);
  }
});

test("reps diminuem ao longo da escada", () => {
  const escada = gerarEscadaAquecimento(60, 20);
  for (let i = 1; i < escada.length; i++) {
    assert.ok(escada[i].reps <= escada[i - 1].reps);
  }
});

test("gerarAquecimentoComposto: 50% × 8 e 70% × 4, no incremento do exercício", async () => {
  const { gerarAquecimentoComposto } = await import("./aquecimento.js");
  assert.deepEqual(gerarAquecimentoComposto(40, 2.5), [
    { percentual: 50, peso: 20, reps: 8 },
    { percentual: 70, peso: 27.5, reps: 4 },
  ]);
});

test("gerarAquecimentoComposto descarta passos repetidos, zerados ou iguais à carga de trabalho", async () => {
  const { gerarAquecimentoComposto } = await import("./aquecimento.js");
  assert.deepEqual(gerarAquecimentoComposto(2, 2), []);
  assert.deepEqual(gerarAquecimentoComposto(0, 2), []);
});

test("precisaDeAquecimento: compostos e máquinas multiarticulares sim, isoladores não", async () => {
  const { precisaDeAquecimento } = await import("./aquecimento.js");
  assert.equal(precisaDeAquecimento({ tipo: "composto_moderado" }), true);
  assert.equal(precisaDeAquecimento({ tipo: "maquina", musculosSecundarios: [{ musculo: "triceps" }] }), true);
  assert.equal(precisaDeAquecimento({ tipo: "maquina", musculosSecundarios: [] }), false);
  assert.equal(precisaDeAquecimento({ tipo: "isolador" }), false);
});
