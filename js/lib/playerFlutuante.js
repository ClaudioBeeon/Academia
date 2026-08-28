// js/lib/playerFlutuante.js
//
// Estado da música tocando minimizada — mesmo padrão de
// js/lib/timerFlutuante.js: um módulo é um singleton, sobrevive a qualquer
// troca de aba/tela, ao contrário de uma variável presa no closure de uma
// tela específica. É isso que permite continuar ouvindo (SoundCloud ou
// YouTube) enquanto navega pelo resto do app.
let estado = null;
const ouvintes = new Set();

/**
 * `estado` esperado: { tipo: "youtube" | "soundcloud", src, titulo }.
 */
export function definirPlayerFlutuante(novoEstado) {
  estado = novoEstado;
  notificar();
}

export function limparPlayerFlutuante() {
  estado = null;
  notificar();
}

export function obterPlayerFlutuante() {
  return estado;
}

export function aoMudarPlayerFlutuante(callback) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

function notificar() {
  for (const callback of ouvintes) callback(estado);
}
