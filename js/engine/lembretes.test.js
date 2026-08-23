import { test } from "node:test";
import assert from "node:assert/strict";
import { planejarPausasPosturais, proximaPausaPostural, pausasPendentes, calcularDataReavaliacaoSugerida, devePedirReavaliacaoFase, deveLembrarFotosMedidas, deveLembrarCreatina } from "./lembretes.js";

test("calcularDataReavaliacaoSugerida soma 7 semanas à data de início da fase", () => {
  assert.equal(calcularDataReavaliacaoSugerida("2026-08-19"), "2026-10-07");
});

test("devePedirReavaliacaoFase retorna false sem data definida", () => {
  assert.equal(devePedirReavaliacaoFase(undefined, "2026-08-22"), false);
});

test("devePedirReavaliacaoFase retorna false antes da data", () => {
  assert.equal(devePedirReavaliacaoFase("2026-10-07", "2026-09-01"), false);
});

test("devePedirReavaliacaoFase retorna true na data ou depois", () => {
  assert.equal(devePedirReavaliacaoFase("2026-10-07", "2026-10-07"), true);
  assert.equal(devePedirReavaliacaoFase("2026-10-07", "2026-10-20"), true);
});

test("deveLembrarFotosMedidas retorna true quando nunca houve registro", () => {
  assert.equal(deveLembrarFotosMedidas(undefined, "2026-08-22"), true);
});

test("deveLembrarFotosMedidas retorna false dentro do intervalo de 14 dias", () => {
  assert.equal(deveLembrarFotosMedidas("2026-08-15", "2026-08-22"), false);
});

test("deveLembrarFotosMedidas retorna true a partir de 14 dias", () => {
  assert.equal(deveLembrarFotosMedidas("2026-08-08", "2026-08-22"), true);
});

test("deveLembrarCreatina retorna true sem hábito registrado hoje", () => {
  assert.equal(deveLembrarCreatina(undefined), true);
});

test("deveLembrarCreatina retorna false quando já marcado", () => {
  assert.equal(deveLembrarCreatina({ creatina: true }), false);
});

test("deveLembrarCreatina retorna true quando explicitamente marcado como não tomada", () => {
  assert.equal(deveLembrarCreatina({ creatina: false }), true);
});

// --- pausas posturais no expediente (adicionado 2026-08-23) ---

test("planejarPausasPosturais cobre o expediente de 9h-18h pulando o almoço", () => {
  const horarios = planejarPausasPosturais();
  assert.deepEqual(horarios, ["10:30", "13:30", "15:00", "16:30"]);
});

test("planejarPausasPosturais nunca agenda dentro do almoço", () => {
  const horarios = planejarPausasPosturais({ intervaloMinutos: 60 });
  const dentroDoAlmoco = horarios.filter((h) => h >= "12:00" && h < "13:00");
  assert.deepEqual(dentroDoAlmoco, [], "almoço já tira a pessoa da cadeira");
});

test("planejarPausasPosturais nunca agenda no fim do expediente ou depois", () => {
  const horarios = planejarPausasPosturais({ inicio: "09:00", fim: "18:00", intervaloMinutos: 90 });
  assert.ok(horarios.every((h) => h < "18:00"));
});

test("planejarPausasPosturais respeita horários customizados", () => {
  const horarios = planejarPausasPosturais({
    inicio: "08:00", fim: "12:00", intervaloMinutos: 120, almocoInicio: "23:00", almocoFim: "23:30",
  });
  assert.deepEqual(horarios, ["10:00"]);
});

test("proximaPausaPostural acha a próxima à frente do horário atual", () => {
  const horarios = ["10:30", "13:30", "15:00", "16:30"];
  assert.equal(proximaPausaPostural(horarios, "09:00"), "10:30");
  assert.equal(proximaPausaPostural(horarios, "10:30"), "13:30", "no horário exato já aponta a seguinte");
  assert.equal(proximaPausaPostural(horarios, "15:30"), "16:30");
});

test("proximaPausaPostural devolve null depois da última", () => {
  assert.equal(proximaPausaPostural(["10:30", "16:30"], "19:00"), null);
});

test("pausasPendentes conta as vencidas que ainda não foram marcadas", () => {
  const horarios = ["10:30", "13:30", "15:00", "16:30"];
  assert.equal(pausasPendentes(horarios, "09:00", 0), 0, "nenhuma venceu ainda");
  assert.equal(pausasPendentes(horarios, "14:00", 0), 2, "10:30 e 13:30 venceram");
  assert.equal(pausasPendentes(horarios, "14:00", 2), 0, "as duas já foram marcadas");
  assert.equal(pausasPendentes(horarios, "17:00", 1), 3);
});

test("pausasPendentes nunca fica negativo se marcar mais que o vencido", () => {
  assert.equal(pausasPendentes(["10:30", "13:30"], "11:00", 5), 0);
});
