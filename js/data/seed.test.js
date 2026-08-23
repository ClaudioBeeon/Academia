import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, put, getAll } from "./db.js";
import { seedIfNeeded } from "./seed.js";

function fakeFetch(routes) {
  return async (url) => {
    const body = routes[url];
    if (!body) throw new Error(`no fake route for ${url}`);
    return { json: async () => body };
  };
}

const routes = {
  "data/perfil.json": { versao: "1.0", dadosBasicos: { peso_kg: 71 } },
  "data/protocolo.json": { versao: "1.0" },
  "data/exercicios.json": { versao: "1.0", exercicios: [{ id: "a", nome: "A" }] },
  "data/dieta.json": { versao: "1.0" },
  "data/ficha.json": { versao: "1.0", dias: [{ numero: 1, exercicios: [] }] },
};

test("seedIfNeeded populates all stores on first run", async () => {
  const db = await openDatabase();
  const result = await seedIfNeeded(db, fakeFetch(routes));
  assert.equal(result.seeded, true);

  const perfil = await get(db, "perfil", "1.0");
  assert.equal(perfil.dadosBasicos.peso_kg, 71);

  const exercicios = await getAll(db, "exercicios");
  assert.equal(exercicios.length, 1);

  const ficha = await get(db, "ficha", "1.0");
  assert.equal(ficha.dias.length, 1, "a ficha prescrita também é semeada");

  const config = await get(db, "config", "seedVersion");
  assert.equal(config.valor, "1.0");
  db.close();
});

test("seedIfNeeded is a no-op on the second run", async () => {
  const db = await openDatabase();
  await seedIfNeeded(db, fakeFetch(routes));
  const second = await seedIfNeeded(db, fakeFetch(routes));
  assert.equal(second.seeded, false);
  db.close();
});

test("seedIfNeeded preserva observacoesExecucao existente ao reexecutar com uma nova versão", async () => {
  const db = await openDatabase();
  await seedIfNeeded(db, fakeFetch(routes));

  const exercicio = await get(db, "exercicios", "a");
  exercicio.observacoesExecucao = "Nota do usuário";
  await put(db, "exercicios", exercicio);

  const routesV2 = {
    ...routes,
    "data/protocolo.json": { versao: "2.0" },
  };
  await seedIfNeeded(db, fakeFetch(routesV2));

  const exercicioAposReseed = await get(db, "exercicios", "a");
  assert.equal(exercicioAposReseed.observacoesExecucao, "Nota do usuário");
  db.close();
});
