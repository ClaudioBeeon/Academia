import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularTMB, calcularMetaCalorica, calcularMetaCaloricaAdaptativa, checarAdequacaoNutricional, pisoCaloricoSeguranca, avaliarDeficitConsistente, calcularMetaProteina, avaliarProteinaDoDia, calcularMetaFibra } from "./nutricao.js";

test("calcularTMB usa Mifflin-St Jeor para homem", () => {
  const tmb = calcularTMB({ sexo: "masculino", pesoKg: 71, alturaCm: 170, idade: 30 });
  assert.equal(tmb, Math.round(10 * 71 + 6.25 * 170 - 5 * 30 + 5));
});

test("calcularTMB subtrai 161 para mulher em vez de somar 5", () => {
  const tmb = calcularTMB({ sexo: "feminino", pesoKg: 60, alturaCm: 165, idade: 28 });
  assert.equal(tmb, Math.round(10 * 60 + 6.25 * 165 - 5 * 28 - 161));
});

test("calcularTMB retorna null com dados incompletos", () => {
  assert.equal(calcularTMB({ sexo: "masculino", pesoKg: 71 }), null);
});

test("pisoCaloricoSeguranca nunca fica abaixo de 1500", () => {
  assert.equal(pisoCaloricoSeguranca(1200), 1500);
  assert.equal(pisoCaloricoSeguranca(1800), 1800);
});

test("calcularMetaCalorica sinaliza fase de calibração com poucos dados de peso", () => {
  const meta = calcularMetaCalorica({ tmb: 1700, fase: "definicao", historicoPesoTendencia: [{ peso_kg: 71 }] });
  assert.equal(meta.emCalibracao, true);
  assert.equal(meta.piso_kcal, 1700);
  assert.ok(meta.meta_kcal >= meta.piso_kcal);
});

test("calcularMetaCalorica aplica déficit moderado de 20% na fase de definição sem furar o piso", () => {
  const meta = calcularMetaCalorica({ tmb: 1700, fase: "definicao", historicoPesoTendencia: [] });
  assert.equal(meta.meta_kcal, Math.max(1700, Math.round(1700 * 0.8)));
});

test("calcularMetaCalorica nunca cai abaixo do piso de segurança mesmo com TMB baixa", () => {
  const meta = calcularMetaCalorica({ tmb: 1400, fase: "definicao", historicoPesoTendencia: [] });
  assert.equal(meta.meta_kcal, 1500);
});

test("checarAdequacaoNutricional avisa quando total fica abaixo do piso de segurança", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1200, proteina_g: 100, carboidrato_g: 50, gordura_g: 40 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    fibraG: 20,
  });
  assert.ok(alertas.some((a) => a.eixo === "calorias"));
});

test("checarAdequacaoNutricional avisa quando gordura fica abaixo de 0.5g/kg", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1600, proteina_g: 150, carboidrato_g: 80, gordura_g: 20 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    fibraG: 20,
  });
  assert.ok(alertas.some((a) => a.eixo === "gordura"));
});

test("checarAdequacaoNutricional sinaliza lacuna de fibra quando fica abaixo da referência de 14g/1000kcal", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1600, proteina_g: 150, carboidrato_g: 80, gordura_g: 60 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    fibraG: 5,
  });
  assert.ok(alertas.some((a) => a.eixo === "fibraEVariedade"));
});

test("checarAdequacaoNutricional não sinaliza fibra quando já bate a referência", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1600, proteina_g: 150, carboidrato_g: 80, gordura_g: 60 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    fibraG: 25,
  });
  assert.equal(alertas.find((a) => a.eixo === "fibraEVariedade"), undefined);
});

test("calcularMetaFibra escala 14g por 1000kcal (referência USDA)", () => {
  assert.equal(calcularMetaFibra(2000), 28);
  assert.equal(calcularMetaFibra(1360), 19);
});

test("calcularMetaFibra retorna null sem meta calórica válida", () => {
  assert.equal(calcularMetaFibra(0), null);
  assert.equal(calcularMetaFibra(undefined), null);
});

test("avaliarDeficitConsistente retorna false sem dias registrados", () => {
  assert.equal(avaliarDeficitConsistente({ totaisDiarios: [], metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500 } }), false);
});

test("avaliarDeficitConsistente retorna false sem meta calórica calculável", () => {
  assert.equal(avaliarDeficitConsistente({ totaisDiarios: [{ kcal: 1200 }], metaCalorica: null }), false);
});

test("avaliarDeficitConsistente retorna true quando 2 de 3 dias recentes estão em déficit", () => {
  const metaCalorica = { tmb_kcal: 1700, piso_kcal: 1500 };
  const resultado = avaliarDeficitConsistente({
    totaisDiarios: [{ kcal: 1400 }, { kcal: 1450 }, { kcal: 1650 }],
    metaCalorica,
  });
  assert.equal(resultado, true);
});

test("avaliarDeficitConsistente retorna false quando só 1 dia está em déficit", () => {
  const metaCalorica = { tmb_kcal: 1700, piso_kcal: 1500 };
  const resultado = avaliarDeficitConsistente({
    totaisDiarios: [{ kcal: 1400 }, { kcal: 1650 }, { kcal: 1680 }],
    metaCalorica,
  });
  assert.equal(resultado, false);
});

test("avaliarDeficitConsistente exige déficit no único dia disponível quando há menos de 2 dias", () => {
  const metaCalorica = { tmb_kcal: 1700, piso_kcal: 1500 };
  assert.equal(avaliarDeficitConsistente({ totaisDiarios: [{ kcal: 1400 }], metaCalorica }), true);
  assert.equal(avaliarDeficitConsistente({ totaisDiarios: [{ kcal: 1650 }], metaCalorica }), false);
});

