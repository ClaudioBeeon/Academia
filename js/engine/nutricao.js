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

// Piso de gordura: mesma constante que o alerta usa, exportada pra barra da
// tela poder desenhar "quanto falta" em vez de só avisar quando falha.
export function pisoGorduraDiaria(pesoKg) {
  if (!(pesoKg > 0)) return null;
  return Math.round(pesoKg * GORDURA_PISO_G_POR_KG * 10) / 10;
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
      : "Ainda na fórmula padrão — sem dieta registrada suficiente pra recalibrar pelo peso real (ver calcularMetaCaloricaAdaptativa).",
  };
}

// kcal por kg de gordura corporal — constante padrão de balanço energético
// (1kg de gordura ≈ 7700kcal), usada pra converter variação de peso em
// déficit/superávit real.
const KCAL_POR_KG_GORDURA = 7700;

function diferencaDias(dataA, dataB) {
  const a = new Date(`${dataA}T00:00:00`);
  const b = new Date(`${dataB}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

// Meta calórica adaptativa (mesmo princípio do TDEE dinâmico do MacroFactor):
// em vez de confiar só na fórmula de TMB — que erra facilmente ±10-15% pra
// qualquer pessoa específica (Mifflin-St Jeor é uma média populacional) —
// compara o que a pessoa comeu de verdade com o que a balança mostrou no
// mesmo período, e infere o gasto calórico REAL. Precisa de pelo menos
// DIAS_MINIMOS_CALIBRACAO dias com peso E dieta registrados no mesmo
// intervalo; sem isso, cai pro cálculo padrão (fórmula × déficit) — nunca
// trava a tela nem inventa dado que não existe.
export function calcularMetaCaloricaAdaptativa({ tmb, fase = "definicao", historicoPesoTendencia = [], totaisDiariosRecentes = [] }) {
  const padrao = calcularMetaCalorica({ tmb, fase, historicoPesoTendencia });
  if (!padrao) return null;

  const pesos = [...historicoPesoTendencia]
    .filter((m) => m.peso_kg > 0)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (pesos.length < 2 || totaisDiariosRecentes.length < DIAS_MINIMOS_CALIBRACAO) {
    return { ...padrao, adaptativa: false, tdeeEstimado: null };
  }

  const primeira = pesos[0];
  const ultima = pesos[pesos.length - 1];
  const dias = diferencaDias(primeira.data, ultima.data);
  if (dias < DIAS_MINIMOS_CALIBRACAO) {
    return { ...padrao, adaptativa: false, tdeeEstimado: null };
  }

  const variacaoPesoKg = ultima.peso_kg - primeira.peso_kg;
  const mediaIngestaoKcal = totaisDiariosRecentes.reduce((soma, t) => soma + t.kcal, 0) / totaisDiariosRecentes.length;
  const tdeeEstimado = mediaIngestaoKcal - (variacaoPesoKg * KCAL_POR_KG_GORDURA) / dias;

  if (!(tdeeEstimado > 0)) return { ...padrao, adaptativa: false, tdeeEstimado: null };

  const deficitPadrao = fase === "definicao" ? 0.2 : 0;
  const meta = Math.max(Math.round(tdeeEstimado * (1 - deficitPadrao)), padrao.piso_kcal);

  return {
    meta_kcal: meta,
    tmb_kcal: tmb,
    piso_kcal: padrao.piso_kcal,
    emCalibracao: false,
    adaptativa: true,
    tdeeEstimado: Math.round(tdeeEstimado),
    obs: `Meta recalibrada com base no seu peso real dos últimos ${dias} dias (gasto calórico estimado: ${Math.round(tdeeEstimado)} kcal/dia) — não é mais só a fórmula.`,
  };
}

// Meta de proteína — protocolo.json.regrasNutricao.proteina. Em déficit a
// faixa é mais alta (1,8-2,2 g/kg em vez de 1,6-2,2) porque é a proteína que
// protege massa magra durante a perda de peso (seção 19 da pesquisa, ponto de
// quebra de Morton 2018 em ~1,6 g/kg com IC subindo até ~2,2).
const PROTEINA_G_POR_KG = { padrao: { min: 1.6, max: 2.2 }, deficit: { min: 1.8, max: 2.2 } };

export function calcularMetaProteina({ pesoKg, fase = "definicao" }) {
  if (!pesoKg || pesoKg <= 0) return null;
  const emDeficit = fase === "definicao";
  const faixa = emDeficit ? PROTEINA_G_POR_KG.deficit : PROTEINA_G_POR_KG.padrao;
  return {
    min_g: Math.round(pesoKg * faixa.min),
    max_g: Math.round(pesoKg * faixa.max),
    g_por_kg: faixa,
    emDeficit,
  };
}

// Só sinaliza abaixo do mínimo. Acima do máximo não é alerta: proteína extra
// não faz mal, só não entrega ganho adicional — avisar seria ruído.
export function avaliarProteinaDoDia({ proteinaG, metaProteina }) {
  if (!metaProteina || proteinaG == null) return null;
  if (proteinaG >= metaProteina.min_g) {
    return { status: "ok", faltam_g: 0 };
  }
  return {
    status: "abaixo",
    faltam_g: Math.round(metaProteina.min_g - proteinaG),
  };
}

// Meta de fibra — 14g por 1000kcal é a referência do USDA/Institute of
// Medicine (mesma base usada nos rótulos de "% valor diário" americanos),
// escalada pela meta calórica do dia em vez de um número fixo pra fazer
// sentido tanto em déficit quanto fora dele.
const FIBRA_G_POR_1000KCAL = 14;

export function calcularMetaFibra(kcalMeta) {
  if (!(kcalMeta > 0)) return null;
  return Math.round((kcalMeta / 1000) * FIBRA_G_POR_1000KCAL);
}

// checagemTresEixos (protocolo.json): calorias, gordura, fibra/variedade.
// Cada eixo só sinaliza — nunca reescreve a dieta nem prescreve substituição.
export function checarAdequacaoNutricional({ totalDia, metaCalorica, pesoKg, fibraG = null, metaProteina = null }) {
  const alertas = [];
  if (!totalDia || !metaCalorica) return alertas;

  const proteina = avaliarProteinaDoDia({ proteinaG: totalDia.proteina_g, metaProteina });
  if (proteina?.status === "abaixo") {
    alertas.push({
      eixo: "proteina",
      mensagem: `${totalDia.proteina_g.toFixed(0)}g de proteína hoje — faltam ${proteina.faltam_g}g pra meta mínima de ${metaProteina.min_g}g. Em déficit, proteína abaixo da meta é o que mais custa massa magra.`,
    });
  }

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

  return alertas.concat(checarFibraEVariedade(fibraG, metaCalorica));
}

function checarFibraEVariedade(fibraG, metaCalorica) {
  const alertas = [];
  const metaFibra = calcularMetaFibra(metaCalorica?.meta_kcal);
  const fibraDoDia = fibraG ?? 0;
  if (metaFibra != null && fibraDoDia < metaFibra) {
    alertas.push({
      eixo: "fibraEVariedade",
      mensagem: `${fibraDoDia.toFixed(1)}g de fibra hoje — referência é ~${metaFibra}g pra essa meta calórica (14g/1000kcal, USDA). Não é urgente, mas fibra baixa por muito tempo é uma lacuna de micronutrientes/saúde intestinal a considerar.`,
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
