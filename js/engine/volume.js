// js/engine/volume.js
//
// Volume por músculo contando séries indiretas (auditoria 2026-09-24). O
// histórico grava cada série só com o músculo primário (contribuicao 1.0);
// a contribuição fracionada (secundários com 0,5 no catálogo) é calculada
// na leitura, a partir do catálogo — assim não precisa migrar dados antigos
// e uma correção no catálogo vale retroativamente.
//
// `expandirContribuicoes` transforma cada série em uma entrada por músculo
// ({ ...serie, musculo, contribuicao, direta }). Séries de exercício fora do
// catálogo continuam como estavam gravadas.
export function expandirContribuicoes(series, catalogo = []) {
  const porId = new Map(catalogo.map((e) => [e.id, e]));
  const resultado = [];
  for (const serie of series) {
    const exercicio = porId.get(serie.exercicioId);
    if (!exercicio) {
      resultado.push({ ...serie, contribuicao: serie.contribuicao ?? 1, direta: true });
      continue;
    }
    resultado.push({ ...serie, musculo: exercicio.musculoPrimario, contribuicao: 1, direta: true });
    for (const secundario of exercicio.musculosSecundarios ?? []) {
      if (!(secundario.contribuicao > 0)) continue;
      resultado.push({ ...serie, musculo: secundario.musculo, contribuicao: secundario.contribuicao, direta: false });
    }
  }
  return resultado;
}

export function calcularVolumeSemanal(series) {
  const porMusculo = {};
  for (const serie of series) {
    if (serie.tipoSerie === "aquecimento") continue;
    porMusculo[serie.musculo] = (porMusculo[serie.musculo] ?? 0) + (serie.contribuicao ?? 0);
  }
  return { porMusculo, principio: "P1", secao: "1" };
}
