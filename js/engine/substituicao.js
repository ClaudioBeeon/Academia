// js/engine/substituicao.js
export function sugerirSubstitutos(exercicioAtualId, exercicios, limite = 3) {
  const atual = exercicios.find((e) => e.id === exercicioAtualId);
  if (!atual) return [];

  return exercicios
    .filter(
      (e) =>
        e.id !== atual.id &&
        e.musculoPrimario === atual.musculoPrimario &&
        e.tipo === atual.tipo
    )
    .slice(0, limite);
}
