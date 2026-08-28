// js/engine/readiness.js
//
// Sintetiza sinais espalhados (sono, álcool, consistência) num único número
// de 0-100 pra dar uma leitura rápida de "como você está hoje" sem precisar
// ler três cards separados (mesmo espírito do apontarCausaProvavelDesempenho
// em autorregulacao.js, mas resumido num placar em vez de uma frase). Só
// soma o que já é medido — nunca inventa dado nem decide nada sozinho.

const PESOS = {
  sonoRuim: 35,
  sonoMedio: 15,
  alcool: 20,
  semSequencia: 15,
};

export function calcularReadiness({ sonoOntem = null, alcoolOntem = false, sequenciaDias = 0 } = {}) {
  let score = 100;
  const fatores = [];

  if (sonoOntem === "ruim") {
    score -= PESOS.sonoRuim;
    fatores.push("Sono ruim ontem");
  } else if (sonoOntem === "medio") {
    score -= PESOS.sonoMedio;
    fatores.push("Sono médio ontem");
  }

  if (alcoolOntem) {
    score -= PESOS.alcool;
    fatores.push("Álcool recente");
  }

  if (sequenciaDias === 0) {
    score -= PESOS.semSequencia;
    fatores.push("Sequência zerada");
  }

  score = Math.max(0, Math.min(100, score));

  let categoria;
  if (score >= 80) categoria = "otimo";
  else if (score >= 60) categoria = "bom";
  else if (score >= 40) categoria = "atencao";
  else categoria = "baixo";

  return { score, categoria, fatores };
}
