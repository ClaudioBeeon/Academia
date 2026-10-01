import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, get, putAll, clearStore } from "./db.js";
import { imagemMaisNovaPorExercicio, religarImagensExercicios } from "./imagensExercicio.js";

const arquivos = [
  { nome: "remada_serrote_halter-1787600807290.png", url: "u/serrote-velha" },
  { nome: "remada_serrote_halter-1790000000000.png", url: "u/serrote-nova" },
  { nome: "leg_press_45-1787767383360.png", url: "u/leg" },
  { nome: ".emptyFolderPlaceholder", url: "u/lixo" },
];

test("imagemMaisNovaPorExercicio tira o exercício do nome e fica com a mais nova", () => {
  const mapa = imagemMaisNovaPorExercicio(arquivos);
  assert.equal(mapa.get("remada_serrote_halter"), "u/serrote-nova");
  assert.equal(mapa.get("leg_press_45"), "u/leg");
  assert.equal(mapa.size, 2, "arquivo fora do padrão é ignorado");
});

test("religarImagensExercicios devolve a imagem perdida e não regrava o que já está certo", async () => {
  const db = await openDatabase();
  await clearStore(db, "exercicios");
  await putAll(db, "exercicios", [
    { id: "remada_serrote_halter", nome: "Serrote" },
    { id: "leg_press_45", nome: "Leg", imagemUrl: "u/leg" },
    { id: "sem_imagem", nome: "Sem" },
  ]);
  const listarImpl = async () => arquivos;

  assert.deepEqual(await religarImagensExercicios(db, { listarImpl }), ["remada_serrote_halter"]);
  assert.equal((await get(db, "exercicios", "remada_serrote_halter")).imagemUrl, "u/serrote-nova");
  assert.equal((await get(db, "exercicios", "sem_imagem")).imagemUrl, undefined);
  assert.deepEqual(await religarImagensExercicios(db, { listarImpl }), [], "na segunda vez não muda nada");
  db.close();
});

test("religarImagensExercicios sem login (lista vazia) não mexe em nada", async () => {
  const db = await openDatabase();
  await clearStore(db, "exercicios");
  await putAll(db, "exercicios", [{ id: "a", nome: "A", imagemUrl: "u/a" }]);
  assert.deepEqual(await religarImagensExercicios(db, { listarImpl: async () => [] }), []);
  assert.equal((await get(db, "exercicios", "a")).imagemUrl, "u/a");
  db.close();
});
