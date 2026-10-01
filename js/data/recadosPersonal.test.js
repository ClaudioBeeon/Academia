import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, put, clearStore, getAll } from "./db.js";
import { baixarRecadosPersonal, getRecadoPersonal } from "./recadosPersonal.js";

function clienteFalso(linhas, filtros = []) {
  const consulta = {
    select() { return consulta; },
    eq(coluna, valor) { filtros.push([coluna, valor]); return consulta; },
    then(resolve) { resolve({ data: linhas, error: null }); },
  };
  return { from: () => consulta };
}
const deps = (cliente) => ({ getClienteImpl: async () => cliente, getUsuarioImpl: async () => ({ id: "u1" }), isConfiguredImpl: () => true });

test("baixa os recados do servidor, só deste usuário e desta tabela, e apaga os removidos", async () => {
  const db = await openDatabase();
  await clearStore(db, "recadosPersonal");
  await put(db, "recadosPersonal", { exercicioId: "velho", texto: "apagar" });
  const filtros = [];
  const cliente = clienteFalso([
    { record_key: "remada_serrote_halter", data: { texto: "Sobe pra 14 kg.", escritoEm: "2026-10-01T22:00:00Z" }, deleted: false },
    { record_key: "velho", data: {}, deleted: true },
  ], filtros);

  assert.equal(await baixarRecadosPersonal(db, deps(cliente)), 2);
  assert.deepEqual(filtros, [["user_id", "u1"], ["store_name", "recadosPersonal"]]);
  assert.equal((await getRecadoPersonal(db, "remada_serrote_halter")).texto, "Sobe pra 14 kg.");
  assert.equal(await getRecadoPersonal(db, "velho"), undefined);
  db.close();
});

test("sem login ou sem configuração não toca a rede nem o banco", async () => {
  const db = await openDatabase();
  await clearStore(db, "recadosPersonal");
  assert.equal(await baixarRecadosPersonal(db, { ...deps(null), isConfiguredImpl: () => false }), 0);
  assert.equal(await baixarRecadosPersonal(db, { ...deps(clienteFalso([])), getUsuarioImpl: async () => null }), 0);
  assert.deepEqual(await getAll(db, "recadosPersonal"), []);
  db.close();
});
