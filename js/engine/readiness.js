// js/engine/readiness.js
//
// Sintetiza sinais espalhados (sono, álcool, consistência, creatina,
// proteína, treino do dia) num único número de 0-100 pra dar uma leitura
// rápida de "como você está hoje" sem precisar ler vários cards separados.
// Virou uma mistura de recuperação (sono/álcool/sequência) com checklist do
// dia (creatina/proteína/treino) — decisão deliberada: 100 logo de manhã,
// antes de fazer qualquer coisa, era enganoso. Só soma o que já é medido —
// nunca inventa dado nem decide nada sozinho.

const PESOS = {
  sonoRuim: 30,
  sonoMedio: 12,
  alcool: 18,
  semSequencia: 12,
  semCreatina: 10,
  proteinaAbaixoDaMeta: 10,
  semTreinoHoje: 8,
};

export function calcularReadiness({
  sonoOntem = null,
  alcoolOntem = false,
  sequenciaDias = 0,
  creatinaHoje = null,
  proteinaAbaixoDaMeta = false,
  treinouHoje = false,
} = {}) {
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

  // `null` = hábito ainda não perguntado nem marcado hoje — mesmo caso de
  // "ainda não". `false` é explícito (só existe se um dia isso virar uma
  // pergunta de sim/não/ainda-não com 3 estados); hoje o chip só marca true.
  if (creatinaHoje !== true) {
    score -= PESOS.semCreatina;
    fatores.push("Creatina ainda não marcada hoje");
  }

  if (proteinaAbaixoDaMeta) {
    score -= PESOS.proteinaAbaixoDaMeta;
    fatores.push("Proteína do dia abaixo da meta");
  }

  if (!treinouHoje) {
    score -= PESOS.semTreinoHoje;
    fatores.push("Ainda não treinou hoje");
  }

  score = Math.max(0, Math.min(100, score));

  let categoria;
  if (score >= 80) categoria = "otimo";
  else if (score >= 60) categoria = "bom";
  else if (score >= 40) categoria = "atencao";
  else categoria = "baixo";

  return { score, categoria, fatores };
}
