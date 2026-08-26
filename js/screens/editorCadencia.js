// js/screens/editorCadencia.js
//
// Folha pra ajustar a cadência de um exercício. Reaproveita o overlay do
// seletor de carga pra parecer parte do mesmo app.
//
// A validação bloqueia o salvamento em vez de corrigir o número por baixo do
// usuário: se ele pedir 5s + 4s, a folha explica que passaria do teto de 8s
// em vez de aceitar e gravar outra coisa.
import { validarCadencia, totalDaRepeticao, textoDaCadencia, TOTAL_MAXIMO_SEGUNDOS, FASE_MINIMA_SEGUNDOS } from "../engine/cadencia.js";

const PASSO = 0.5;

const CAMPOS = [
  { chave: "concentrica", rotulo: "Subida", dica: "fase de puxar/empurrar" },
  { chave: "pausaTopo", rotulo: "Aperto no topo", dica: "0 = sem pausa" },
  { chave: "excentrica", rotulo: "Descida", dica: "fase de voltar, controlada" },
  { chave: "pausaBase", rotulo: "Pausa embaixo", dica: "0 = sem pausa" },
];

function formatar(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

/**
 * Abre a folha. Resolve com a nova cadência, com { restaurar: true } quando
 * a pessoa pede pra voltar ao que a ficha prescreve, ou com null se fechar
 * sem salvar.
 */
export function abrirEditorCadencia({ nomeExercicio, cadenciaAtual, cadenciaDaFicha, temAjuste }) {
  return new Promise((resolve) => {
    const valores = { ...cadenciaAtual };

    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet cadencia-sheet">
        <div class="carga-sheet-handle"></div>
        <h3>Ritmo da repetição</h3>
        <p class="cadencia-exercicio"></p>
        <div class="cadencia-campos"></div>
        <div class="cadencia-resumo">
          <div class="total"><b></b><span>por repetição</span></div>
          <div class="prosa"></div>
        </div>
        <p class="cadencia-erro" role="alert"></p>
        <button type="button" class="cadencia-restaurar">Voltar ao ritmo da ficha</button>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar">Cancelar</button>
          <button type="button" class="carga-sheet-confirmar">Salvar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    overlay.querySelector(".cadencia-exercicio").textContent = nomeExercicio;

    const camposEl = overlay.querySelector(".cadencia-campos");
    const totalEl = overlay.querySelector(".cadencia-resumo .total b");
    const prosaEl = overlay.querySelector(".cadencia-resumo .prosa");
    const erroEl = overlay.querySelector(".cadencia-erro");
    const salvarBtn = overlay.querySelector(".carga-sheet-confirmar");
    const restaurarBtn = overlay.querySelector(".cadencia-restaurar");

    restaurarBtn.hidden = !temAjuste;

    const controles = CAMPOS.map((campo) => {
      const linha = document.createElement("div");
      linha.className = "cadencia-linha";
      linha.innerHTML = `
        <div class="rot"><b></b><span></span></div>
        <div class="ctl">
          <button type="button" data-delta="-1" aria-label="Diminuir ${campo.rotulo}">−</button>
          <span class="val" aria-live="polite"></span>
          <button type="button" data-delta="1" aria-label="Aumentar ${campo.rotulo}">+</button>
        </div>
      `;
      linha.querySelector("b").textContent = campo.rotulo;
      linha.querySelector(".rot span").textContent = campo.dica;
      const valEl = linha.querySelector(".val");

      for (const botao of linha.querySelectorAll("[data-delta]")) {
        botao.addEventListener("click", () => {
          const delta = Number(botao.dataset.delta) * PASSO;
          const minimo = campo.chave === "concentrica" || campo.chave === "excentrica" ? FASE_MINIMA_SEGUNDOS : 0;
          valores[campo.chave] = Math.max(minimo, Math.round(((valores[campo.chave] ?? 0) + delta) * 10) / 10);
          redesenhar();
        });
      }

      camposEl.appendChild(linha);
      return { campo, valEl };
    });

    function redesenhar() {
      for (const { campo, valEl } of controles) {
        valEl.textContent = `${formatar(valores[campo.chave] ?? 0)}s`;
      }
      const total = totalDaRepeticao(valores);
      totalEl.textContent = `${formatar(total)}s`;
      prosaEl.textContent = textoDaCadencia(valores);

      const { valida, motivo } = validarCadencia(valores);
      erroEl.textContent = valida ? "" : motivo;
      erroEl.classList.toggle("visivel", !valida);
      salvarBtn.disabled = !valida;
      overlay.querySelector(".cadencia-resumo").classList.toggle("estourado", !valida);
    }
    redesenhar();

    function fechar(resultado) {
      overlay.classList.remove("aberta");
      setTimeout(() => overlay.remove(), 240);
      resolve(resultado);
    }

    overlay.querySelector(".carga-sheet-cancelar").addEventListener("click", () => fechar(null));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
    salvarBtn.addEventListener("click", () => {
      if (salvarBtn.disabled) return;
      fechar({ cadencia: { ...cadenciaDaFicha, ...valores } });
    });
    restaurarBtn.addEventListener("click", () => fechar({ restaurar: true }));
  });
}
