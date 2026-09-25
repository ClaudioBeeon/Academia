import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase } from "./db.js";
import { salvarSessaoVolei, getSessaoVolei, getSessoesVolei, getInicioVolei, definirInicioVolei } from "./volei.js";

let db;

test("salvar aos poucos mescla exercícios e testes do mesmo dia", async () => {
  db = await openDatabase();
  await salvarSessaoVolei(db, "2026-09-24", { exercicios: { paredeFixa: { acertos: 12, tentativas: 20 } } });
  await salvarSessaoVolei(db, "2026-09-24", { exercicios: { faixa: { acertos: 25, tentativas: 30 } }, testes: { T1: 31 } });
  const s = await getSessaoVolei(db, "2026-09-24");
  assert.deepEqual(Object.keys(s.exercicios).sort(), ["faixa", "paredeFixa"]);
  assert.equal(s.testes.T1, 31);
});

test("início do programa: primeira sessão, ou o que foi definido ao recomeçar", async () => {
  await salvarSessaoVolei(db, "2026-09-30", { duracaoMin: 20 });
  assert.equal(await getInicioVolei(db), "2026-09-24");
  await definirInicioVolei(db, "2026-10-05");
  assert.equal(await getInicioVolei(db), "2026-10-05");
  assert.deepEqual((await getSessoesVolei(db)).map((s) => s.data), ["2026-09-24", "2026-09-30"]);
  db.close();
});
