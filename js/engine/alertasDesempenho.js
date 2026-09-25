// js/engine/alertasDesempenho.js
//
// Queda de desempenho no mesmo exercício (auditoria 2026-09-24).
//
// Antes: comparava o total de reps de só 2 sessões (disparava com UMA queda,
// embora a mensagem dissesse "2 sessões seguidas") e tinha um alerta de
// "RIR subindo sem mudança de carga" — que está invertido: RIR maior com a
// mesma carga significa MAIS reserva, ou seja, você ficou mais forte. O
// total de reps também caía à toa no deload e em sessão incompleta.
//
// Agora: capacidade média por série (reps + RIR) na carga-base, e só alerta
// quando ela cai em 2 sessões seguidas (3 sessões, mesma carga), ignorando
// deload e aquecimento. Média por série não é afetada por sessão parcial
// nem pela série extra das semanas 4–6.
import { capacidadeDaSerie } from "./progressao.js";
import { ehSerieDeTrabalho } from "./volume.js";

const QUEDA_MINIMA = 0.5; // reps de capacidade média por série
const SESSOES_NECESSARIAS = 3;

function trabalho(sessao) {
  return (sessao?.series ?? []).filter((s) => ehSerieDeTrabalho(s) && s.carga != null && s.reps != null);
}

function ehDeload(sessao) {
  const t = trabalho(sessao);
  return t.length > 0 && t.every((s) => s.semanaBloco === 7);
}

function resumo(sessao) {
  const t = trabalho(sessao);
  if (t.length === 0) return null;
  const carga = Math.max(...t.map((s) => s.carga));
  const naCarga = t.filter((s) => s.carga === carga);
  const capacidade = naCarga.reduce((soma, s) => soma + capacidadeDaSerie(s), 0) / naCarga.length;
  return { carga, capacidade };
}

export function avaliarAlertasDesempenho(sessoesPorExercicio) {
  const alertas = [];

  for (const { exercicioId, sessoes } of sessoesPorExercicio) {
    const validas = sessoes.filter((s) => !ehDeload(s)).map(resumo).filter(Boolean);
    if (validas.length < SESSOES_NECESSARIAS) continue;

    const [recente, anterior, maisAntiga] = validas;
    const mesmaCarga = recente.carga === anterior.carga && anterior.carga === maisAntiga.carga;
    if (!mesmaCarga) continue;

    const caiu1 = maisAntiga.capacidade - anterior.capacidade >= QUEDA_MINIMA;
    const caiu2 = anterior.capacidade - recente.capacidade >= QUEDA_MINIMA;
    if (caiu1 && caiu2) {
      alertas.push({
        tipo: "desempenho_caindo",
        exercicioId,
        mensagem: `Desempenho caiu em 2 sessões seguidas com ${String(recente.carga).replace(".", ",")} kg (reps + RIR menores). Pode ser recuperação insuficiente — sono, déficit ou volume.`,
        principio: "gatilhosDeloadReativo",
      });
    }
  }

  return alertas;
}

// Decide se vale sugerir um deload antecipado, juntando os gatilhos da
// ficha: queda de desempenho em 2+ exercícios, dor articular persistente ou
// bem-estar baixo sustentado. Nunca aplica nada sozinho — só sugere.
export function avaliarSugestaoDeDeload({ alertasDesempenho = [], alertasRecuperacao = [] } = {}) {
  const motivos = [];
  const exerciciosCaindo = new Set(alertasDesempenho.filter((a) => a.tipo === "desempenho_caindo").map((a) => a.exercicioId));
  if (exerciciosCaindo.size >= 2) motivos.push(`desempenho caindo em ${exerciciosCaindo.size} exercícios`);
  if (alertasRecuperacao.some((a) => a.tipo === "dor_articular")) motivos.push("dor articular ou de tendão");
  if (alertasRecuperacao.some((a) => a.tipo === "bem_estar_baixo_sustentado")) motivos.push("bem-estar baixo há 3 check-ins");
  return { sugerir: motivos.length > 0, motivos, fadigaDetectada: exerciciosCaindo.size >= 1 };
}
