import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarAjustesSessaoDoDia } from "./ajustesSessao.js";

const catalogo = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "x" }];
const hoje = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("sem pulados, a lista volta como estava", () => {
  const r = aplicarAjustesSessaoDoDia(hoje, catalogo, {}, [], new Set());
  assert.deepEqual(r.map((e) => e.id), ["a", "b", "c"]);
  assert.ok(r.every((e) => !e.puladoHoje));
});

test("exercício pulado continua na lista, marcado como pulado hoje", () => {
  const r = aplicarAjustesSessaoDoDia(hoje, catalogo, {}, [], new Set(), { pulados: ["b"] });
  assert.deepEqual(r.map((e) => [e.id, Boolean(e.puladoHoje)]), [["a", false], ["b", true], ["c", false]]);
});

test("pular o original também marca o substituto (troca feita antes)", () => {
  const r = aplicarAjustesSessaoDoDia(hoje, catalogo, { a: "x" }, [], new Set(), { pulados: ["a"] });
  assert.equal(r[0].id, "x");
  assert.equal(r[0].puladoHoje, true);
});

test("exercício extra entra no fim da fila, com 3 séries e marcado como extra", () => {
  const r = aplicarAjustesSessaoDoDia(hoje, catalogo, {}, [], new Set(), { extras: ["x"] });
  assert.deepEqual(r.map((e) => e.id), ["a", "b", "c", "x"]);
  assert.equal(r[3].extraDoDia, true);
  assert.equal(r[3].seriesAlvo, 3);
});

test("superset leva B pra logo depois de A e marca os dois", () => {
  const r = aplicarAjustesSessaoDoDia(hoje, catalogo, {}, [], new Set(), { supersets: [["a", "c"]] });
  assert.deepEqual(r.map((e) => e.id), ["a", "c", "b"]);
  assert.equal(r[0].supersetPosicao, "A");
  assert.equal(r[0].supersetCom.id, "c");
  assert.equal(r[1].supersetPosicao, "B");
  assert.equal(r[1].supersetCom.id, "a");
});

test("superset com exercício que não está hoje é ignorado", () => {
  const r = aplicarAjustesSessaoDoDia(hoje, catalogo, {}, [], new Set(), { supersets: [["a", "z"]] });
  assert.deepEqual(r.map((e) => e.id), ["a", "b", "c"]);
  assert.equal(r[0].supersetCom, undefined);
});
