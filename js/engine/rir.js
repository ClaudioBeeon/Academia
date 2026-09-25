// js/engine/rir.js
//
// Checagem de coerência do RIR declarado (auditoria 2026-09-24). Compara a
// capacidade (reps + RIR) de duas séries seguidas com a mesma carga: com
// descanso normal a capacidade cai ou se mantém de uma série pra outra.
// Se a série seguinte teve capacidade bem MAIOR, o RIR da anterior
// provavelmente foi declarado baixo demais — o erro mais comum, ~1 rep em
// média (Halperin 2022). A regra antiga ("mais reps na seguinte") acusava
// erro em casos coerentes, como 8 @RIR2 seguida de 9 @RIR0.
import { capacidadeDaSerie } from "./progressao.js";

export function validarRir({ serieAnterior, serieAtual }) {
  const semSuspeita = { suspeitaSubestimado: false, mensagem: null };
  if (!serieAnterior || !serieAtual) return semSuspeita;
  if (serieAnterior.carga !== serieAtual.carga) return semSuspeita;
  if (serieAnterior.rir == null || serieAtual.rir == null) return semSuspeita;

  // Acima de 12 reps a estimativa de RIR é bem menos precisa — tolera mais.
  const tolerancia = Math.max(serieAnterior.reps, serieAtual.reps) > 12 ? 2 : 1;
  const diferenca = capacidadeDaSerie(serieAtual) - capacidadeDaSerie(serieAnterior);
  if (diferenca <= tolerancia) return semSuspeita;

  return {
    suspeitaSubestimado: true,
    mensagem: `Essa série rendeu mais que a anterior com a mesma carga — na série anterior provavelmente sobravam mais que ${serieAnterior.rir}. Tudo bem: calibrar o RIR leva algumas semanas.`,
  };
}
