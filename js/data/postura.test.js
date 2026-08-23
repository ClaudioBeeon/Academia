import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, clearStore } from "./db.js";
import {
  getFotosPostura,
  registrarFotoPostura,
  excluirFotoPostura,
  primeiraEUltima,
  diasAteProximaFoto,
} from "./postura.js";

const blobFake = () => new Blob(["x"], { type: "image/jpeg" });

test("getFotosPostura devolve vazio quando não há fotos", async () => {
  const db = await openDatabase();
  await clearStore(db, "fotosPostura");
  assert.deepEqual(await getFotosPostura(db), []);
  db.close();
});

test("registrarFotoPostura grava e getFotosPostura ordena da mais antiga pra mais nova", async () => {
  const db = await openDatabase();
  await clearStore(db, "fotosPostura");
  await registrarFotoPostura(db, { data: "2026-10-01", blob: blobFake() });
  await registrarFotoPostura(db, { data: "2026-09-01", blob: blobFake() });
  await registrarFotoPostura(db, { data: "2026-11-01", blob: blobFake() });

  const fotos = await getFotosPostura(db);
  assert.deepEqual(fotos.map((f) => f.data), ["2026-09-01", "2026-10-01", "2026-11-01"]);
  db.close();
});

test("excluirFotoPostura remove só a foto pedida", async () => {
  const db = await openDatabase();
  await clearStore(db, "fotosPostura");
  await registrarFotoPostura(db, { data: "2026-09-01", blob: blobFake() });
  await registrarFotoPostura(db, { data: "2026-10-01", blob: blobFake() });

  const antes = await getFotosPostura(db);
  await excluirFotoPostura(db, antes[1].id);
  const depois = await getFotosPostura(db);
  assert.equal(depois.length, 1);
  assert.equal(depois[0].data, "2026-09-01");
  db.close();
});

test("primeiraEUltima devolve nulos sem fotos", () => {
  assert.deepEqual(primeiraEUltima([]), { primeira: null, ultima: null, semanasEntre: 0 });
});

test("primeiraEUltima com uma só foto não inventa uma segunda", () => {
  const r = primeiraEUltima([{ data: "2026-09-01" }]);
  assert.equal(r.primeira.data, "2026-09-01");
  assert.equal(r.ultima, null);
  assert.equal(r.semanasEntre, 0);
});

test("primeiraEUltima compara os extremos e conta as semanas entre eles", () => {
  const r = primeiraEUltima([
    { data: "2026-09-01" }, { data: "2026-09-29" }, { data: "2026-10-27" },
  ]);
  assert.equal(r.primeira.data, "2026-09-01");
  assert.equal(r.ultima.data, "2026-10-27", "compara com o começo, não com a foto anterior");
  assert.equal(r.semanasEntre, 8);
});

test("diasAteProximaFoto sugere a primeira foto imediatamente", () => {
  assert.equal(diasAteProximaFoto([], "2026-09-01"), 0);
});

test("diasAteProximaFoto conta 4 semanas desde a última", () => {
  const fotos = [{ data: "2026-09-01" }];
  assert.equal(diasAteProximaFoto(fotos, "2026-09-01"), 28);
  assert.equal(diasAteProximaFoto(fotos, "2026-09-15"), 14);
  assert.equal(diasAteProximaFoto(fotos, "2026-09-29"), 0);
});

test("diasAteProximaFoto nunca fica negativo depois do prazo", () => {
  assert.equal(diasAteProximaFoto([{ data: "2026-09-01" }], "2026-12-01"), 0);
});
