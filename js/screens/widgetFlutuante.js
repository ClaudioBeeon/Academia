// js/screens/widgetFlutuante.js
//
// Bolha flutuante do cronômetro minimizado — fica montada uma única vez,
// fora de #tab-content (sobrevive a qualquer troca de aba/tela), e só
// aparece quando existe um cronômetro ativo em js/lib/timerFlutuante.js.
import { obterCronometroFlutuante, aoMudarCronometroFlutuante } from "../lib/timerFlutuante.js";

function formatarRelogio(segundosTotais) {
  const segundos = Math.max(0, Math.round(segundosTotais));
  const min = String(Math.floor(segundos / 60)).padStart(2, "0");
  const seg = String(segundos % 60).padStart(2, "0");
  return `${min}:${seg}`;
}

export function montarWidgetFlutuante() {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "widget-flutuante";
  el.hidden = true;
  el.innerHTML = `
    <span class="wf-anel"><svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="none" stroke-width="4" class="wf-trilha" />
      <circle cx="20" cy="20" r="17" fill="none" stroke-width="4" class="wf-progresso" transform="rotate(-90 20 20)" />
    </svg></span>
    <span class="wf-texto"><span class="wf-rot"></span><span class="wf-t">00:00</span></span>
  `;
  const rotEl = el.querySelector(".wf-rot");
  const tEl = el.querySelector(".wf-t");
  const progressoEl = el.querySelector(".wf-progresso");
  const RAIO = 17;
  const PERIMETRO = 2 * Math.PI * RAIO;
  progressoEl.style.strokeDasharray = String(PERIMETRO);

  let intervalId = null;

  function pararTick() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  function atualizar() {
    const atual = obterCronometroFlutuante();
    if (!atual) {
      el.hidden = true;
      pararTick();
      return;
    }
    el.hidden = false;
    rotEl.textContent = atual.rotulo;

    const restante = Math.max(0, (atual.alvoTimestamp - Date.now()) / 1000);
    tEl.textContent = formatarRelogio(restante);
    if (atual.duracaoTotalSegundos > 0) {
      const fracaoFeita = 1 - Math.min(1, restante / atual.duracaoTotalSegundos);
      progressoEl.style.strokeDashoffset = String(PERIMETRO * (1 - fracaoFeita));
    }

    if (!intervalId) intervalId = setInterval(atualizar, 1000);
  }

  aoMudarCronometroFlutuante(atualizar);
  atualizar();

  el.addEventListener("click", () => {
    const atual = obterCronometroFlutuante();
    if (atual?.aoExpandir) atual.aoExpandir();
  });

  return el;
}
