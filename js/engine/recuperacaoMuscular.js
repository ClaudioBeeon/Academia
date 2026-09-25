// js/engine/recuperacaoMuscular.js
//
// Aviso de músculo treinado há menos de ~36 h (auditoria 2026-09-24). O
// ciclo é rotativo: o dia seguinte é sempre o próximo da sequência, mesmo
// que o anterior tenha sido ontem e repita músculo (ex.: dia 5 → dia 1,
// peito nos dois). Não existe regra rígida de 48 h pra hipertrofia, mas
// depois de séries perto da falha o desempenho cai por 24–72 h — então só
// avisa, nunca bloqueia.
//
// O histórico guarda a data da série e, das séries novas em diante, o
// horário (`registradaEm`). Com horário, usa as 36 h de verdade; sem
// horário (séries antigas), "ontem" conta como menos de 36 h.
import { expandirContribuicoes } from "./volume.js";

const HORAS_LIMITE = 36;
const SERIES_DIRETAS_MINIMAS = 3;

function diasEntre(deISO, ateISO) {
  return Math.round((new Date(`${ateISO}T00:00:00`) - new Date(`${deISO}T00:00:00`)) / 86400000);
}

export function musculosTreinadosRecentemente({ todasAsSeries = [], catalogo = [], hoje, agoraMs = Date.now(), musculosDeHoje = [] }) {
  const alvo = new Set(musculosDeHoje);
  const porMusculo = new Map();

  for (const serie of expandirContribuicoes(todasAsSeries, catalogo)) {
    if (serie.tipoSerie === "aquecimento" || serie.direta === false) continue;
    if (!alvo.has(serie.musculo) || serie.data >= hoje) continue;
    const dias = diasEntre(serie.data, hoje);
    const recente = serie.registradaEm != null
      ? (agoraMs - serie.registradaEm) / 3600000 < HORAS_LIMITE
      : dias <= 1;
    if (!recente) continue;
    const atual = porMusculo.get(serie.musculo) ?? { musculo: serie.musculo, series: 0, data: serie.data };
    atual.series += 1;
    porMusculo.set(serie.musculo, atual);
  }

  return [...porMusculo.values()].filter((m) => m.series >= SERIES_DIRETAS_MINIMAS);
}
