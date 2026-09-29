import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, put, putAll, getAll, clearStore } from "./db.js";
import { trazerRevisoesDoRepositorio } from "./seed.js";

// Caso real de 28/09/2026: o login trouxe do servidor a ficha de antes da
// auditoria (sem `revisao`, cardio nos 5 dias) e um catálogo antigo.
const fichaRepo = { versao: "1.0", revisao: "2026-09-26b", nome: "Bloco 1 — Peito, bíceps e postura (revisão 24/09)", dias: [{ numero: 1, cardio: null }] };
const protocoloRepo = { versao: "1.1", notaDaAuditoria: "a", notaDaAuditoria20260924: "b" };
const catalogoRepo = { versao: "1.6", exercicios: [{ id: "a", nome: "A", fatorVolume: 1, observacoesExecucao: "repo" }, { id: "b", nome: "B" }] };
const buscar = async (url) => ({
  json: async () => (url === "data/ficha.json" ? fichaRepo : url === "data/protocolo.json" ? protocoloRepo : catalogoRepo),
});

async function bancoLimpo() {
  const db = await openDatabase();
  for (const store of ["ficha", "protocolo", "exercicios", "config"]) await clearStore(db, store);
  return db;
}

test("volta a ficha e o protocolo antigos pra revisão do repositório", async () => {
  const db = await bancoLimpo();
  await put(db, "ficha", { versao: "1.0", nome: "Bloco 1 — Peito, bíceps e correção postural", dias: [{ numero: 1, cardio: { modalidade: "bicicleta" } }] });
  await put(db, "protocolo", { versao: "1.1", notaDaAuditoria: "a" });
  await putAll(db, "exercicios", catalogoRepo.exercicios);
  await put(db, "config", { chave: "revisaoAuditoria20260924", valor: true });

  const alterados = await trazerRevisoesDoRepositorio(db, buscar);
  assert.deepEqual(alterados, ["ficha", "protocolo"]);
  assert.equal((await get(db, "ficha", "1.0")).revisao, "2026-09-26b");
  assert.equal((await get(db, "ficha", "1.0")).dias[0].cardio, null);
  assert.equal((await getAll(db, "protocolo"))[0].notaDaAuditoria20260924, "b");
  assert.deepEqual(await trazerRevisoesDoRepositorio(db, buscar), [], "na segunda vez não grava nada");
  db.close();
});

test("não mexe na ficha de outro perfil nem numa revisão igual", async () => {
  const db = await bancoLimpo();
  await putAll(db, "exercicios", catalogoRepo.exercicios);
  await put(db, "ficha", { versao: "1.0", nome: "Manutenção — Francesco", dias: [] });
  assert.deepEqual(await trazerRevisoesDoRepositorio(db, buscar), []);
  await put(db, "ficha", { ...fichaRepo, dias: [{ numero: 1, cardio: "meu ajuste" }] });
  assert.deepEqual(await trazerRevisoesDoRepositorio(db, buscar), []);
  assert.equal((await get(db, "ficha", "1.0")).dias[0].cardio, "meu ajuste");
  db.close();
});

test("catálogo: regrava se faltar exercício ou mudar campo, mantendo a observação da pessoa", async () => {
  const db = await bancoLimpo();
  // Chaves em outra ordem (como volta do servidor) e observação reescrita: não é diferença.
  await putAll(db, "exercicios", [{ observacoesExecucao: "minha", fatorVolume: 1, nome: "A", id: "a" }, { nome: "B", id: "b" }]);
  assert.deepEqual(await trazerRevisoesDoRepositorio(db, buscar), []);

  await clearStore(db, "exercicios");
  await putAll(db, "exercicios", [{ id: "a", nome: "A", fatorVolume: 0, observacoesExecucao: "minha" }]);
  assert.deepEqual(await trazerRevisoesDoRepositorio(db, buscar), ["exercicios"]);
  const porId = new Map((await getAll(db, "exercicios")).map((e) => [e.id, e]));
  assert.equal(porId.get("a").fatorVolume, 1);
  assert.equal(porId.get("a").observacoesExecucao, "minha");
  assert.ok(porId.has("b"));
  assert.equal((await get(db, "config", "seedVersion")).valor, "1.6");
  db.close();
});
