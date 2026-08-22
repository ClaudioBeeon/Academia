// js/engine/sequenciaSemanal.js
//
// Sequência de 5 dias — referencia-consolidada-app-treino.md seção 4.
// Peito aparece 3x por ciclo, um ângulo por dia (inclinado/horizontal/
// alongado — a rotação de exercício de fato vem do catálogo em
// exercicios.json via contadorPorMusculo, isso aqui só fixa a frequência).
// Bíceps é foco em 2 dias (2 e 5), cada um também com ombro como secundário.
// Nenhum dia é idêntico a outro em músculos — a rotação ainda precisa de um
// número de dia explícito e persistido, porque peito repete em 3 dias
// diferentes e não dá pra inferir o dia só olhando o músculo da última série.

export const DIAS_SEQUENCIA = [
  { numero: 1, titulo: "Peito (inclinado) + Tríceps", musculos: ["peito", "triceps"] },
  { numero: 2, titulo: "Costas + Bíceps + Ombro", musculos: ["costas", "biceps", "ombro"] },
  { numero: 3, titulo: "Peito (horizontal) + Tríceps + Ombro", musculos: ["peito", "triceps", "ombro"] },
  { numero: 4, titulo: "Pernas + Abdômen", musculos: ["quadriceps", "posterior_coxa", "gluteo", "panturrilha", "abdomen"] },
  { numero: 5, titulo: "Peito (alongado) + Bíceps + Ombro", musculos: ["peito", "biceps", "ombro"] },
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
  if (ultimoRegistro.data === hoje) {
    return ultimoRegistro.concluido ? proximoDia(ultimoRegistro.dia) : ultimoRegistro.dia;
  }
  return proximoDia(ultimoRegistro.dia);
}

export function obterDiaPeloMusculo(musculo) {
  return DIAS_SEQUENCIA.find((d) => d.musculos.includes(musculo)) ?? null;
}
