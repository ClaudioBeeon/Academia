// js/engine/consistencia.js
//
// Sequência de dias consecutivos com pelo menos uma atividade registrada
// (treino, cardio ou refeição marcada) — mesma mecânica de streak que
// qualquer app de hábito usa pra reforçar consistência (Strava, Duolingo).
// Motor puro: recebe um conjunto de datas "ativas", nunca toca DOM/IndexedDB.
function subtrairDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * `datasComAtividade` é qualquer iterável de strings "AAAA-MM-DD". Conta
 * pra trás a partir de hoje. Hoje ainda sem nada registrado não quebra a
 * sequência — só não entra na contagem até a pessoa registrar algo (senão
 * a sequência "zeraria" toda manhã antes do primeiro treino/refeição do
 * dia, o que seria enganoso).
 */
export function calcularSequenciaDias(datasComAtividade, hoje) {
  const datas = new Set(datasComAtividade);
  let cursor = datas.has(hoje) ? hoje : subtrairDias(hoje, 1);
  let contador = 0;
  while (datas.has(cursor)) {
    contador++;
    cursor = subtrairDias(cursor, 1);
  }
  return contador;
}
