import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { getEquipamento, salvarEquipamento } from "./equipamento.js";

test("getEquipamento retorna o padrão quando nada foi salvo ainda", async () => {
  const db = await openDatabase();
  const equipamento = await getEquipamento(db);
  assert.equal(equipamento.pesoBarra, 20);
  assert.deepEqual(equipamento.anilhasDisponiveis, [20, 15, 10, 5, 2.5, 1.25]);
  db.close();
});

test("salvarEquipamento grava e getEquipamento passa a retornar o valor salvo", async () => {
  const db = await openDatabase();
  await salvarEquipamento(db, { pesoBarra: 15, anilhasDisponiveis: [10, 5, 2.5] });
  const equipamento = await getEquipamento(db);
  assert.equal(equipamento.pesoBarra, 15);
  assert.deepEqual(equipamento.anilhasDisponiveis, [10, 5, 2.5]);
  db.close();
});
