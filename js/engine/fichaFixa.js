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

// Ajuste de volume por semana do mesociclo. A ficha é a semana-base; as semanas
// 3 e 4 sobem uma série nos prioritários e a 5 corta pela metade (deload).
// Mantido puro pra ser testável sem DOM nem banco.
const MUSCULOS_PRIORIZADOS = new Set(["peito", "biceps"]);

export function aplicarSemanaDoMesociclo(exercicios, semana) {
  if (!semana || semana === 1 || semana === 2) return exercicios;

  if (semana === 5) {
    // Deload: metade das séries, mínimo 1, carga mantida.
    return exercicios.map((e) => ({
      ...e,
      seriesAlvo: Math.max(1, Math.floor((e.seriesAlvo ?? 3) / 2)),
    }));
  }

  // Semanas 3 e 4: +1 série nos músculos prioritários.
  return exercicios.map((e) =>
    MUSCULOS_PRIORIZADOS.has(e.musculoPrimario)
      ? { ...e, seriesAlvo: (e.seriesAlvo ?? 3) + 1 }
      : e
  );
}

// Semana do bloco a partir da data de início, 1-indexada e limitada a 5.
// Sem data de início configurada, assume semana 1 — nunca "adivinha" uma
// semana avançada, porque isso mudaria volume sem o usuário pedir.
export function calcularSemanaDoBloco(dataInicioISO, hojeISO) {
  if (!dataInicioISO || !hojeISO) return 1;
  const inicio = new Date(`${dataInicioISO}T00:00:00`);
  const hoje = new Date(`${hojeISO}T00:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(hoje.getTime())) return 1;
  const dias = Math.floor((hoje - inicio) / 86400000);
  if (dias < 0) return 1;
  return Math.min(5, Math.floor(dias / 7) + 1);
}
