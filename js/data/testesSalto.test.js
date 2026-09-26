import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { salvarTesteSalto, getTestesSalto, diasAteProximoTeste } from "./testesSalto.js";

test("salva e lista os testes em ordem de data", async () => {
  const db = await openDatabase();
  await salvarTesteSalto(db, { data: "2026-10-17", cmjCm: 43.1 });
  await salvarTesteSalto(db, { data: "2026-09-26", cmjCm: 41.5, cmjBracosCm: 48 });
  const testes = await getTestesSalto(db);
  assert.deepEqual(testes.map((t) => t.data), ["2026-09-26", "2026-10-17"]);
  assert.equal(testes[0].cmjBracosCm, 48);
  assert.equal("cmjBracosCm" in testes[1], false);
  db.close();
});

test("próximo teste a cada 3 semanas", () => {
  assert.equal(diasAteProximoTeste([], "2026-09-26"), 0);
  assert.equal(diasAteProximoTeste([{ data: "2026-09-26" }], "2026-10-06"), 11);
  assert.equal(diasAteProximoTeste([{ data: "2026-09-26" }], "2026-10-20"), 0);
});
