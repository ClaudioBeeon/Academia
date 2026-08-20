import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, clearStore } from "./db.js";
import { registrarCardio, getCardioDoDia, getCardioRecente, getCardioDesde } from "./cardio.js";

test("getCardioRecente retorna vazio quando não há registros", async () => {
  const db = await openDatabase();
  const resultado = await getCardioRecente(db);
  assert.deepEqual(resultado, []);
  db.close();
});

test("registrarCardio grava e getCardioDoDia filtra pela data", async () => {
  const db = await openDatabase();
  await registrarCardio(db, { data: "2026-08-20", modalidade: "bicicleta", duracaoMinutos: 30, intensidadePercebida: 3 });
  await registrarCardio(db, { data: "2026-08-19", modalidade: "caminhada", duracaoMinutos: 40, intensidadePercebida: 2 });

  const doDia = await getCardioDoDia(db, "2026-08-20");
  assert.equal(doDia.length, 1);
  assert.equal(doDia[0].modalidade, "bicicleta");
  db.close();
});

test("getCardioRecente ordena do mais recente pro mais antigo e respeita o limite", async () => {
  const db = await openDatabase();
  await registrarCardio(db, { data: "2030-07-01", modalidade: "escada", duracaoMinutos: 20, intensidadePercebida: 4 });
  await registrarCardio(db, { data: "2030-07-10", modalidade: "eliptico", duracaoMinutos: 25, intensidadePercebida: 3 });
  await registrarCardio(db, { data: "2030-07-05", modalidade: "bicicleta", duracaoMinutos: 30, intensidadePercebida: 2 });

  const resultado = await getCardioRecente(db, 2);
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].data, "2030-07-10");
  assert.equal(resultado[1].data, "2030-07-05");
  db.close();
});

test("getCardioDesde retorna vazio quando não há registros", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosCardio");
  const resultado = await getCardioDesde(db, "2026-08-14");
  assert.deepEqual(resultado, []);
  db.close();
});

test("getCardioDesde retorna só registros na data de corte ou depois", async () => {
  const db = await openDatabase();
  await clearStore(db, "registrosCardio");
  await registrarCardio(db, { data: "2026-08-10", modalidade: "bicicleta", duracaoMinutos: 30, intensidadePercebida: 2 });
  await registrarCardio(db, { data: "2026-08-15", modalidade: "corrida", duracaoMinutos: 25, intensidadePercebida: 4 });
  await registrarCardio(db, { data: "2026-08-20", modalidade: "elíptico", duracaoMinutos: 20, intensidadePercebida: 3 });

  const resultado = await getCardioDesde(db, "2026-08-14");
  assert.equal(resultado.length, 2);
  assert.ok(resultado.every((r) => r.data >= "2026-08-14"));
  db.close();
});
