// js/engine/cardio.js
// Sem hora-do-dia registrada em historicoSeries (só data), não dá pra calcular
// regrasCardio.separacaoTemporalHoras (6h) com precisão — fora de escopo por
// falta de dado. Só verifica a modalidade a evitar em dia de foco em pernas.
export function avaliarCardio({ modalidade, grupoDoDia }) {
  if (modalidade === "corrida" && grupoDoDia === "inferior") {
    return {
      tipo: "modalidade_nao_recomendada",
      mensagem: "Corrida pode interferir na recuperação de pernas hoje; bicicleta, elíptico ou escada são as opções preferidas.",
      principio: "regrasCardio",
    };
  }
  return null;
}
