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
    textarea.style.height = "auto";
    const altura = Math.min(textarea.scrollHeight, alturaMaxima);
    textarea.style.height = `${altura}px`;
    textarea.style.overflowY = textarea.scrollHeight > alturaMaxima ? "auto" : "hidden";
  }
  textarea.addEventListener("input", redimensionar);
  redimensionar();
  return redimensionar;
}
