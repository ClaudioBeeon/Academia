// js/screens/cardioPrompt.js
//
// Pergunta obrigatória antes de fechar a sessão quando há cardio prescrito
// pra hoje e ainda não registrado. Sem isso, "Concluir sessão" ou terminar
// o último exercício iam direto pro relatório e o cardio do dia ficava pra
// trás sem ninguém decidir isso de propósito.
const NOME_MODALIDADE = {
  bicicleta: "Bicicleta", eliptico: "Elíptico", escada: "Escada",
  caminhada: "Caminhada", corrida: "Corrida", patins: "Patins",
  volei_praia: "Vôlei de praia", beach_tenis: "Beach tênis",
};

/** Resolve com "agora" | "depois". Nunca fecha sozinha sem uma escolha. */
export function abrirPromptCardio(cardioDeHoje) {
  return new Promise((resolve) => {
    const nome = NOME_MODALIDADE[cardioDeHoje.modalidade] ?? cardioDeHoje.modalidade;
    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet cardio-prompt-sheet">
        <div class="carga-sheet-handle"></div>
        <h3>Ainda falta o cardio de hoje</h3>
        <p class="cardio-prompt-desc"></p>
        <div class="cardio-prompt-acoes">
          <button type="button" class="cardio-prompt-agora">Fazer cardio agora</button>
          <button type="button" class="cardio-prompt-depois">Concluir sem fazer</button>
        </div>
      </div>
    `;
    overlay.querySelector(".cardio-prompt-desc").textContent = cardioDeHoje.duracaoMin
      ? `${nome} · previsto ${cardioDeHoje.duracaoMin} min`
      : nome;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    function fechar(resultado) {
      overlay.classList.remove("aberta");
      setTimeout(() => overlay.remove(), 240);
      resolve(resultado);
    }

    overlay.querySelector(".cardio-prompt-agora").addEventListener("click", () => fechar("agora"));
    overlay.querySelector(".cardio-prompt-depois").addEventListener("click", () => fechar("depois"));
    // Sem clique-fora-fecha e sem tecla Esc: essa decisão precisa ser
    // explícita, não um dispensar acidental que despenca pro relatório.
  });
}
