import { test } from "node:test";
import assert from "node:assert/strict";
import { montarOrientacaoPersonal, recadoValido } from "./personal.js";

const cfg = { repsMin: 8, repsMax: 12, rirAlvo: 1, descansoSegundos: 90 };
const prescricao = { tempo: "2s puxando · 3s voltando", falhaNaUltimaSerie: false, atencao: "Não gire o tronco." };

test("subir de carga: destaca a carga nova e explica por quê", () => {
  const o = montarOrientacaoPersonal({
    sugestao: { acao: "aumentar", carga: 14, repsAlvo: 8, motivo: "Todas as séries chegaram a 12 reps com 12 kg — sobe 2 kg e volta pra 8." },
    cfg, totalSeries: 3, prescricao,
  });
  const carga = o.itens.find((i) => i.titulo === "Carga de hoje");
  assert.equal(carga.destaque, "14 kg");
  assert.match(carga.texto, /sobe 2 kg/);
});

test("séries: faixa, quantas sobrando e se alguma vai à falha", () => {
  const sem = montarOrientacaoPersonal({ sugestao: { acao: "manter", carga: 15, motivo: "Mantém 15 kg." }, cfg, totalSeries: 3, prescricao });
  const series = sem.itens.find((i) => i.titulo === "Séries");
  assert.equal(series.destaque, "3 × 8–12");
  assert.match(series.texto, /1 repetição sobrando/);
  assert.match(series.texto, /Nenhuma até a falha/);

  const com = montarOrientacaoPersonal({ sugestao: { acao: "manter", carga: 15, motivo: "x" }, cfg, totalSeries: 3, prescricao: { ...prescricao, falhaNaUltimaSerie: true } });
  assert.match(com.itens.find((i) => i.titulo === "Séries").texto, /Só a última vai até a falha/);
});

test("carga decimal sai com vírgula", () => {
  const o = montarOrientacaoPersonal({ sugestao: { acao: "manter", carga: 22.5, motivo: "x" }, cfg, totalSeries: 5, prescricao });
  assert.equal(o.itens[0].destaque, "22,5 kg");
});

test("aquecimento vira a orientação da 1ª série; sem aquecimento, a 1ª série é pra acertar a execução", () => {
  const com = montarOrientacaoPersonal({ sugestao: { acao: "manter", carga: 30, motivo: "x" }, cfg, totalSeries: 3, prescricao, aquecimento: [{ peso: 15, reps: 10 }, { peso: 22.5, reps: 5 }] });
  assert.match(com.itens.find((i) => i.titulo === "Antes da 1ª série").texto, /15 kg × 10 → 22,5 kg × 5/);

  const sem = montarOrientacaoPersonal({ sugestao: { acao: "manter", carga: 30, motivo: "x" }, cfg, totalSeries: 3, prescricao });
  assert.match(sem.itens.find((i) => i.titulo === "Antes da 1ª série").texto, /acertar a execução/);
});

test("exercício explosivo: fala de velocidade, não de falha nem de RIR", () => {
  const o = montarOrientacaoPersonal({
    sugestao: { acao: "manter", carga: 12.5, motivo: "x" },
    cfg: { repsMin: 5, repsMax: 5, rirAlvo: 4, descansoSegundos: 60 }, totalSeries: 3,
    prescricao: { potencia: true, tempo: "gira rápido · volta devagar" },
  });
  const series = o.itens.find((i) => i.titulo === "Séries");
  assert.equal(series.destaque, "3 × 5");
  assert.match(series.texto, /velocidade/);
  assert.doesNotMatch(series.texto, /falha|sobrando/);
});

test("ritmo junta o tempo e o descanso; cuidado aparece quando a ficha tem", () => {
  const o = montarOrientacaoPersonal({ sugestao: { acao: "manter", carga: 10, motivo: "x" }, cfg, totalSeries: 3, prescricao });
  assert.match(o.itens.find((i) => i.titulo === "Ritmo").texto, /2s puxando · 3s voltando.*90 s/);
  assert.equal(o.itens.find((i) => i.titulo === "Cuidado").texto, "Não gire o tronco.");
});

test("recado do personal só vale pra próxima vez que o exercício for feito", () => {
  const recado = { texto: "Sobe pra 14 kg.", escritoEm: "2026-10-01T22:00:00.000Z" };
  assert.equal(recadoValido(recado, null), true, "nunca feito: vale");
  assert.equal(recadoValido(recado, { data: "2026-09-29", series: [{ registradaEm: Date.parse("2026-09-29T21:00:00Z") }] }), true, "escrito depois da última vez: vale");
  assert.equal(recadoValido(recado, { data: "2026-10-03", series: [{ registradaEm: Date.parse("2026-10-03T21:00:00Z") }] }), false, "já fez de novo depois do recado: venceu");
  assert.equal(recadoValido(recado, { data: "2026-09-29", series: [{}] }), true, "sem horário nas séries: compara a data");
  assert.equal(recadoValido({ texto: "" }, null), false);
});

test("recado entra com a data em dd/mm", () => {
  const o = montarOrientacaoPersonal({ sugestao: { acao: "manter", carga: 10, motivo: "x" }, cfg, totalSeries: 3, prescricao, recado: { texto: "Foco no lado esquerdo.", escritoEm: "2026-10-01T22:00:00.000Z" } });
  assert.equal(o.recado.texto, "Foco no lado esquerdo.");
  assert.match(o.recado.data, /^\d{2}\/\d{2}$/);
});
