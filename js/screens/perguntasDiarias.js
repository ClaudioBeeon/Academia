// js/screens/perguntasDiarias.js
//
// Popup que aparece ao abrir o app quando há pergunta diária pendente (sono,
// creatina, hidratação, álcool) — pede uma por vez, salva a cada resposta, e
// fecha sozinho quando acaba. "Responder mais tarde" fecha tudo de uma vez;
// como a checagem roda de novo a cada abertura do app (js/app.js), o que
// ficou sem resposta volta a aparecer na próxima vez que o app for aberto,
// até a virada do dia trazer um registro novo (e perguntas novas).
//
// Reaproveita o padrão visual do sheet de carga (js/screens/seletorCarga.js):
// mesmo overlay, mesma folha subindo do fundo — pra parecer parte do mesmo
// app, não uma tela emprestada.

import { registrarHabito } from "../data/habitos.js";
import { obterPerguntasPendentes } from "../engine/perguntasDiarias.js";

export async function montarPopupPerguntasDiarias(db, hoje, habitoHoje, { aoFechar } = {}) {
  const pendentes = obterPerguntasPendentes(habitoHoje);
  if (pendentes.length === 0) return null;

  let indice = 0;

  const overlay = document.createElement("div");
  overlay.className = "carga-sheet-overlay perguntas-overlay";
  overlay.innerHTML = `
    <div class="carga-sheet perguntas-sheet">
      <div class="carga-sheet-handle"></div>
      <div class="perguntas-progresso"></div>
      <h3 class="perguntas-pergunta"></h3>
      <div class="perguntas-opcoes"></div>
      <button type="button" class="perguntas-depois">Responder mais tarde</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("aberta"));

  const progresso = overlay.querySelector(".perguntas-progresso");
  const tituloEl = overlay.querySelector(".perguntas-pergunta");
  const opcoesEl = overlay.querySelector(".perguntas-opcoes");
  const depoisBtn = overlay.querySelector(".perguntas-depois");

  function fechar() {
    overlay.classList.remove("aberta");
    setTimeout(() => overlay.remove(), 240);
    if (aoFechar) aoFechar();
  }

  function renderizarPergunta() {
    const questao = pendentes[indice];
    progresso.textContent = `${indice + 1} de ${pendentes.length}`;
    tituloEl.textContent = questao.pergunta;
    opcoesEl.innerHTML = "";
    for (const opcao of questao.opcoes) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "perguntas-opcao-btn";
      botao.textContent = opcao.rotulo;
      botao.addEventListener("click", async () => {
        await registrarHabito(db, hoje, { [questao.campo]: opcao.valor });
        indice++;
        if (indice < pendentes.length) {
          renderizarPergunta();
        } else {
          fechar();
        }
      });
      opcoesEl.appendChild(botao);
    }
  }

  depoisBtn.addEventListener("click", fechar);
  renderizarPergunta();

  return overlay;
}
