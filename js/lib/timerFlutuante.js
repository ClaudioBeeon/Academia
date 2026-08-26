// js/lib/timerFlutuante.js
//
// Estado do cronômetro minimizado. Um módulo ES é um singleton — sobrevive
// a qualquer troca de tela, ao contrário de uma variável presa no closure
// de uma tela específica, que morre assim que ela é desmontada. É esse
// singleton que permite minimizar o cardio (ou, no futuro, a execução) e
// continuar mexendo no resto do app com o cronômetro rodando por baixo.
let estado = null;
const ouvintes = new Set();

/**
 * `estado` esperado: { rotulo, alvoTimestamp, aoExpandir, aoEncerrar }.
 * `alvoTimestamp` é o relógio de parede em que o cronômetro zera (o mesmo
 * padrão já usado em js/screens/timer.js) — dessa forma o tempo restante
 * nunca depende de um setInterval específico continuar rodando.
 */
export function definirCronometroFlutuante(novoEstado) {
  estado = novoEstado;
  notificar();
}

export function limparCronometroFlutuante() {
  estado = null;
  notificar();
}

export function obterCronometroFlutuante() {
  return estado;
}

export function aoMudarCronometroFlutuante(callback) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

function notificar() {
  for (const callback of ouvintes) callback(estado);
}
