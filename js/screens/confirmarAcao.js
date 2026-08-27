// js/screens/confirmarAcao.js
//
// Folha de confirmação própria do app — substitui o confirm() nativo do
// navegador, que quebra o tema escuro e não segue o padrão visual do resto
// da interface. Mesmo esqueleto/spring das outras folhas (ver
// js/screens/substituirExercicio.js).
import { animarSpring } from "../lib/spring.js";

/**
 * Resolve com `true` se confirmado, `false` se cancelado/fechado sem decidir.
 */
export function confirmarAcao({ titulo = "Tem certeza?", mensagem, textoConfirmar = "Confirmar", textoCancelar = "Cancelar", destrutivo = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet confirmar-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-sheet-titulo">
        <div class="carga-sheet-handle"></div>
        <h3 id="confirmar-sheet-titulo">${titulo}</h3>
        <p class="confirmar-sheet-msg"></p>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar"></button>
          <button type="button" class="carga-sheet-confirmar${destrutivo ? " destrutivo" : ""}"></button>
        </div>
      </div>
    `;
    overlay.querySelector(".confirmar-sheet-msg").textContent = mensagem;
    overlay.querySelector(".carga-sheet-cancelar").textContent = textoCancelar;
    overlay.querySelector(".carga-sheet-confirmar").textContent = textoConfirmar;

    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 220 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    function fechar(resultado) {
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 220;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
      });
      resolve(resultado);
    }

    overlay.querySelector(".carga-sheet-cancelar").addEventListener("click", () => fechar(false));
    overlay.querySelector(".carga-sheet-confirmar").addEventListener("click", () => fechar(true));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(false); });
  });
}
