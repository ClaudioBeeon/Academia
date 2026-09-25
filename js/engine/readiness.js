// js/engine/readiness.js
//
// Sintetiza sinais espalhados (sono, álcool, consistência, creatina,
// proteína, treino do dia) num único número de 0-100 pra dar uma leitura
// rápida de "como você está hoje" sem precisar ler vários cards separados.
// Virou uma mistura de recuperação (sono/álcool/sequência) com checklist do
// dia (creatina/proteína/treino) — decisão deliberada: 100 logo de manhã,
// antes de fazer qualquer coisa, era enganoso. Só soma o que já é medido —
// nunca inventa dado nem decide nada sozinho.
//
// Auditoria 2026-09-24: saíram "sequência zerada" e "creatina não marcada
// hoje". Um dia de descanso MELHORA a recuperação — descontar por ele era
// lógica invertida. E os estoques musculares de creatina levam ~30 dias pra
// cair depois de parar (Hultman 1996): um dia sem tomar não muda nada no
// músculo. Os dois continuam existindo como hábito (card e sequência), só
// não entram mais nesta nota.

const PESOS = {
  sonoRuim: 30,
  sonoMedio: 12,
  alcool: 18,
  proteinaAbaixoDaMeta: 10,
  semTreinoHoje: 8,
};

export function calcularReadiness({
  sonoOntem = null,
  alcoolOntem = false,
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
