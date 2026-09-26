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

test("pernas + impulsão: troca só a ficha que ainda está na revisão de 24/09", async () => {
  const { migrarPernasImpulsao20260926 } = await import("./seed.js");
  const banco = await openDatabase();
  const fichaImpulsao = { versao: "1.0", revisao: "2026-09-26", dias: [{ numero: 4, titulo: "Pernas + Impulsão", exercicios: [] }] };
  const buscar = async () => ({ json: async () => fichaImpulsao });
  await put(banco, "ficha", { versao: "1.0", revisao: "2026-09-24", dias: [] });
  const r = await migrarPernasImpulsao20260926(banco, buscar);
  assert.equal(r.migrado, true);
  assert.equal((await get(banco, "ficha", "1.0")).revisao, "2026-09-26");
  assert.equal((await migrarPernasImpulsao20260926(banco, buscar)).jaFeita, true, "roda uma vez só");
  banco.close();
});

test("salto sem caixote: troca só o box jump do dia 4 e mantém o resto", async () => {
  const { migrarSaltoSemCaixote20260926 } = await import("./seed.js");
  const banco = await openDatabase();
  const salto = { ordem: 9, exercicioId: "salto_vertical_alcance", series: 3 };
  const regras = { depoisDeJogo: "novo" };
  const buscar = async () => ({ json: async () => ({ versao: "1.0", revisao: "2026-09-26b", dias: [{ numero: 4, regrasImpulsao: regras, exercicios: [salto] }] }) });
  await put(banco, "ficha", {
    versao: "1.0",
    revisao: "2026-09-26",
    dias: [{ numero: 4, regrasImpulsao: { depoisDeJogo: "velho" }, exercicios: [{ ordem: 1, exercicioId: "box_jump" }, { ordem: 2, exercicioId: "hack", series: 7 }] }],
  });
  const r = await migrarSaltoSemCaixote20260926(banco, buscar);
  assert.equal(r.migrado, true);
  const ficha = await get(banco, "ficha", "1.0");
  assert.equal(ficha.revisao, "2026-09-26b");
  assert.deepEqual(ficha.dias[0].exercicios, [{ ...salto, ordem: 1 }, { ordem: 2, exercicioId: "hack", series: 7 }]);
  assert.deepEqual(ficha.dias[0].regrasImpulsao, regras);
  assert.equal((await migrarSaltoSemCaixote20260926(banco, buscar)).jaFeita, true, "roda uma vez só");
  banco.close();
});
