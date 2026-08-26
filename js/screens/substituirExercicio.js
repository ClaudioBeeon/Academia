// js/screens/substituirExercicio.js
//
// Folha "Trocar exercício" — troca só por hoje (máquina ocupada, dor num
// movimento específico, etc.), nunca a ficha em si. Reaproveita o mesmo
// padrão visual das outras folhas (js/screens/seletorCarga.js).
import { animarSpring } from "../lib/spring.js";

/**
 * Abre a folha com as sugestões já filtradas (mesmo músculo primário).
 * Resolve com o exercício escolhido, ou null se cancelar/fechar sem
 * escolher.
 */
export function abrirSubstituirExercicio({ nomeAtual, sugestoes }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet substituir-sheet">
        <div class="carga-sheet-handle"></div>
        <h3>Trocar exercício</h3>
        <p class="substituir-nota"></p>
        <div class="substituir-lista"></div>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar">Cancelar</button>
        </div>
      </div>
    `;
    overlay.querySelector(".substituir-nota").textContent =
      `No lugar de "${nomeAtual}", só por hoje — a ficha continua com o mesmo exercício amanhã.`;

    const listaEl = overlay.querySelector(".substituir-lista");
    if (sugestoes.length === 0) {
      const vazio = document.createElement("p");
      vazio.className = "substituir-vazio";
      vazio.textContent = "Nenhuma alternativa cadastrada pra esse músculo ainda.";
      listaEl.appendChild(vazio);
    } else {
      for (const exercicio of sugestoes) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "substituir-item";
        botao.innerHTML = `
          <span class="nm">${exercicio.nome}</span>
          <span class="eq"></span>
        `;
        botao.querySelector(".eq").textContent = ROTULO_EQUIPAMENTO[exercicio.equipamento] ?? exercicio.equipamento ?? "";
        botao.addEventListener("click", () => fechar(exercicio));
        listaEl.appendChild(botao);
      }
    }

    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    function fechar(resultado) {
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 320;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
      });
      resolve(resultado);
    }

    overlay.querySelector(".carga-sheet-cancelar").addEventListener("click", () => fechar(null));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
  });
}

const ROTULO_EQUIPAMENTO = {
  barra: "Barra", halteres: "Halteres", maquina: "Máquina",
  cabos_polias: "Cabo/polia", peso_corporal: "Peso corporal",
};
