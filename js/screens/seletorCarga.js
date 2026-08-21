// js/screens/seletorCarga.js
import { animarSpring } from "../lib/spring.js";

const CARGA_MIN = 1;
const CARGA_MAX = 100;
const LIMIAR_DESCARTE_PX = 90;

export function abrirSeletorCarga(valorInicial) {
  return new Promise((resolve) => {
    let valor = Math.min(CARGA_MAX, Math.max(CARGA_MIN, Math.round(valorInicial || CARGA_MIN)));

    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet">
        <div class="carga-sheet-handle"></div>
        <h3>Carga da série</h3>
        <div class="valor-grande"><span class="num"></span> kg</div>
        <div class="carga-slider" role="slider" aria-valuemin="${CARGA_MIN}" aria-valuemax="${CARGA_MAX}" tabindex="0">
          <div class="carga-slider-fill"></div>
          <div class="carga-slider-thumb"></div>
        </div>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar">Cancelar</button>
          <button type="button" class="carga-sheet-confirmar"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const sheetEl = overlay.querySelector(".carga-sheet");
    const handleEl = overlay.querySelector(".carga-sheet-handle");
    const numEl = overlay.querySelector(".num");
    const fillEl = overlay.querySelector(".carga-slider-fill");
    const thumbEl = overlay.querySelector(".carga-slider-thumb");
    const sliderEl = overlay.querySelector(".carga-slider");
    const confirmarBtn = overlay.querySelector(".carga-sheet-confirmar");
    const cancelarBtn = overlay.querySelector(".carga-sheet-cancelar");

    // Entrada: a folha nasce fora da tela (embaixo) e sobe com física de
    // mola, junto com o fundo escurecendo — igual a um sheet nativo do iOS.
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    function atualizarVisual() {
      const pct = ((valor - CARGA_MIN) / (CARGA_MAX - CARGA_MIN)) * 100;
      fillEl.style.height = `${pct}%`;
      thumbEl.style.bottom = `${pct}%`;
      numEl.textContent = String(valor);
      sliderEl.setAttribute("aria-valuenow", String(valor));
      confirmarBtn.textContent = `Usar ${valor} kg`;
    }
    atualizarVisual();

    function valorNaPosicao(clientY) {
      const rect = sliderEl.getBoundingClientRect();
      const fracaoDoTopo = (clientY - rect.top) / rect.height;
      const fracaoDeBaixo = 1 - Math.min(1, Math.max(0, fracaoDoTopo));
      return Math.round(CARGA_MIN + fracaoDeBaixo * (CARGA_MAX - CARGA_MIN));
    }

    function aoMover(event) {
      valor = valorNaPosicao(event.clientY);
      atualizarVisual();
    }

    function iniciarArraste(event) {
      sliderEl.setPointerCapture?.(event.pointerId);
      aoMover(event);
      sliderEl.addEventListener("pointermove", aoMover);
    }

    function pararArraste(event) {
      sliderEl.removeEventListener("pointermove", aoMover);
      sliderEl.releasePointerCapture?.(event.pointerId);
    }

    function aoTeclar(event) {
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        valor = Math.min(CARGA_MAX, valor + 1);
        atualizarVisual();
        event.preventDefault();
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        valor = Math.max(CARGA_MIN, valor - 1);
        atualizarVisual();
        event.preventDefault();
      }
    }

    sliderEl.addEventListener("pointerdown", iniciarArraste);
    sliderEl.addEventListener("pointerup", pararArraste);
    sliderEl.addEventListener("pointercancel", pararArraste);
    sliderEl.addEventListener("keydown", aoTeclar);

    // Arrastar a alcinha pra baixo descarta a folha — puxão de verdade,
    // com a folha seguindo o dedo e voltando (ou saindo) com mola.
    let arrastandoParaFechar = false;
    let deslocamentoInicialY = 0;

    function iniciarArrasteFechar(event) {
      arrastandoParaFechar = true;
      deslocamentoInicialY = event.clientY;
      handleEl.setPointerCapture?.(event.pointerId);
      sheetEl.style.transition = "none";
    }

    function aoArrastarFechar(event) {
      if (!arrastandoParaFechar) return;
      const delta = Math.max(0, event.clientY - deslocamentoInicialY);
      sheetEl.style.transform = `translate3d(0, ${delta}px, 0)`;
    }

    function pararArrasteFechar(event) {
      if (!arrastandoParaFechar) return;
      arrastandoParaFechar = false;
      handleEl.releasePointerCapture?.(event.pointerId);
      const delta = Math.max(0, event.clientY - deslocamentoInicialY);
      if (delta > LIMIAR_DESCARTE_PX) {
        fechar(null);
      } else {
        animarSpring(sheetEl, { y: delta }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
      }
    }

    handleEl.addEventListener("pointerdown", iniciarArrasteFechar);
    handleEl.addEventListener("pointermove", aoArrastarFechar);
    handleEl.addEventListener("pointerup", pararArrasteFechar);
    handleEl.addEventListener("pointercancel", pararArrasteFechar);

    function fechar(resultado) {
      sliderEl.removeEventListener("pointerdown", iniciarArraste);
      sliderEl.removeEventListener("pointerup", pararArraste);
      sliderEl.removeEventListener("pointercancel", pararArraste);
      sliderEl.removeEventListener("pointermove", aoMover);
      sliderEl.removeEventListener("keydown", aoTeclar);
      handleEl.removeEventListener("pointerdown", iniciarArrasteFechar);
      handleEl.removeEventListener("pointermove", aoArrastarFechar);
      handleEl.removeEventListener("pointerup", pararArrasteFechar);
      handleEl.removeEventListener("pointercancel", pararArrasteFechar);

      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 320;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
        resolve(resultado);
      });
    }

    cancelarBtn.addEventListener("click", () => fechar(null));
    confirmarBtn.addEventListener("click", () => fechar(valor));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) fechar(null); });
  });
}
