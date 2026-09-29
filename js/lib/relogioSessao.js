// js/lib/relogioSessao.js
//
// Relógio da sessão inteira ("SESSÃO 12:34"). Aparece nas três telas em que
// o treino acontece: fila, execução e telão da série (antes só na fila, e
// é na execução que a pessoa passa quase o treino todo). Derivado de
// Date.now() a cada tick, nunca acumulado: setInterval atrasado ou pausado
// em segundo plano não desvia o valor, só precisa redesenhar na volta pro
// primeiro plano.
import { formatarDuracaoSessao } from "../engine/sessao.js";

export function montarRelogioSessao(inicioTs, { compacto = false } = {}) {
  const elemento = document.createElement("div");
  elemento.className = compacto ? "relogio-sessao compacto" : "relogio-sessao";
  elemento.innerHTML = `<span class="rot">Sessão</span><span class="t">00:00</span>`;
  const tEl = elemento.querySelector(".t");

  const atualizar = () => {
    tEl.textContent = formatarDuracaoSessao((Date.now() - inicioTs) / 1000);
  };
  atualizar();
  const intervalo = setInterval(atualizar, 1000);
  const aoVoltarAoPrimeiroPlano = () => { if (document.visibilityState !== "hidden") atualizar(); };
  document.addEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
  window.addEventListener("focus", aoVoltarAoPrimeiroPlano);

  return {
    elemento,
    parar() {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
      window.removeEventListener("focus", aoVoltarAoPrimeiroPlano);
    },
  };
}
