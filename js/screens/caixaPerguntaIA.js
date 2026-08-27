// js/screens/caixaPerguntaIA.js
//
// Caixa de pergunta livre pra IA, reaproveitada tanto no fim de cada
// exercício (js/screens/execucao.js) quanto na aba Dieta (js/screens/dieta.js).
// Só monta o elemento e chama `perguntar(texto)` — quem instancia decide o
// prompt/contexto; esta caixa só cuida do estado de UI (digitando, carregando,
// resposta, erro).
//
// `carregar`/`salvar` são opcionais: quando presentes, a última pergunta e
// resposta sobrevivem a trocar de tela ou fechar o app (js/data/perguntasIA.js)
// — sem isso, a resposta desaparecia assim que a pessoa saía da tela, mesmo
// já tendo custado uma chamada de API.
import { ativarAutoResize } from "../lib/autoResizeTextarea.js";

export function montarCaixaPerguntaIA({ titulo = "Dúvidas?", placeholder = "Pergunte algo...", perguntar, carregar, salvar }) {
  const wrap = document.createElement("div");
  wrap.className = "caixa-pergunta-ia";
  wrap.innerHTML = `
    <div class="cpia-titulo">${titulo}</div>
    <div class="cpia-linha">
      <textarea class="cpia-input" rows="1" placeholder="${placeholder}"></textarea>
      <button type="button" class="cpia-enviar" aria-label="Perguntar">↑</button>
    </div>
    <div class="cpia-status prev-hint"></div>
    <div class="cpia-pergunta-salva"></div>
    <div class="cpia-resposta"></div>
  `;

  const input = wrap.querySelector(".cpia-input");
  const enviarBtn = wrap.querySelector(".cpia-enviar");
  const status = wrap.querySelector(".cpia-status");
  const perguntaSalvaEl = wrap.querySelector(".cpia-pergunta-salva");
  const resposta = wrap.querySelector(".cpia-resposta");
  const redimensionarInput = ativarAutoResize(input, { alturaMaxima: 120 });

  async function enviar() {
    const pergunta = input.value.trim();
    if (!pergunta) return;
    status.textContent = "Perguntando à IA...";
    perguntaSalvaEl.textContent = "";
    resposta.textContent = "";
    enviarBtn.disabled = true;
    input.disabled = true;

    const resultado = await perguntar(pergunta);

    enviarBtn.disabled = false;
    input.disabled = false;

    if (!resultado.ok) {
      status.textContent = resultado.mensagem
        ?? (resultado.motivo === "sem_chave"
          ? "IA indisponível: cadastre sua chave do Gemini em Configurações."
          : resultado.motivo === "erro_api_429"
            ? "Cota diária da IA esgotada — tenta de novo amanhã."
            : "IA indisponível agora — tente de novo mais tarde.");
      return;
    }

    status.textContent = "";
    const textoResposta = resultado.texto.trim();
    perguntaSalvaEl.textContent = pergunta;
    resposta.textContent = textoResposta;
    input.value = "";
    redimensionarInput();
    if (salvar) await salvar(pergunta, textoResposta);
  }

  enviarBtn.addEventListener("click", enviar);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      enviar();
    }
  });

  if (carregar) {
    Promise.resolve(carregar()).then((salvo) => {
      if (!salvo) return;
      perguntaSalvaEl.textContent = salvo.pergunta;
      resposta.textContent = salvo.resposta;
    });
  }

  return wrap;
}
