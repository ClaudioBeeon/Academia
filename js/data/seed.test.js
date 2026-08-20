import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, getAll } from "./db.js";
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
};

test("seedIfNeeded populates all stores on first run", async () => {
  const db = await openDatabase();
  const result = await seedIfNeeded(db, fakeFetch(routes));
  assert.equal(result.seeded, true);

  const perfil = await get(db, "perfil", "1.0");
  assert.equal(perfil.dadosBasicos.peso_kg, 71);

  const exercicios = await getAll(db, "exercicios");
  assert.equal(exercicios.length, 1);

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
