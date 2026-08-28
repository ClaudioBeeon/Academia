// js/screens/widgetMusica.js
//
// Mini-player flutuante — fica montado uma única vez, fora de #tab-content
// (sobrevive a qualquer troca de aba/tela), e só aparece quando existe
// alguma música tocando (js/lib/playerFlutuante.js). O iframe que produz o
// áudio/vídeo mora AQUI, nunca dentro da tela Música — é o que permite a
// música continuar tocando ao trocar de aba: mover um iframe de lugar no DOM
// recarrega o conteúdo dele do zero (comportamento padrão do navegador,
// não um bug), então ele nunca pode trocar de pai, só aparecer ou sumir.
import { obterPlayerFlutuante, aoMudarPlayerFlutuante, limparPlayerFlutuante } from "../lib/playerFlutuante.js";

export function montarWidgetMusica(onAbrirMusica) {
  // Não é <button>: precisa conter um <iframe> (o player), e conteúdo
  // interativo dentro de <button> é inválido/imprevisível — o toque pra
  // abrir a aba Música é tratado via listener no próprio elemento.
  const el = document.createElement("div");
  el.className = "widget-musica";
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.hidden = true;
  el.innerHTML = `
    <span class="wm-player"></span>
    <span class="wm-info">
      <span class="wm-fonte"></span>
      <span class="wm-titulo"></span>
    </span>
    <span class="wm-fechar" role="button" aria-label="Parar música">✕</span>
  `;
  const playerEl = el.querySelector(".wm-player");
  const fonteEl = el.querySelector(".wm-fonte");
  const tituloEl = el.querySelector(".wm-titulo");

  let srcAtual = null;

  function atualizar() {
    const atual = obterPlayerFlutuante();
    if (!atual) {
      el.hidden = true;
      playerEl.replaceChildren();
      srcAtual = null;
      return;
    }
    el.hidden = false;
    el.classList.toggle("wm-youtube", atual.tipo === "youtube");
    fonteEl.textContent = atual.tipo === "youtube" ? "YouTube" : "SoundCloud";
    tituloEl.textContent = atual.titulo ?? "";

    // Só recria o iframe quando a fonte de fato muda — trocar de música —
    // não a cada notificação (evita reiniciar a mesma música do zero).
    if (srcAtual !== atual.src) {
      srcAtual = atual.src;
      const iframe = document.createElement("iframe");
      iframe.src = atual.src;
      iframe.allow = atual.tipo === "youtube" ? "autoplay; encrypted-media" : "autoplay";
      iframe.loading = "lazy";
      playerEl.replaceChildren(iframe);
    }
  }

  aoMudarPlayerFlutuante(atualizar);
  atualizar();

  el.querySelector(".wm-fechar").addEventListener("click", (event) => {
    event.stopPropagation();
    limparPlayerFlutuante();
  });
  el.addEventListener("click", () => { if (onAbrirMusica) onAbrirMusica(); });
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (onAbrirMusica) onAbrirMusica();
    }
  });

  return el;
}
