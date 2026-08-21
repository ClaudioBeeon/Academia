// js/screens/fila.js
import { getSeriesDoExercicioNaData } from "../data/historico.js";
import { criarIconeExercicio } from "./iconeExercicio.js";

export async function montarTelaFila(db, contexto, callbacks) {
  const { diaInfo, exerciciosHoje, hoje } = contexto;
  const { onExecutar, onFinalizarSessao, onVoltar } = callbacks;

  const seriesPorExercicio = await Promise.all(
    exerciciosHoje.map((e) => getSeriesDoExercicioNaData(db, e.id, hoje))
  );

  let totalSeriesFeitas = 0;
  let exerciciosConcluidos = 0;
  const estados = seriesPorExercicio.map((series) => {
    totalSeriesFeitas += series.length;
    if (series.length >= 3) {
      exerciciosConcluidos++;
      return "concluido";
    }
    return series.length > 0 ? "andamento" : "pendente";
  });

  const root = document.createElement("div");
  root.className = "tela-fila";

  const header = document.createElement("header");
  header.className = "top";
  header.style.position = "relative";
  header.innerHTML = `
    <div class="date-label">${diaInfo.titulo}</div>
    <div class="day-title">Fila do dia</div>
  `;
  const voltarBtn = document.createElement("button");
  voltarBtn.type = "button";
  voltarBtn.className = "swap-pill";
  voltarBtn.textContent = "✕";
  voltarBtn.style.cssText = "position:absolute; top:14px; right:18px;";
  voltarBtn.addEventListener("click", () => { if (onVoltar) onVoltar(); });
  header.appendChild(voltarBtn);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const progresso = document.createElement("div");
  progresso.className = "prev-hint";
  progresso.style.padding = "0 18px 14px";
  progresso.textContent = `${exerciciosConcluidos}/${exerciciosHoje.length} exercícios · ${totalSeriesFeitas}/${exerciciosHoje.length * 3} séries`;
  main.appendChild(progresso);

  exerciciosHoje.forEach((exercicio, indice) => {
    const item = document.createElement("section");
    item.className = "exercise-card fila-item fila-item-" + estados[indice];
    item.innerHTML = `
      <div class="exercise-head">
        <div class="fila-item-info">
          <div>
            <div class="exercise-name"></div>
            <div class="exercise-meta"></div>
          </div>
        </div>
        <div class="fila-status"></div>
      </div>
    `;
    item.querySelector(".fila-item-info").prepend(criarIconeExercicio(exercicio.id, 52));
    item.querySelector(".exercise-name").textContent = exercicio.nome;
    item.querySelector(".exercise-meta").textContent = exercicio.musculoPrimario;
    const statusEl = item.querySelector(".fila-status");
    statusEl.textContent = estados[indice] === "concluido" ? "✓" : estados[indice] === "andamento" ? `${seriesPorExercicio[indice].length}/3` : "";
    item.addEventListener("click", () => { if (onExecutar) onExecutar(indice); });
    main.appendChild(item);
  });

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px;";
  rodape.innerHTML = `<button type="button" class="swap-pill finalizar-btn" style="width:100%; background:var(--accent); color:var(--accent-ink);">Finalizar sessão</button>`;
  rodape.querySelector(".finalizar-btn").addEventListener("click", () => { if (onFinalizarSessao) onFinalizarSessao(); });
  root.appendChild(rodape);

  return root;
}
