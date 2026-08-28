// js/lib/autoResizeTextarea.js
//
// Textarea que cresce sozinha conforme o texto, do jeito que qualquer app
// grande já faz — sem isso, toda caixa de texto do app ficava presa na
// altura do `rows` inicial, cortando o texto no meio em vez de crescer.
const ALTURA_MAXIMA_PADRAO = 200;

/**
 * Liga o auto-resize numa textarea existente. Redimensiona sozinha a cada
 * `input` do usuário, e uma vez já na hora de ligar (cobre o caso de já vir
 * com texto). Devolve a função de redimensionar, pra quem preenche o
 * `.value` por fora (carregar do banco, limpar depois de salvar, abrir um
 * formulário que estava `display:none`) chamar de novo depois — só o evento
 * `input` do teclado não cobre essas mudanças programáticas.
 */
export function ativarAutoResize(textarea, { alturaMaxima = ALTURA_MAXIMA_PADRAO } = {}) {
  function redimensionar() {
    // Um formulário `display:none` (fechado, esperando o toque em "+") tem
    // scrollHeight 0 — forçar a altura pra 0px aqui deixaria a textarea
    // colapsada quando o formulário reabre, até a pessoa digitar algo. Sem
    // layout de verdade pra medir, não mexe na altura.
    if (textarea.offsetParent === null && textarea !== document.activeElement) return;

    // Vazia, só com placeholder: scrollHeight de uma textarea vazia ignora
    // o placeholder (ele não conta pra altura de conteúdo), então um
    // placeholder de 2+ linhas ficava cortado até a pessoa digitar algo —
    // o evento `input` nunca dispara sozinho sem digitação. Empresta o
    // texto do placeholder só pra medir, e devolve o valor original antes
    // do navegador ter chance de pintar a tela (mesma função, síncrono).
    const valorOriginal = textarea.value;
    const medindoPlaceholder = !valorOriginal && textarea.placeholder;
    if (medindoPlaceholder) textarea.value = textarea.placeholder;

    textarea.style.height = "auto";
    const altura = Math.min(textarea.scrollHeight, alturaMaxima);
    textarea.style.height = `${altura}px`;
    textarea.style.overflowY = textarea.scrollHeight > alturaMaxima ? "auto" : "hidden";

    if (medindoPlaceholder) textarea.value = valorOriginal;
  }
  textarea.addEventListener("input", redimensionar);
  // Quem chama ativarAutoResize sempre faz isso ANTES de anexar o elemento
  // ao documento (constrói a textarea, só depois faz appendChild) — chamar
  // redimensionar() aqui na hora media um elemento ainda desanexado
  // (offsetParent null), caindo na proteção do formulário escondido acima e
  // nunca medindo nada de verdade. rAF roda logo antes da próxima pintura,
  // depois que o appendChild síncrono do chamador já aconteceu — sem
  // flash visível, e com o elemento já no lugar certo pra medir.
  requestAnimationFrame(redimensionar);
  return redimensionar;
}
