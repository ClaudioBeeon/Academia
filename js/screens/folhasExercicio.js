// js/screens/folhasExercicio.js
//
// As duas folhas do topo da tela de execução (direção C de
// prototypes/execucao-imagem-3-direcoes.html):
//   - o menu "⋯", que junta as ações que antes eram quatro pílulas soltas
//     no cabeçalho (Trocar, Deixar pra depois, Opções, Dia do ciclo);
//   - o visor da imagem do exercício, com o "como executar" junto — pra
//     saber qual é a máquina sem voltar pra fila.
// Mesmo esqueleto e spring das outras folhas do app (js/screens/confirmarAcao.js).
import { animarSpring } from "../lib/spring.js";

function abrirFolha(classeExtra, rotulo, montarConteudo) {
  const overlay = document.createElement("div");
  overlay.className = "carga-sheet-overlay";
  const folha = document.createElement("div");
  folha.className = `carga-sheet ${classeExtra}`;
  folha.setAttribute("role", "dialog");
  folha.setAttribute("aria-modal", "true");
  folha.setAttribute("aria-label", rotulo);
  folha.innerHTML = `<div class="carga-sheet-handle"></div>`;
  overlay.appendChild(folha);

  let fechada = false;
  function fechar() {
    if (fechada) return;
    fechada = true;
    overlay.classList.remove("aberta");
    const altura = folha.getBoundingClientRect().height || 320;
    animarSpring(folha, { y: 0 }, { y: altura }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => overlay.remove());
  }

  montarConteudo(folha, fechar);
  document.body.appendChild(overlay);
  folha.style.transform = "translate3d(0, 100%, 0)";
  animarSpring(folha, { y: folha.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
  requestAnimationFrame(() => overlay.classList.add("aberta"));
  overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(); });
  return fechar;
}

// itens: [{ rotulo, detalhe?, acao }]. Fecha a folha antes de agir — a ação
// pode abrir outra folha (trocar exercício) ou trocar de tela.
export function abrirMenuExercicio(itens) {
  return abrirFolha("exec-menu-sheet", "Mais opções do exercício", (folha, fechar) => {
    for (const item of itens) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "exec-menu-item";
      botao.innerHTML = `<b></b>${item.detalhe ? "<span></span>" : ""}`;
      botao.querySelector("b").textContent = item.rotulo;
      if (item.detalhe) botao.querySelector("span").textContent = item.detalhe;
      botao.addEventListener("click", () => { fechar(); item.acao(); });
      folha.appendChild(botao);
    }
  });
}

export function abrirVisorExercicio(exercicio) {
  return abrirFolha("exec-visor-sheet", `Imagem de ${exercicio.nome}`, (folha) => {
    if (exercicio.imagemUrl) {
      const img = document.createElement("img");
      img.className = "exec-visor-img";
      img.src = exercicio.imagemUrl;
      img.alt = exercicio.nome;
      folha.appendChild(img);
    }
    const nome = document.createElement("h3");
    nome.className = "exec-visor-nome";
    nome.textContent = exercicio.nome;
    folha.appendChild(nome);

    const comoExecutar = exercicio.prescricao?.comoExecutar ?? exercicio.observacoesExecucao;
    if (comoExecutar) {
      const titulo = document.createElement("h4");
      titulo.textContent = "Como executar";
      const texto = document.createElement("p");
      texto.textContent = comoExecutar;
      folha.append(titulo, texto);
    }
    if (exercicio.prescricao?.atencao) {
      const cuidado = document.createElement("div");
      cuidado.className = "exec-visor-cuidado";
      cuidado.innerHTML = "<h4>Cuidado</h4><p></p>";
      cuidado.querySelector("p").textContent = exercicio.prescricao.atencao;
      folha.appendChild(cuidado);
    }
    const video = document.createElement("a");
    video.className = "swap-pill exec-visor-video";
    video.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercicio.nome} execução correta`)}`;
    video.target = "_blank";
    video.rel = "noopener";
    video.textContent = "Ver vídeo da execução ↗";
    folha.appendChild(video);
  });
}