test("checarAdequacaoNutricional não gera alertas quando tudo está dentro das faixas", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1650, proteina_g: 150, carboidrato_g: 80, gordura_g: 60 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    fibraG: 20,
  });
  assert.deepEqual(alertas, []);
});

// --- meta de proteína (adicionada 2026-08-23) ---

test("calcularMetaProteina usa a faixa de déficit (1,8-2,2 g/kg) na fase definicao", () => {
  const meta = calcularMetaProteina({ pesoKg: 71, fase: "definicao" });
  assert.equal(meta.min_g, 128);
  assert.equal(meta.max_g, 156);
  assert.equal(meta.emDeficit, true);
});

test("calcularMetaProteina usa a faixa padrão (1,6-2,2 g/kg) fora do déficit", () => {
  const meta = calcularMetaProteina({ pesoKg: 71, fase: "hipertrofia_peito" });
  assert.equal(meta.min_g, 114);
  assert.equal(meta.emDeficit, false);
});

test("calcularMetaProteina devolve null sem peso válido", () => {
  assert.equal(calcularMetaProteina({ pesoKg: 0 }), null);
  assert.equal(calcularMetaProteina({}), null);
});

test("avaliarProteinaDoDia marca ok ao bater o mínimo e calcula o que falta abaixo dele", () => {
  const meta = calcularMetaProteina({ pesoKg: 71, fase: "definicao" });
  assert.deepEqual(avaliarProteinaDoDia({ proteinaG: 130, metaProteina: meta }), { status: "ok", faltam_g: 0 });
  assert.deepEqual(avaliarProteinaDoDia({ proteinaG: 128, metaProteina: meta }), { status: "ok", faltam_g: 0 });
  assert.deepEqual(avaliarProteinaDoDia({ proteinaG: 100, metaProteina: meta }), { status: "abaixo", faltam_g: 28 });
});

test("avaliarProteinaDoDia não alerta acima do máximo — proteína extra não é problema", () => {
  const meta = calcularMetaProteina({ pesoKg: 71, fase: "definicao" });
  assert.equal(avaliarProteinaDoDia({ proteinaG: 200, metaProteina: meta }).status, "ok");
});

test("checarAdequacaoNutricional inclui o eixo proteína quando a meta é informada", () => {
  const meta = calcularMetaProteina({ pesoKg: 71, fase: "definicao" });
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1800, proteina_g: 90, gordura_g: 60 },
    metaCalorica: { meta_kcal: 1800, piso_kcal: 1500, tmb_kcal: 1650 },
    pesoKg: 71,
    fibraG: 30,
    metaProteina: meta,
  });
  const proteina = alertas.find((a) => a.eixo === "proteina");
  assert.ok(proteina, "deve sinalizar proteína abaixo da meta");
  assert.match(proteina.mensagem, /faltam 38g/);
});

test("checarAdequacaoNutricional não quebra quando metaProteina não é passada", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1800, proteina_g: 90, gordura_g: 60 },
    metaCalorica: { meta_kcal: 1800, piso_kcal: 1500, tmb_kcal: 1650 },
    pesoKg: 71,
    fibraG: 30,
  });
  assert.equal(alertas.find((a) => a.eixo === "proteina"), undefined);
});

test("calcularMetaCaloricaAdaptativa cai pro cálculo padrão sem dados suficientes de peso", () => {
  const meta = calcularMetaCaloricaAdaptativa({
    tmb: 1700, fase: "definicao",
    historicoPesoTendencia: [{ data: "2026-08-01", peso_kg: 80 }],
    totaisDiariosRecentes: Array.from({ length: 20 }, () => ({ kcal: 1800 })),
  });
  assert.equal(meta.adaptativa, false);
  assert.equal(meta.tdeeEstimado, null);
});

test("calcularMetaCaloricaAdaptativa cai pro cálculo padrão sem dieta suficiente registrada", () => {
  const meta = calcularMetaCaloricaAdaptativa({
    tmb: 1700, fase: "definicao",
    historicoPesoTendencia: [
      { data: "2026-08-01", peso_kg: 80 },
      { data: "2026-08-15", peso_kg: 79 },
    ],
    totaisDiariosRecentes: [{ kcal: 1800 }, { kcal: 1800 }],
  });
  assert.equal(meta.adaptativa, false);
});

test("calcularMetaCaloricaAdaptativa recalibra a meta a partir do TDEE real (peso + dieta o bastante)", () => {
  const meta = calcularMetaCaloricaAdaptativa({
    tmb: 1700, fase: "definicao",
    historicoPesoTendencia: [
      { data: "2026-08-01", peso_kg: 80 },
      { data: "2026-08-15", peso_kg: 79 },
    ],
    totaisDiariosRecentes: Array.from({ length: 14 }, () => ({ kcal: 1800 })),
  });
  assert.equal(meta.adaptativa, true);
  assert.equal(meta.tdeeEstimado, 2350);
  assert.equal(meta.meta_kcal, 1880);
  assert.ok(meta.meta_kcal >= meta.piso_kcal);
});

test("calcularMetaCaloricaAdaptativa nunca deixa a meta cair abaixo do piso de segurança", () => {
  // Cenário extremo de propósito (ganhou peso comendo pouco) só pra forçar
  // um TDEE estimado bem baixo e confirmar que o piso segura a meta.
  const meta = calcularMetaCaloricaAdaptativa({
    tmb: 1700, fase: "definicao",
    historicoPesoTendencia: [
      { data: "2026-08-01", peso_kg: 70 },
      { data: "2026-08-15", peso_kg: 72 },
    ],
    totaisDiariosRecentes: Array.from({ length: 14 }, () => ({ kcal: 1200 })),
  });
  assert.equal(meta.meta_kcal, meta.piso_kcal);
});
