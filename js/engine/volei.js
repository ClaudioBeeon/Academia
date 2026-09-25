// js/engine/volei.js
//
// Regras do programa de levantamento (js/data/programaVolei.js): em que
// semana a pessoa está, o sorteio do "alvo sorteado" (que vai ficando mais
// variado com as semanas) e a evolução dos testes. Motor puro.
import { ALTURAS_SORTEIO, DISTANCIAS_SORTEIO, TIPOS_SORTEIO } from "../data/programaVolei.js";

export const SEMANAS_DO_PROGRAMA = 6;

function diasEntre(deISO, ateISO) {
  return Math.round((new Date(`${ateISO}T00:00:00`) - new Date(`${deISO}T00:00:00`)) / 86400000);
}

// Semana 1–6 a partir do início. Depois da 6ª o programa está concluído e
// a pessoa continua na 6 (reteste) até recomeçar.
export function calcularSemanaVolei(inicioISO, hojeISO) {
  if (!inicioISO || !hojeISO) return { semana: 1, concluido: false };
  const dias = diasEntre(inicioISO, hojeISO);
  if (!Number.isFinite(dias) || dias < 0) return { semana: 1, concluido: false };
  const semana = Math.floor(dias / 7) + 1;
  return { semana: Math.min(SEMANAS_DO_PROGRAMA, semana), concluido: semana > SEMANAS_DO_PROGRAMA };
}

// Semana 2: só 2 alturas e distância fixa; semana 3+: 3 alturas e 2
// distâncias; semana 4+: sorteia também frente ou costas.
export function sortearAlvo(semana, aleatorio = Math.random) {
  const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length) % lista.length];
  const alturas = semana <= 2 ? [ALTURAS_SORTEIO[0], ALTURAS_SORTEIO[2]] : ALTURAS_SORTEIO;
  return {
    altura: escolher(alturas),
    distancia: semana <= 2 ? DISTANCIAS_SORTEIO[0] : escolher(DISTANCIAS_SORTEIO),
    tipo: semana >= 4 ? escolher(TIPOS_SORTEIO) : TIPOS_SORTEIO[0],
  };
}

export function taxaDeAcerto(acertos, tentativas) {
  if (!(tentativas > 0) || acertos == null) return null;
  return Math.round((Math.min(acertos, tentativas) / tentativas) * 100);
}

// Pontos de um teste ao longo do tempo, pro gráfico.
export function serieDoTeste(sessoes, idTeste) {
  return sessoes
    .filter((s) => Number.isFinite(s.testes?.[idTeste]))
    .map((s) => ({ data: s.data, valor: s.testes[idTeste] }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
