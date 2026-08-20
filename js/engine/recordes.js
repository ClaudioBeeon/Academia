function estimativa1RM(serie) {
  return serie.carga * (1 + serie.reps / 30);
}

export function detectarPRs(novaSerie, seriesAnteriores) {
  const principio = "recordes";
  const secao = "prompt-original";

  if (!seriesAnteriores || seriesAnteriores.length === 0) {
    return [{ tipo: "primeira_serie", mensagem: "Primeira vez registrando este exercício!", principio, secao }];
  }

  const prs = [];

  const maiorCargaAnterior = Math.max(...seriesAnteriores.map((s) => s.carga));
  if (novaSerie.carga > maiorCargaAnterior) {
    prs.push({ tipo: "carga", mensagem: `Novo recorde de carga: ${novaSerie.carga} kg!`, principio, secao });
  }

  const repsNaMesmaCarga = seriesAnteriores
    .filter((s) => s.carga === novaSerie.carga)
    .map((s) => s.reps);
  if (repsNaMesmaCarga.length > 0 && novaSerie.reps > Math.max(...repsNaMesmaCarga)) {
    prs.push({
      tipo: "reps",
      mensagem: `Novo recorde de repetições com ${novaSerie.carga} kg: ${novaSerie.reps}!`,
      principio,
      secao,
    });
  }

  const melhor1RMAnterior = Math.max(...seriesAnteriores.map(estimativa1RM));
  if (estimativa1RM(novaSerie) > melhor1RMAnterior) {
    const valor = Math.round(estimativa1RM(novaSerie) * 10) / 10;
    prs.push({ tipo: "1rm", mensagem: `Novo recorde estimado de 1RM: ${valor} kg!`, principio, secao });
  }

  const maiorVolumeAnterior = Math.max(...seriesAnteriores.map((s) => s.carga * s.reps));
  if (novaSerie.carga * novaSerie.reps > maiorVolumeAnterior) {
    prs.push({
      tipo: "volume",
      mensagem: `Novo recorde de volume nesta série: ${novaSerie.carga * novaSerie.reps} kg!`,
      principio,
      secao,
    });
  }

  return prs;
}
