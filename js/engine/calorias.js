// js/engine/calorias.js
//
// Estimativa de gasto calórico da sessão — musculação + cardio do dia.
// É estimativa, não medição: sem duração real de sessão registrada (o app
// só grava data por série, não início/fim), a única base honesta é o
// Compêndio de Atividades Físicas (MET) aplicado sobre um tempo médio por
// série. A tela sempre rotula isso como "estimativa", nunca como medição.
//
// Fórmula padrão de gasto calórico por MET:
//   kcal = MET × 3.5 × pesoKg / 200 × minutos
const MET_MUSCULACAO = 6.0; // treino de força moderado-intenso (Compêndio de Atividades Físicas)
const SEGUNDOS_TRABALHO_POR_SERIE_PADRAO = 40;
const DESCANSO_MEDIO_SEGUNDOS_PADRAO = 90;

const MET_POR_MODALIDADE_CARDIO = {
  bicicleta: 7.5,
  eliptico: 5.0,
  escada: 8.0,
  caminhada: 3.5,
  corrida: 9.8,
  patins: 7.0,
  volei_praia: 8.0,
  beach_tenis: 7.3,
};
const MET_CARDIO_PADRAO = 6.0;

function kcalPorMet(met, pesoKg, minutos) {
  if (!(met > 0) || !(pesoKg > 0) || !(minutos > 0)) return 0;
  return Math.round((met * 3.5 * pesoKg) / 200 * minutos);
}

export function estimarCaloriasMusculacao({ totalSeries, pesoKg, descansoMedioSegundos = DESCANSO_MEDIO_SEGUNDOS_PADRAO }) {
  if (!(totalSeries > 0) || !(pesoKg > 0)) return 0;
  const minutos = (totalSeries * (SEGUNDOS_TRABALHO_POR_SERIE_PADRAO + descansoMedioSegundos)) / 60;
  return kcalPorMet(MET_MUSCULACAO, pesoKg, minutos);
}

export function estimarCaloriasCardio({ modalidade, duracaoMinutos, pesoKg }) {
  const met = MET_POR_MODALIDADE_CARDIO[modalidade] ?? MET_CARDIO_PADRAO;
  return kcalPorMet(met, pesoKg, duracaoMinutos);
}

// Soma musculação + todos os registros de cardio do dia (pode haver mais de
// um, ex. esteira antes e bike depois). Registros sem duração informada não
// entram na conta — sem minutos não há como estimar.
export function estimarCaloriasDaSessao({ totalSeries, pesoKg, registrosCardioDoDia = [], descansoMedioSegundos }) {
  const musculacao = estimarCaloriasMusculacao({ totalSeries, pesoKg, descansoMedioSegundos });
  const cardio = registrosCardioDoDia.reduce(
    (soma, r) => soma + estimarCaloriasCardio({ modalidade: r.modalidade, duracaoMinutos: r.duracaoMinutos, pesoKg }),
    0
  );
  return { musculacao, cardio, total: musculacao + cardio };
}
