// Cronômetro regressivo (usado no descanso entre séries). Guarda um alvo em
// relógio de parede (Date.now() + restante), não só um contador que desce de
// 1 em 1 a cada tick — assim, quando o navegador atrasa ou pausa o
// setInterval (app em segundo plano, tela apagada, trocando de rede), o
// próximo tick real e a resincronização em foco/online recalculam o tempo
// que realmente passou em vez de continuar contando como se nada tivesse
// acontecido. tick() continua decrementando 1 por chamada — é o que os
// testes unitários exercitam — e é o próprio código de produção que passa a
// chamar resincronizar() a cada disparo real do setInterval.
export function criarCronometro({ duracaoInicialSegundos, aoAtualizar, aoFinalizar }) {
  let restante = duracaoInicialSegundos;
  let intervalId = null;
  let alvoTimestamp = null;

  function tick() {
    restante -= 1;
    aoAtualizar(restante);
    if (restante <= 0) {
      parar();
      aoFinalizar();
    }
  }

  function resincronizar(agora = Date.now()) {
    if (alvoTimestamp == null) return;
    const novoRestante = Math.max(0, Math.ceil((alvoTimestamp - agora) / 1000));
    if (novoRestante === restante) return;
    restante = novoRestante;
    aoAtualizar(restante);
    if (restante <= 0) {
      parar();
      aoFinalizar();
    }
  }

  function iniciar(setIntervalImpl = globalThis.setInterval) {
    if (intervalId) return;
    alvoTimestamp = Date.now() + restante * 1000;
    intervalId = setIntervalImpl(() => resincronizar(), 1000);
  }

  function parar(clearIntervalImpl = globalThis.clearInterval) {
    if (intervalId) {
      clearIntervalImpl(intervalId);
      intervalId = null;
    }
    alvoTimestamp = null;
  }

  // Encurtar o tempo até zero encerra o cronômetro, igual a deixar ele
  // chegar lá sozinho. Sem isso, apertar "−30" até o fim parava o relógio
  // em 00:00 sem nunca disparar aoFinalizar: resincronizar() enxergava o
  // restante já em 0, considerava que nada tinha mudado e voltava cedo —
  // então a barra de descanso ficava presa na tela.
  function ajustar(deltaSegundos) {
    restante = Math.max(0, restante + deltaSegundos);
    if (alvoTimestamp != null) alvoTimestamp = Date.now() + restante * 1000;
    aoAtualizar(restante);
    if (restante <= 0) {
      parar();
      aoFinalizar();
    }
  }

  return { iniciar, parar, ajustar, tick, resincronizar, obterRestante: () => restante };
}
