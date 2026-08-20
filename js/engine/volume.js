export function calcularVolumeSemanal(series) {
  const porMusculo = {};
  for (const serie of series) {
    if (serie.tipoSerie === "aquecimento") continue;
    porMusculo[serie.musculo] = (porMusculo[serie.musculo] ?? 0) + (serie.contribuicao ?? 0);
  }
  return { porMusculo, principio: "P1", secao: "1" };
}
