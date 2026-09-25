// js/screens/resultadoSerie.js
//
// Folha "Como foi a série?" — aparece ao tocar "Terminei — registrar"
// (auditoria 2026-09-24). Antes a série era gravada direto com reps e RIR
// pré-preenchidos (topo da faixa e RIR-alvo, ou cópia da sessão anterior),
// e nos dados reais 100% dos RIR registrados eram iguais ao alvo: a
// progressão e os alertas não tinham com o que trabalhar. Aqui as reps
// vêm com a meta da série (ajustável) e o RIR não vem marcado — tocar no
// RIR é o que confirma e registra. "Foi aquecimento" grava a série à parte,
// sem contar como série de trabalho.
import { animarSpring } from "../lib/spring.js";

const OPCOES_RIR = [0, 1, 2, 3, 4, 5];

/**
 * Resolve com { reps, rir, aquecimento: false }, { reps, rir: null,
 * aquecimento: true } ou null (voltar sem registrar).
 */
export function perguntarResultadoSerie({ numero, reps, rirSugerido = null, rirAlvo, repsMin, repsMax, rotuloReps = "Repetições" }) {
  return new Promise((resolve) => {
    let repsAtual = Math.max(0, reps ?? repsMin ?? 0);

    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet resultado-serie-sheet" role="dialog" aria-modal="true" aria-labelledby="rs-titulo">
        <div class="carga-sheet-handle"></div>
        <h3 id="rs-titulo"></h3>
        <div class="rs-linha">
          <span class="rs-rot"></span>
          <div class="rs-ctl">
            <button type="button" class="rs-menos" aria-label="Menos uma repetição">−</button>
            <b class="rs-reps" aria-live="polite"></b>
            <button type="button" class="rs-mais" aria-label="Mais uma repetição">+</button>
          </div>
        </div>
        <p class="rs-pergunta">Quantas ainda sobravam?</p>
        <div class="rs-rir" role="group" aria-label="Repetições que sobravam (RIR)"></div>
        <p class="rs-dica"></p>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar rs-voltar">Voltar</button>
          <button type="button" class="carga-sheet-cancelar rs-aquecimento">Foi aquecimento</button>
        </div>
      </div>
    `;
    overlay.querySelector("#rs-titulo").textContent = `Série ${numero} — como foi?`;
    overlay.querySelector(".rs-rot").textContent = rotuloReps;
    overlay.querySelector(".rs-dica").textContent =
      `Meta: ${repsMin}–${repsMax}, parando com ${rirAlvo} sobrando. Responda o que aconteceu — é isso que decide quando a carga sobe.`;

    const repsEl = overlay.querySelector(".rs-reps");
    const desenharReps = () => { repsEl.textContent = String(repsAtual); };
    desenharReps();
    overlay.querySelector(".rs-menos").addEventListener("click", () => { repsAtual = Math.max(0, repsAtual - 1); desenharReps(); });
    overlay.querySelector(".rs-mais").addEventListener("click", () => { repsAtual += 1; desenharReps(); });

    const rirEl = overlay.querySelector(".rs-rir");
    for (const valor of OPCOES_RIR) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "rs-rir-btn";
      if (valor === rirSugerido) botao.classList.add("sugerido");
      botao.textContent = valor === 5 ? "5+" : String(valor);
      botao.setAttribute("aria-label", valor === 0 ? "Nenhuma — falha" : `${valor === 5 ? "5 ou mais" : valor} sobrando`);
      botao.addEventListener("click", () => fechar({ reps: repsAtual, rir: valor, aquecimento: false }));
      rirEl.appendChild(botao);
    }

    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 360 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    let fechada = false;
    function fechar(resultado) {
      if (fechada) return;
      fechada = true;
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 360;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
      });
      resolve(resultado);
    }

    overlay.querySelector(".rs-voltar").addEventListener("click", () => fechar(null));
    overlay.querySelector(".rs-aquecimento").addEventListener("click", () => fechar({ reps: repsAtual, rir: null, aquecimento: true }));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
  });
}
