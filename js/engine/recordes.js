import { serveParaEstimar1RM } from "./graficos.js";

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

  // Carga 0 (peso corporal/isometria): só o recorde de reps faz sentido.
  const temCarga = novaSerie.carga > 0;
  const maiorCargaAnterior = Math.max(...seriesAnteriores.map((s) => s.carga));
  if (temCarga && novaSerie.carga > maiorCargaAnterior) {
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

  const anterioresValidas = seriesAnteriores.filter(serveParaEstimar1RM);
  const melhor1RMAnterior = anterioresValidas.length > 0 ? Math.max(...anterioresValidas.map(estimativa1RM)) : 0;
  if (serveParaEstimar1RM(novaSerie) && anterioresValidas.length > 0 && estimativa1RM(novaSerie) > melhor1RMAnterior) {
    const valor = Math.round(estimativa1RM(novaSerie) * 10) / 10;
    prs.push({ tipo: "1rm", mensagem: `Novo recorde estimado de 1RM: ${valor} kg!`, principio, secao });
  }

  const maiorVolumeAnterior = Math.max(...seriesAnteriores.map((s) => s.carga * s.reps));
  if (temCarga && novaSerie.carga * novaSerie.reps > maiorVolumeAnterior) {
    prs.push({
      tipo: "volume",
      mensagem: `Novo recorde de volume nesta série: ${novaSerie.carga * novaSerie.reps} kg!`,
      principio,
      secao,
    });
  }

  return prs;
}

// Lista permanente de recordes por exercício (tela Evolução). Só séries de
// trabalho: aquecimento e mini-séries de drop-set/rest-pause ficam fora.
// 1RM estimado só com séries de até 12 reps (graficos.serveParaEstimar1RM).
export function listarRecordesPorExercicio(series, catalogo = []) {
  const nomePorId = new Map(catalogo.map((e) => [e.id, e.nome]));
  const porExercicio = new Map();
  for (const serie of series) {
    if (serie.tipoSerie && serie.tipoSerie !== "normal") continue;
    if (!(serie.reps > 0)) continue;
    if (!porExercicio.has(serie.exercicioId)) porExercicio.set(serie.exercicioId, []);
    porExercicio.get(serie.exercicioId).push(serie);
  }

  const resultado = [];
  for (const [exercicioId, lista] of porExercicio) {
    const comCarga = lista.filter((s) => s.carga > 0);
    const maiorCarga = comCarga.reduce((melhor, s) => (!melhor || s.carga > melhor.carga || (s.carga === melhor.carga && s.reps > melhor.reps) ? s : melhor), null);
    const maisReps = lista.reduce((melhor, s) => (!melhor || s.reps > melhor.reps || (s.reps === melhor.reps && s.carga > melhor.carga) ? s : melhor), null);
    const validas1RM = lista.filter(serveParaEstimar1RM);
    const melhor1RM = validas1RM.reduce((melhor, s) => {
      const valor = estimativa1RM(s);
      return !melhor || valor > melhor.valor ? { valor: Math.round(valor * 10) / 10, data: s.data } : melhor;
    }, null);
    resultado.push({
      exercicioId,
      nome: nomePorId.get(exercicioId) ?? exercicioId,
      maiorCarga: maiorCarga ? { carga: maiorCarga.carga, reps: maiorCarga.reps, data: maiorCarga.data } : null,
      maisReps: maisReps ? { reps: maisReps.reps, carga: maisReps.carga, data: maisReps.data } : null,
      melhor1RM,
    });
  }
  return resultado.sort((a, b) => a.nome.localeCompare(b.nome));
}
