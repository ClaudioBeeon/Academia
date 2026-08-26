// js/lib/detailsAnimado.js
//
// Anima o abrir/fechar de um <details> nativo — o navegador troca [open]
// instantaneamente, sem nenhum jeito de animar `height: auto` direto. Mede
// a altura real do conteúdo em JS e transiciona até ela (e até 0 no
// fechamento), preservando o comportamento/acessibilidade nativos do
// elemento (teclado, leitor de tela) — só a transição é adicionada.
export function animarDetails(detailsEl, conteudoEl) {
  detailsEl.addEventListener("click", (evento) => {
    const alvo = evento.target.closest("summary");
    if (!alvo) return;
    evento.preventDefault();

    const abrindo = !detailsEl.open;
    if (abrindo) detailsEl.open = true;

    const alturaAlvo = abrindo ? conteudoEl.scrollHeight : 0;
    conteudoEl.style.height = abrindo ? "0px" : `${conteudoEl.scrollHeight}px`;
    conteudoEl.style.opacity = abrindo ? "0" : "1";
    // Força o navegador a pintar o estado inicial antes de mudar pro
    // estado alvo — sem isso as duas mudanças de estilo se juntam num
    // único frame e a transição não roda.
    conteudoEl.getBoundingClientRect();
    requestAnimationFrame(() => {
      conteudoEl.style.height = `${alturaAlvo}px`;
      conteudoEl.style.opacity = abrindo ? "1" : "0";
    });

    conteudoEl.addEventListener("transitionend", function aoTerminar() {
      conteudoEl.removeEventListener("transitionend", aoTerminar);
      if (!abrindo) detailsEl.open = false;
      conteudoEl.style.height = "";
    }, { once: true });
  });
}
