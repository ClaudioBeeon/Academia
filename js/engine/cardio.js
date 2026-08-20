// js/engine/cardio.js
// Sem hora-do-dia registrada em historicoSeries (só data), não dá pra
// calcular regrasCardio.separacaoTemporalHoras (6h) nem a ordem
// musculação-antes-de-cardio com precisão — fora de escopo por falta de
// dado. Cobre: modalidade a evitar em dia de pernas (corrida, sempre —
// dano por impacto independe da intensidade percebida), qualquer
// modalidade moderada/intensa (>=3) em dia de pernas, e frequência
// semanal de cardio moderado/intenso acima da faixa recomendada (3-4x).
export function avaliarCardio({ modalidade, intensidadePercebida, ehDiaDePernas, cardiosIntensosUltimos7Dias }) {
  const alertas = [];

  if (modalidade === "corrida" && ehDiaDePernas) {
    alertas.push({
      tipo: "modalidade_nao_recomendada",
      mensagem: "Corrida pode interferir na recuperação de pernas hoje; bicicleta, elíptico ou escada são as opções preferidas.",
      principio: "regrasCardio",
    });
  } else if (intensidadePercebida >= 3 && ehDiaDePernas) {
    alertas.push({
      tipo: "intenso_dia_pernas",
      mensagem: "Cardio moderado ou intenso no dia de pernas pode competir pela recuperação do único dia de treino desse grupo na semana — considere reduzir a intensidade hoje.",
      principio: "regrasCardio",
    });
  }

  if (cardiosIntensosUltimos7Dias >= 5) {
    alertas.push({
      tipo: "frequencia_alta",
      mensagem: "Você já tem 5 ou mais sessões de cardio moderado/intenso nos últimos 7 dias — a faixa recomendada é 3-4x por semana.",
      principio: "regrasCardio",
    });
  }

  return alertas;
}
