import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, put } from "./db.js";
import { migrarRevisaoAuditoria20260924 } from "./seed.js";

// Banco compartilhado entre os testes deste arquivo (fake-indexeddb global),
// por isso os testes formam uma sequência.
const fichaNova = { versao: "1.0", revisao: "2026-09-24", nome: "Bloco 1 — Peito, bíceps e postura (revisão 24/09)", dias: [{ numero: 1, exercicios: [{ exercicioId: "x" }] }] };
const protocoloNovo = { versao: "1.1", notaDaAuditoria: "a", notaDaAuditoria20260924: "b" };
const fetchImpl = async (url) => ({
  json: async () => (url === "data/ficha.json" ? fichaNova : url === "data/protocolo.json" ? protocoloNovo : null),
});

let db;

test("troca a ficha e o protocolo anteriores do mesmo bloco pela revisão", async () => {
  db = await openDatabase();
  await put(db, "ficha", { versao: "1.0", nome: "Bloco 1 — Peito, bíceps e correção postural", dias: [] });
  await put(db, "protocolo", { versao: "1.1", notaDaAuditoria: "a" });

  const r = await migrarRevisaoAuditoria20260924(db, fetchImpl);
  assert.equal(r.ficha, true);
  assert.equal(r.protocolo, true);
  assert.equal((await get(db, "ficha", "1.0")).revisao, "2026-09-24");
  assert.equal((await get(db, "protocolo", "1.1")).notaDaAuditoria20260924, "b");
});

test("roda uma vez só", async () => {
  await put(db, "ficha", { versao: "1.0", nome: "Bloco 1 — Peito, bíceps e correção postural", dias: [] });
  const r = await migrarRevisaoAuditoria20260924(db, fetchImpl);
  assert.equal(r.jaFeita, true);
  assert.equal((await get(db, "ficha", "1.0")).revisao, undefined, "não mexe de novo");
});

test("nunca toca a ficha de outro perfil", async () => {
  await put(db, "config", { chave: "revisaoAuditoria20260924", valor: false });
  await put(db, "ficha", { versao: "1.0", nome: "Manutenção — peito, bíceps e cardio em foco", dias: [] });
  await put(db, "protocolo", { versao: "1.0", baseadoEm: "outro" });
  const r = await migrarRevisaoAuditoria20260924(db, fetchImpl);
  assert.equal(r.ficha, false);
  assert.equal(r.protocolo, false);
  assert.equal((await get(db, "ficha", "1.0")).nome, "Manutenção — peito, bíceps e cardio em foco");
  db.close();
});
