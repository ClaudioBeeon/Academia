import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarSessaoDoDia } from "./sessaoGerada.js";

function ex(id, musculo) {
  return { id, nome: id, musculoPrimario: musculo };
}

test("sem exercícios no grupo retorna sessão vazia", () => {
  assert.deepEqual(gerarSessaoDoDia({ exerciciosDoGrupo: [] }), []);
});

test("respeita o alvo máximo de 7 exercícios mesmo com catálogo maior", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"), ex("peito3", "peito"),
    ex("costas1", "costas"), ex("costas2", "costas"), ex("costas3", "costas"),
    ex("ombro1", "ombro"), ex("ombro2", "ombro"),
    ex("biceps1", "biceps"), ex("biceps2", "biceps"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
    ex("abdomen1", "abdomen"), ex("abdomen2", "abdomen"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  assert.equal(sessao.length, 7);
});

test("todos os músculos do grupo aparecem pelo menos uma vez antes de qualquer músculo repetir (round-robin)", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"),
    ex("costas1", "costas"), ex("costas2", "costas"),
    ex("ombro1", "ombro"), ex("ombro2", "ombro"),
    ex("biceps1", "biceps"), ex("biceps2", "biceps"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
    ex("abdomen1", "abdomen"), ex("abdomen2", "abdomen"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  const musculosPrimeiraRodada = new Set(sessao.slice(0, 6).map((e) => e.musculoPrimario));
  assert.equal(musculosPrimeiraRodada.size, 6);
});

test("nunca seleciona mais que 2 exercícios do mesmo músculo (respeita o limite de 8 séries diretas/sessão)", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"), ex("peito3", "peito"),
    ex("costas1", "costas"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  const doPeito = sessao.filter((e) => e.musculoPrimario === "peito");
  assert.ok(doPeito.length <= 2);
});

test("músculo em manutenção ainda aparece na sessão, mesmo com menor prioridade", () => {
  const exercicios = [
    ex("peito1", "peito"), ex("peito2", "peito"),
    ex("costas1", "costas"), ex("costas2", "costas"),
    ex("ombro1", "ombro"), ex("ombro2", "ombro"),
    ex("biceps1", "biceps"), ex("biceps2", "biceps"),
    ex("triceps1", "triceps"), ex("triceps2", "triceps"),
    ex("abdomen1", "abdomen"), ex("abdomen2", "abdomen"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, musculosEmManutencao: ["peito"] });
  assert.ok(sessao.some((e) => e.musculoPrimario === "peito"));
});

test("músculo priorizado ganha o segundo exercício antes de um músculo comum", () => {
  // 6 músculos (como o grupo Superior real) deixam 1 vaga sobrando na
  // rodada 2 depois da rodada 1 cobrir todos — essa vaga deve ir pro
  // músculo priorizado, não pro primeiro da lista por acaso.
  const exercicios = [
    ex("a1", "a"), ex("a2", "a"),
    ex("b1", "b"), ex("b2", "b"),
    ex("c1", "c"), ex("c2", "c"),
    ex("d1", "d"), ex("d2", "d"),
    ex("e1", "e"), ex("e2", "e"),
    ex("f1", "f"), ex("f2", "f"),
  ];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, musculosPriorizados: ["f"] });
  assert.equal(sessao[6].musculoPrimario, "f");
});

test("com menos exercícios que o alvo, retorna o catálogo inteiro sem duplicar", () => {
  const exercicios = [ex("q1", "quadriceps"), ex("p1", "posterior_coxa"), ex("g1", "gluteo")];
  const sessao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios });
  assert.equal(sessao.length, 3);
});

test("rotação desloca o exercício inicial de cada músculo conforme sessões anteriores do grupo", () => {
  const exercicios = [ex("peito1", "peito"), ex("peito2", "peito"), ex("peito3", "peito")];
  const semRotacao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, sessoesAnterioresDoGrupo: 0 });
  const comRotacao = gerarSessaoDoDia({ exerciciosDoGrupo: exercicios, sessoesAnterioresDoGrupo: 1 });
  assert.equal(semRotacao[0].id, "peito1");
  assert.equal(comRotacao[0].id, "peito2");
});
