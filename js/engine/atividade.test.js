import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularAtividadeMensal } from "./atividade.js";

function serie(data, exercicioId, tipoSerie = "normal") {
  return { data, exercicioId, tipoSerie, carga: 10, reps: 10, rir: 2, musculo: "peito" };
}

test("array vazio retorna os quatro campos zerados", () => {
  const resultado = calcularAtividadeMensal([], "2026-08-20");
  assert.deepEqual(resultado, {
    treinosEsteMes: 0,
    seriesEstaSemana: 0,
    minutosAtivosEstaSemana: 0,
    diasSeguidos: 0,
  });
});

test("treinosEsteMes conta datas distintas só do mês/ano de hoje", () => {
  const series = [
    serie("2026-08-05", "a"),
    serie("2026-08-05", "b"),
    serie("2026-08-12", "a"),
    serie("2026-07-30", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.treinosEsteMes, 2);
});

test("seriesEstaSemana conta só séries da mesma semana ISO de hoje, excluindo aquecimento", () => {
  const series = [
    serie("2026-08-19", "a"),
    serie("2026-08-19", "a", "aquecimento"),
    serie("2026-08-13", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.seriesEstaSemana, 1);
});

test("minutosAtivosEstaSemana usa 7 minutos por exercício distinto da semana", () => {
  const series = [
    serie("2026-08-19", "a"),
    serie("2026-08-19", "a"),
    serie("2026-08-19", "b"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.minutosAtivosEstaSemana, 14);
});

test("diasSeguidos conta a sequência mais recente, parando no primeiro buraco", () => {
  const series = [
    serie("2026-08-20", "a"),
    serie("2026-08-19", "a"),
    serie("2026-08-18", "a"),
    serie("2026-08-15", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.diasSeguidos, 3);
});

test("diasSeguidos conta a partir de ontem quando hoje ainda não tem série", () => {
  const series = [
    serie("2026-08-19", "a"),
    serie("2026-08-18", "a"),
  ];
  const resultado = calcularAtividadeMensal(series, "2026-08-20");
  assert.equal(resultado.diasSeguidos, 2);
});
