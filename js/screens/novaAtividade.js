// js/screens/novaAtividade.js
//
// Folha aberta pelo "+" da tela Início pra registrar uma atividade avulsa
// do dia (patins, vôlei de praia, beach tênis, ou só "cardio na academia").
// Reaproveita o mesmo overlay/folha do seletor de carga — a estimativa de
// calorias usa o MET da modalidade quando conhecida, e cai no MET padrão
// de cardio (js/engine/calorias.js) pra qualquer atividade digitada à mão.
import { estimarCaloriasCardio } from "../engine/calorias.js";
import { animarSpring } from "../lib/spring.js";

const ATIVIDADES = [
  ["bicicleta", "Bicicleta"],
  ["eliptico", "Elíptico"],
  ["escada", "Escada"],
  ["caminhada", "Caminhada"],
  ["corrida", "Corrida"],
  ["patins", "Patins"],
  ["volei_praia", "Vôlei de praia"],
  ["beach_tenis", "Beach tênis"],
  ["outra", "Outra atividade"],
];

export function abrirNovaAtividade(pesoKg) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet atividade-sheet">
        <div class="carga-sheet-handle"></div>
        <h3>Nova atividade</h3>
        <form class="atividade-form">
          <div class="set-field">
            <label>O que você fez?
              <select name="modalidade">
                ${ATIVIDADES.map(([valor, rotulo]) => `<option value="${valor}">${rotulo}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="set-field atividade-outra" hidden>
            <label>Qual atividade?<input type="text" name="outraAtividade" placeholder="ex.: cardio na esteira" /></label>
          </div>
          <div class="atividade-linha">
            <div class="set-field">
              <label>Duração (min)<input type="number" name="duracaoMinutos" placeholder="30" inputmode="numeric" min="1" required /></label>
            </div>
            <div class="set-field atividade-intensidade-campo">
              <label>Intensidade
                <select name="intensidadePercebida">
                  <option value="1">Muito leve</option>
                  <option value="2">Leve</option>
                  <option value="3" selected>Moderada</option>
                  <option value="4">Forte</option>
                  <option value="5">Muito forte</option>
                </select>
              </label>
            </div>
          </div>
          <div class="atividade-estimativa"></div>
          <button type="submit" class="atividade-iniciar-agora" data-modo="iniciar">Começar agora, com cronômetro</button>
          <p class="atividade-modo-nota"></p>
          <div class="carga-sheet-acoes atividade-acoes-secundarias">
            <button type="button" class="carga-sheet-cancelar">Cancelar</button>
            <button type="submit" class="carga-sheet-confirmar" data-modo="registrar">Só registrar</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    const form = overlay.querySelector(".atividade-form");
    const outraCampo = overlay.querySelector(".atividade-outra");
    const estimativaEl = overlay.querySelector(".atividade-estimativa");
    const cancelarBtn = overlay.querySelector(".carga-sheet-cancelar");

    function atualizarEstimativa() {
      const modalidade = form.modalidade.value;
      const duracaoMinutos = Number(form.duracaoMinutos.value);
      if (!(duracaoMinutos > 0) || !(pesoKg > 0)) {
        estimativaEl.innerHTML = "";
        return;
      }
      const kcal = estimarCaloriasCardio({ modalidade, duracaoMinutos, pesoKg });
      estimativaEl.innerHTML = `~<b>${kcal}</b> kcal estimadas`;
    }

    form.modalidade.addEventListener("change", () => {
      const ehOutra = form.modalidade.value === "outra";
      outraCampo.hidden = !ehOutra;
      if (ehOutra) form.outraAtividade.focus();
      atualizarEstimativa();
    });
    form.duracaoMinutos.addEventListener("input", atualizarEstimativa);

    function fechar(resultado) {
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 320;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
      });
      resolve(resultado);
    }

    cancelarBtn.addEventListener("click", () => fechar(null));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) fechar(null); });

    overlay.querySelector(".atividade-modo-nota").textContent =
      "Começar agora abre um cronômetro — a intensidade é perguntada só no final, quando encerrar.";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const modalidadeEscolhida = form.modalidade.value;
      const modalidade = modalidadeEscolhida === "outra"
        ? (form.outraAtividade.value.trim() || "outra atividade")
        : modalidadeEscolhida;
      const duracaoMinutos = Number(form.duracaoMinutos.value) || undefined;
      const intensidadePercebida = Number(form.intensidadePercebida.value);
      const iniciarAgora = event.submitter?.dataset.modo === "iniciar";
      fechar({ modalidade, duracaoMinutos, intensidadePercebida, iniciarAgora });
    });
  });
}
