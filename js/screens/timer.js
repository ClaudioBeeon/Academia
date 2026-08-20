export function criarCronometro({ duracaoInicialSegundos, aoAtualizar, aoFinalizar }) {
  let restante = duracaoInicialSegundos;
  let intervalId = null;

  function tick() {
    restante -= 1;
    aoAtualizar(restante);
    if (restante <= 0) {
      parar();
      aoFinalizar();
    }
  }

  function iniciar(setIntervalImpl = globalThis.setInterval) {
    if (intervalId) return;
    intervalId = setIntervalImpl(tick, 1000);
  }

  function parar(clearIntervalImpl = globalThis.clearInterval) {
    if (intervalId) {
      clearIntervalImpl(intervalId);
      intervalId = null;
    }
  }

  function ajustar(deltaSegundos) {
    restante = Math.max(0, restante + deltaSegundos);
    aoAtualizar(restante);
  }

  return { iniciar, parar, ajustar, tick, obterRestante: () => restante };
}
