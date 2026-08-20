import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, put, clearStore } from "./db.js";
import { getMedidas, registrarMedida } from "./medidas.js";

function perfilFixture() {
  return {
    versao: "1.0",
    dataAtualizacao: "2026-08-19",
    dadosBasicos: { peso_kg: 71 },
    composicaoCorporal: { historico: [{ data: "2026-08-19", percentualGordura: 20 }] },
    medidas: { cintura_cm: { historico: [{ data: "2026-08-19", valor: 62 }] } },
  };
}

test("getMedidas faz bootstrap de uma linha inicial a partir do perfil salvo, na primeira chamada", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());

  const linhas = await getMedidas(db);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].data, "2026-08-19");
  assert.equal(linhas[0].peso_kg, 71);
  assert.equal(linhas[0].percentualGordura, 20);
  assert.equal(linhas[0].cintura_cm, 62);
  db.close();
});

test("getMedidas não repete o bootstrap numa segunda chamada", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());

  await getMedidas(db);
  const linhas = await getMedidas(db);
  assert.equal(linhas.length, 1);
  db.close();
});

test("registrarMedida grava uma linha nova e getMedidas passa a incluí-la", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());
  await getMedidas(db); // consome o bootstrap antes do teste

  await registrarMedida(db, { data: "2026-08-25", peso_kg: 70.5 });
  const linhas = await getMedidas(db);
  assert.equal(linhas.length, 2);
  const nova = linhas.find((l) => l.data === "2026-08-25");
  assert.equal(nova.peso_kg, 70.5);
  db.close();
});

test("registrar duas medidas no mesmo dia mantém as duas linhas", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  await put(db, "perfil", perfilFixture());
  await getMedidas(db);

  await registrarMedida(db, { data: "2026-08-26", peso_kg: 70 });
  await registrarMedida(db, { data: "2026-08-26", cintura_cm: 60 });
  const linhas = await getMedidas(db);
  const doDia = linhas.filter((l) => l.data === "2026-08-26");
  assert.equal(doDia.length, 2);
  db.close();
});

test("getMedidas retorna array vazio sem lançar erro se não houver perfil salvo", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");

  const linhas = await getMedidas(db);
  assert.deepEqual(linhas, []);
  db.close();
});

test("getMedidas usa o ponto mais recente do histórico (não o primeiro) e a data mais recente entre os pontos", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  const perfil = {
    versao: "1.0",
    dataAtualizacao: "2026-08-19",
    dadosBasicos: { peso_kg: 71 },
    composicaoCorporal: {
      historico: [
        { data: "2026-01-01", percentualGordura: 25 },
        { data: "2026-08-20", percentualGordura: 18 },
      ],
    },
    medidas: {
      cintura_cm: {
        historico: [
          { data: "2026-01-01", valor: 70 },
          { data: "2026-08-15", valor: 61 },
        ],
      },
    },
  };
  await put(db, "perfil", perfil);

  const linhas = await getMedidas(db);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].percentualGordura, 18);
  assert.equal(linhas[0].cintura_cm, 61);
  assert.equal(linhas[0].data, "2026-08-20");
  db.close();
});

test("getMedidas retorna array vazio sem lançar erro se o perfil não tiver nenhuma data utilizável", async () => {
  const db = await openDatabase();
  await clearStore(db, "perfil");
  await clearStore(db, "medidasCorporais");
  const perfil = {
    versao: "1.0",
    dadosBasicos: { peso_kg: 71 },
  };
  await put(db, "perfil", perfil);

  const linhas = await getMedidas(db);
  assert.deepEqual(linhas, []);
  db.close();
});
