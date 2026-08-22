// js/engine/nutricao.js
//
// Motor puro de nutrição (spec seção 7, protocolo.json > regrasNutricao).
// Nunca toca DOM/IndexedDB. Nunca decide o que o usuário deve comer —
// só calcula estimativas e sinaliza lacunas, sempre com explicação.

const DIAS_MINIMOS_CALIBRACAO = 14; // 2 semanas (protocolo: "2-3 semanas")
const PERCENTUAL_MAXIMO_DEFICIT = 0.25;
const PISO_CALORICO_ABSOLUTO = 1500;
const GORDURA_PISO_G_POR_KG = 0.5;

export function calcularTMB({ sexo, pesoKg, alturaCm, idade }) {
  if (!(pesoKg > 0) || !(alturaCm > 0) || !(idade > 0)) return null;
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
  return Math.round(sexo === "feminino" ? base - 161 : base + 5);
}

export function pisoCaloricoSeguranca(tmb) {
  return Math.max(PISO_CALORICO_ABSOLUTO, tmb ?? 0);
}

// Fase "definicao" (déficit moderado): sem histórico suficiente de peso pra
// calibrar de verdade, usa um déficit padrão conservador sobre a TMB e avisa
// que a estimativa ainda não foi calibrada com dados reais do usuário
// (protocolo.json > regrasNutricao > faseCalibracao).
export function calcularMetaCalorica({ tmb, fase = "definicao", historicoPesoTendencia = [] }) {
  if (!(tmb > 0)) return null;
  const piso = pisoCaloricoSeguranca(tmb);
  const emCalibracao = historicoPesoTendencia.length < DIAS_MINIMOS_CALIBRACAO;

  const deficitPadrao = fase === "definicao" ? 0.2 : 0;
  let meta = Math.round(tmb * (1 - deficitPadrao));
  meta = Math.max(meta, piso);

  return {
    meta_kcal: meta,
    tmb_kcal: tmb,
    piso_kcal: piso,
    emCalibracao,
    obs: emCalibracao
      ? "Estimativa ainda em calibração (menos de 2 semanas de dados de peso) — usando fórmula padrão com déficit moderado."
      : "Meta ajustada pela tendência de peso registrada.",
  };
}

// checagemTresEixos (protocolo.json): calorias, gordura, fibra/variedade.
// Cada eixo só sinaliza — nunca reescreve a dieta nem prescreve substituição.
export function checarAdequacaoNutricional({ totalDia, metaCalorica, pesoKg, temFibraOuVegetais = false }) {
  const alertas = [];
  if (!totalDia || !metaCalorica) return alertas;

  const deficitReal = metaCalorica.tmb_kcal > 0
    ? (metaCalorica.tmb_kcal - totalDia.kcal) / metaCalorica.tmb_kcal
    : 0;
  if (totalDia.kcal < metaCalorica.piso_kcal) {
    alertas.push({
      eixo: "calorias",
      mensagem: `${totalDia.kcal} kcal ficou abaixo do piso de segurança (${metaCalorica.piso_kcal} kcal). Déficit muito agressivo pode custar massa magra e desempenho — considere ajustar.`,
    });
  } else if (deficitReal > PERCENTUAL_MAXIMO_DEFICIT) {
    alertas.push({
      eixo: "calorias",
      mensagem: `Déficit estimado de ${Math.round(deficitReal * 100)}% está acima do moderado (até 25%). Vale rever com calma.`,
    });
  }

  if (pesoKg > 0) {
    const gorduraPorKg = totalDia.gordura_g / pesoKg;
    if (gorduraPorKg < GORDURA_PISO_G_POR_KG) {
      alertas.push({
        eixo: "gordura",
        mensagem: `${totalDia.gordura_g.toFixed(1)}g de gordura hoje (~${gorduraPorKg.toFixed(2)}g/kg) está abaixo do piso razoável de ${GORDURA_PISO_G_POR_KG}g/kg. Gordura muito baixa por muito tempo afeta hormônios.`,
      });
    }
  }

  return alertas.concat(checarFibraEVariedade(temFibraOuVegetais));
}

function checarFibraEVariedade(temFibraOuVegetais) {
  const alertas = [];
  if (!temFibraOuVegetais) {
    alertas.push({
      eixo: "fibraEVariedade",
      mensagem: "Essa dieta não tem vegetais/fontes de fibra — não é urgente, mas é uma lacuna de micronutrientes a considerar com um nutricionista.",
    });
  }

  return alertas;
}

// Cruza os últimos dias de dieta efetivamente registrada com a meta calórica
// pra decidir se "déficit consistente" é uma causa provável de queda de
// desempenho (js/engine/autorregulacao.js). Só considera dias com refeições
// de fato marcadas pelo usuário — sem dado registrado, não afirma déficit.
export function avaliarDeficitConsistente({ totaisDiarios = [], metaCalorica } = {}) {
  if (!metaCalorica || totaisDiarios.length === 0) return false;

  const diasEmDeficit = totaisDiarios.filter((total) => {
    const deficitReal = metaCalorica.tmb_kcal > 0
      ? (metaCalorica.tmb_kcal - total.kcal) / metaCalorica.tmb_kcal
      : 0;
    return total.kcal < metaCalorica.piso_kcal || deficitReal > PERCENTUAL_MAXIMO_DEFICIT;
  }).length;

  return diasEmDeficit >= Math.min(2, totaisDiarios.length);
}
