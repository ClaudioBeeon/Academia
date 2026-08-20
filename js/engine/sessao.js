// js/engine/sessao.js
export function calcularEstatisticasSessao(seriesDoDia) {
  const validas = seriesDoDia.filter((s) => s.tipoSerie !== "aquecimento");

  const totalSeries = validas.length;
  const volumeTotal = validas.reduce((soma, s) => soma + s.carga * s.reps, 0);
  const exercicios = new Set(validas.map((s) => s.exercicioId));
  const musculos = new Set(validas.map((s) => s.musculo));

  return {
    totalSeries,
    volumeTotal,
    exerciciosTreinados: exercicios.size,
    musculosTreinados: [...musculos].sort(),
  };
}
