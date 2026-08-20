// js/engine/sequenciaSemanal.js
//
// Sequência de 5 dias fornecida pelo usuário (sequenciasemanaltreino.md),
// substituindo a divisão binária Superior/Inferior. Peito aparece 3x por
// ciclo (frequência, não volume — protocolo.json continua controlando o
// volume-alvo via musculoEmManutencao/musculoPriorizadoCrescimento). Dias
// 1 e 5 são idênticos de propósito (mesmo par de músculos), por isso a
// rotação precisa de um número de dia explícito e persistido — não dá pra
// inferir "dia 1 ou dia 5" só olhando o músculo da última série.

export const DIAS_SEQUENCIA = [
  { numero: 1, titulo: "Peito + Tríceps", musculos: ["peito", "triceps"] },
  { numero: 2, titulo: "Costas + Bíceps", musculos: ["costas", "biceps"] },
  { numero: 3, titulo: "Peito + Ombro", musculos: ["peito", "ombro"] },
  { numero: 4, titulo: "Pernas", musculos: ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"] },
  { numero: 5, titulo: "Peito + Tríceps", musculos: ["peito", "triceps"] },
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
  if (ultimoRegistro.data === hoje) return ultimoRegistro.dia;
  return proximoDia(ultimoRegistro.dia);
}

export function obterDiaPeloMusculo(musculo) {
  return DIAS_SEQUENCIA.find((d) => d.musculos.includes(musculo)) ?? null;
}
