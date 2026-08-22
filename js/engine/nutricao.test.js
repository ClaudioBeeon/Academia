import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularTMB, calcularMetaCalorica, checarAdequacaoNutricional, pisoCaloricoSeguranca } from "./nutricao.js";

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
    temFibraOuVegetais: true,
  });
  assert.ok(alertas.some((a) => a.eixo === "calorias"));
});

test("checarAdequacaoNutricional avisa quando gordura fica abaixo de 0.5g/kg", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1600, proteina_g: 150, carboidrato_g: 80, gordura_g: 20 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    temFibraOuVegetais: true,
  });
  assert.ok(alertas.some((a) => a.eixo === "gordura"));
});

test("checarAdequacaoNutricional sinaliza lacuna de fibra/variedade quando não há vegetais", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1600, proteina_g: 150, carboidrato_g: 80, gordura_g: 60 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    temFibraOuVegetais: false,
  });
  assert.ok(alertas.some((a) => a.eixo === "fibraEVariedade"));
});

test("checarAdequacaoNutricional não gera alertas quando tudo está dentro das faixas", () => {
  const alertas = checarAdequacaoNutricional({
    totalDia: { kcal: 1650, proteina_g: 150, carboidrato_g: 80, gordura_g: 60 },
    metaCalorica: { tmb_kcal: 1700, piso_kcal: 1500, meta_kcal: 1360 },
    pesoKg: 71,
    temFibraOuVegetais: true,
  });
  assert.deepEqual(alertas, []);
});
