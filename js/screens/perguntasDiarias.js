// js/screens/perguntasDiarias.js
//
// Popup que aparece ao abrir o app quando há pergunta diária pendente (sono,
// creatina, hidratação, álcool, e o check-in de sessão: nota geral, dor
// articular, DOMS) — pede uma por vez, salva a cada resposta, e fecha
// sozinho quando acaba. O check-in de sessão só entra na fila depois que a
// pessoa já treinou hoje (`treinouHoje`) — perguntar "como foi o treino de
// hoje" antes de treinar nunca tem resposta de verdade.
//
// "Responder mais tarde" pula só a pergunta atual (ela volta a aparecer na
// próxima abertura do app, ou — no caso de hidratação, que tem recorrência
// própria — depois do intervalo dela), sem fechar as que a pessoa já pode
// responder agora.
//
// Reaproveita o padrão visual do sheet de carga (js/screens/seletorCarga.js):
// mesmo overlay, mesma folha subindo do fundo — pra parecer parte do mesmo
// app, não uma tela emprestada.

import { registrarHabito } from "../data/habitos.js";
import { registrarCheckin } from "../data/checkin.js";
import { obterPerguntasPendentes, obterPerguntasCheckinPendentes } from "../engine/perguntasDiarias.js";
import { animarSpring } from "../lib/spring.js";

export async function montarPopupPerguntasDiarias(db, hoje, habitoHoje, checkinHoje, treinouHoje, { aoFechar } = {}) {
  const pendentes = [
    ...obterPerguntasPendentes(habitoHoje).map((q) => ({ ...q, store: "habitos" })),
    ...obterPerguntasCheckinPendentes(checkinHoje, treinouHoje).map((q) => ({ ...q, store: "checkin" })),
  ];
  if (pendentes.length === 0) return null;

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
  const sheetEl = overlay.querySelector(".carga-sheet");
  sheetEl.style.transform = "translate3d(0, 100%, 0)";
  animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
  requestAnimationFrame(() => overlay.classList.add("aberta"));

  const progresso = overlay.querySelector(".perguntas-progresso");
  const tituloEl = overlay.querySelector(".perguntas-pergunta");
  const opcoesEl = overlay.querySelector(".perguntas-opcoes");
  const depoisBtn = overlay.querySelector(".perguntas-depois");

  function fechar() {
    overlay.classList.remove("aberta");
    const alturaAtual = sheetEl.getBoundingClientRect().height || 320;
    animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
      overlay.remove();
    });
    if (aoFechar) aoFechar();
  }

  // `pendentes` encolhe conforme cada pergunta é respondida OU pulada — o
  // progresso ("1 de 3") e o botão de pular sempre olham só pra quem ainda
  // sobra, nunca pra posição original.
  function renderizarPergunta() {
    if (pendentes.length === 0) {
      fechar();
      return;
    }
    const questao = pendentes[0];
    progresso.textContent = `1 de ${pendentes.length}`;
    tituloEl.textContent = questao.pergunta;
    opcoesEl.innerHTML = "";
    for (const opcao of questao.opcoes) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "perguntas-opcao-btn";
      botao.textContent = opcao.rotulo;
      botao.addEventListener("click", async () => {
        const patch = { [questao.campo]: opcao.valor };
        if (questao.recorrenciaHoras) patch[`${questao.campo}RespondidaEm`] = Date.now();
        if (questao.store === "checkin") {
          await registrarCheckin(db, hoje, patch);
        } else {
          await registrarHabito(db, hoje, patch);
        }
        pendentes.shift();
        renderizarPergunta();
      });
      opcoesEl.appendChild(botao);
    }
  }

  depoisBtn.addEventListener("click", () => {
    pendentes.shift();
    renderizarPergunta();
  });
  renderizarPergunta();

  return overlay;
}
