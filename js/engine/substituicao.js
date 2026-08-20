// js/engine/substituicao.js
export function sugerirSubstitutos(exercicioAtualId, exercicios, limite = 3) {
  const atual = exercicios.find((e) => e.id === exercicioAtualId);
  if (!atual) return [];

  // Sem um campo de padrão de movimento em exercicios.json ainda, músculo
  // primário é a aproximação disponível (spec seção 7). Revisitar quando
  // esse campo existir para filtrar também por padrão de movimento.
  return exercicios
    .filter((e) => e.id !== atual.id && e.musculoPrimario === atual.musculoPrimario)
    .slice(0, limite);
}
