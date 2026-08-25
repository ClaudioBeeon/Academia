// js/engine/sequenciaSemanal.js
//
// Sequência de 5 dias. Os exercícios de cada dia vêm da ficha prescrita
// (data/ficha.json); esta lista fixa os títulos e a frequência por músculo,
// e é o fallback do gerador pros dias que a ficha não cobrir.
//
// Estrutura revisada pela auditoria de 2026-08-23:
// - Dia 1 deixou de ser "Peito + Tríceps" (3 exercícios, nenhum trabalho de
//   puxar) e passou a carregar costas e deltoide posterior. Era o dia mais
//   vazio da semana e virou o principal dia de correção postural.
// - Deltoide posterior virou músculo próprio, separado de "ombro": ele tinha
//   zero séries no programa antigo e é o alvo direto da queixa de ombros e
//   pescoço pra frente.
// - O desenvolvimento de ombro saiu: é press, reforça o deltoide anterior já
//   dominante, e o anterior já recebe trabalho indireto de todo supino.
// Peito segue 3x por ciclo, um ângulo por dia (inclinado/horizontal/alongado),
// sempre no primeiro exercício da sessão.

export const DIAS_SEQUENCIA = [
  { numero: 1, titulo: "Peito (inclinado) + Costas + Deltoide posterior", musculos: ["peito", "costas", "deltoide_posterior", "triceps"] },
  { numero: 2, titulo: "Costas + Bíceps", musculos: ["costas", "biceps", "deltoide_posterior"] },
  { numero: 3, titulo: "Peito (horizontal) + Ombro + Tríceps + Abdômen", musculos: ["peito", "ombro", "triceps", "abdomen"] },
  { numero: 4, titulo: "Pernas", musculos: ["quadriceps", "posterior_coxa", "gluteo", "panturrilha"] },
  { numero: 5, titulo: "Peito (alongado) + Bíceps + Ombro + Antebraço", musculos: ["peito", "biceps", "ombro", "antebraco"] },
];

export function obterDiaPorNumero(numero) {
  return DIAS_SEQUENCIA.find((d) => d.numero === numero) ?? DIAS_SEQUENCIA[0];
}

export function obterMusculosDoDia(numero) {
  return obterDiaPorNumero(numero).musculos;
}

export function proximoDia(numeroAtual) {
  return (numeroAtual % DIAS_SEQUENCIA.length) + 1;
}

export function determinarDiaDaSessao(ultimoRegistro, hoje) {
  if (!ultimoRegistro) return 1;
  // "concluido" não avança o dia sozinho — o hero card e o card de cardio
  // da Home usam esse dia pra decidir o que mostrar como "hoje", e ambos
  // têm que continuar corretos (cardio ainda pendente incluído) até a
  // virada real de data, mesmo depois do usuário terminar os exercícios.
  if (ultimoRegistro.data === hoje) return ultimoRegistro.dia;
  return proximoDia(ultimoRegistro.dia);
}

export function obterDiaPeloMusculo(musculo) {
  return DIAS_SEQUENCIA.find((d) => d.musculos.includes(musculo)) ?? null;
}
