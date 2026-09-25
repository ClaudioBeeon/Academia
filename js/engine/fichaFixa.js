// js/engine/fichaFixa.js
//
// Resolve a ficha prescrita (data/ficha.json) em exercícios prontos pra tela,
// substituindo o gerador automático.
//
// Motivo (auditoria 2026-08-23): o gerador derivava a sessão de fórmulas de
// volume e acabava invertendo a prioridade declarada — tríceps com 20,5 séries
// semanais contra 12 do peito — e produzindo 21 séries de empurrar contra 6 de
// puxar, proporção que reforça ombros e pescoço pra frente. Uma ficha fixa
// resolve isso na origem: cada exercício, série, descanso e cadência está
// escrito de propósito e é auditável linha a linha.
//
// O gerador NÃO foi removido: continua como fallback pra qualquer dia que a
// ficha não cubra, e os testes dele seguem valendo.

export function obterDiaDaFicha(ficha, numeroDoDia) {
  if (!ficha?.dias) return null;
  return ficha.dias.find((d) => d.numero === numeroDoDia) ?? null;
}

// Cada exercício sai com o objeto do catálogo + `seriesAlvo` (consumido pela
// fila e pela execução) + `prescricao` (faixa de reps, RIR, descanso, cadência
// e os textos de execução). A prescrição tem precedência sobre o padrão por
// tipo de exercício do protocolo.json — é o que permite, por exemplo, que a
// cadeira extensora peça RIR 0 enquanto o stiff pede RIR 3.
export function montarSessaoDaFicha({ ficha, numeroDoDia, todosExercicios }) {
  const dia = obterDiaDaFicha(ficha, numeroDoDia);
  if (!dia) return null;

  const porId = new Map(todosExercicios.map((e) => [e.id, e]));
  const exercicios = [...dia.exercicios]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((prescricao) => {
      const exercicio = porId.get(prescricao.exercicioId);
      if (!exercicio) return null;
      return { ...exercicio, seriesAlvo: prescricao.series, prescricao };
    })
    .filter(Boolean);

  if (exercicios.length === 0) return null;
  return { dia, exercicios };
}

// Mesociclo (auditoria 2026-09-24). Bloco de 7 semanas que recomeça
// sozinho: 6 semanas de treino + 1 de deload. Antes o bloco tinha 4+1 e a
// semana saturava em 5 — o app ficava em deload pra sempre depois do 28º
// dia, porque nada reiniciava a data de início.
//
// - Semana 1: entrada — RIR-alvo de cada exercício +1 e sem falha.
// - Semanas 2–3: a ficha como está.
// - Semanas 4–6: +1 série em peito e bíceps, a não ser que exista sinal de
//   fadiga (queda de desempenho) — nesse caso segura o volume.
// - Semana 7: deload — metade das séries arredondando pra cima, mesma
//   carga, RIR-alvo +2 (mínimo 3) e sem falha.
// Um só RIR por exercício: a ficha define o RIR de cada exercício e a
// semana só o desloca. A rampa semanal antiga (3/2/2/1) nunca era aplicada
// pela tela e contradizia o RIR do exercício.
export const SEMANAS_DE_TREINO = 6;
export const SEMANA_DELOAD = 7;
export const DURACAO_BLOCO_SEMANAS = 7;
const MUSCULOS_PRIORIZADOS = new Set(["peito", "biceps"]);
const PRIMEIRA_SEMANA_COM_SERIE_EXTRA = 4;

function comPrescricao(e, patch) {
  if (!e.prescricao) return e;
  return { ...e, prescricao: { ...e.prescricao, ...patch } };
}

export function aplicarSemanaDoMesociclo(exercicios, semana, { fadigaDetectada = false } = {}) {
  if (!semana) return exercicios;

  if (semana === SEMANA_DELOAD) {
    return exercicios.map((e) => {
      const rir = e.prescricao?.rirAlvo;
      return comPrescricao(
        { ...e, seriesAlvo: Math.max(1, Math.ceil((e.seriesAlvo ?? 3) / 2)) },
        { rirAlvo: rir == null ? 3 : Math.max(3, rir + 2), falhaNaUltimaSerie: false },
      );
    });
  }

  if (semana === 1) {
    return exercicios.map((e) => {
      const rir = e.prescricao?.rirAlvo;
      return rir == null ? e : comPrescricao(e, { rirAlvo: rir + 1, falhaNaUltimaSerie: false });
    });
  }

  if (semana >= PRIMEIRA_SEMANA_COM_SERIE_EXTRA && semana <= SEMANAS_DE_TREINO && !fadigaDetectada) {
    return exercicios.map((e) =>
      MUSCULOS_PRIORIZADOS.has(e.musculoPrimario)
        ? { ...e, seriesAlvo: (e.seriesAlvo ?? 3) + 1 }
        : e
    );
  }

  return exercicios;
}

function diasEntre(deISO, ateISO) {
  const de = new Date(`${deISO}T00:00:00`);
  const ate = new Date(`${ateISO}T00:00:00`);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) return null;
  return Math.round((ate - de) / 86400000);
}

// Semana do bloco (1–7) a partir da data de início. Depois da semana 7 o
// bloco recomeça sozinho na 1. Sem data de início, assume semana 1 — nunca
// "adivinha" uma semana avançada.
export function calcularSemanaDoBloco(dataInicioISO, hojeISO) {
  if (!dataInicioISO || !hojeISO) return 1;
  const dias = diasEntre(dataInicioISO, hojeISO);
  if (dias == null || dias < 0) return 1;
  return (Math.floor(dias / 7) % DURACAO_BLOCO_SEMANAS) + 1;
}

function somarDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Data de início que coloca "hoje" no primeiro dia da semana de deload —
// é assim que o deload antecipado (reativo) é disparado sem estado extra:
// passados os 7 dias, o bloco volta sozinho pra semana 1.
export function inicioParaDeloadAgora(hojeISO) {
  return somarDias(hojeISO, -(SEMANA_DELOAD - 1) * 7);
}

export function descreverSemana(semana) {
  if (semana === SEMANA_DELOAD) return "deload";
  if (semana === 1) return "entrada";
  if (semana >= PRIMEIRA_SEMANA_COM_SERIE_EXTRA) return "+1 série em peito e bíceps";
  return "base";
}

// Quando falta tempo (auditoria 2026-09-24): a regra antiga "corte de
// baixo pra cima" cortava o bíceps do dia 2, que fica no fim da sessão —
// 16 dias sem série direta de bíceps nos dados reais. Agora cada exercício
// cortável tem `corte` na ficha (1 = o primeiro a sair) e peito/bíceps não
// têm: nunca entram na lista.
export function ordemDeCorte(exercicios) {
  return exercicios
    .filter((e) => e.prescricao?.corte != null && !MUSCULOS_PRIORIZADOS.has(e.musculoPrimario))
    .sort((a, b) => a.prescricao.corte - b.prescricao.corte);
}
