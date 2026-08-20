// js/engine/graficos.js
function estimativa1RM(serie) {
  return serie.carga * (1 + serie.reps / 30);
}

export function calcularProgressao1RM(seriesDoExercicio) {
  const porDia = new Map();
  for (const serie of seriesDoExercicio) {
    if (serie.tipoSerie === "aquecimento") continue;
    const valor = estimativa1RM(serie);
    const atual = porDia.get(serie.data);
    if (atual === undefined || valor > atual) {
      porDia.set(serie.data, valor);
    }
  }
  return [...porDia.entries()]
    .map(([data, carga1RM]) => ({ data, carga1RM }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
