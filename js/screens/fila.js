// js/screens/fila.js
import { getSeriesDoExercicioNaData } from "../data/historico.js";
import { criarIconeExercicio } from "./iconeExercicio.js";

function montarAnelProgresso(concluidos, total, size = 156, espessura = 12) {
  const raio = (size - espessura) / 2;
  const perimetro = 2 * Math.PI * raio;
  const fracao = total > 0 ? concluidos / total : 0;
  const offset = perimetro * (1 - fracao);
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${raio}" fill="none" stroke="var(--card-2)" stroke-width="${espessura}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${raio}" fill="none" stroke="var(--accent)" stroke-width="${espessura}"
        stroke-linecap="round" stroke-dasharray="${perimetro.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" />
    </svg>`;
  const wrap = document.createElement("div");
  wrap.className = "fila-progresso-ring";
  wrap.innerHTML = `
    <div class="ring-inner">
      ${svg}
      <div class="ring-ctr"><u>Hoje</u><b>${concluidos}/${total}</b><s>exercícios</s></div>
    </div>
  `;
  return wrap;
}

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
  header.innerHTML = `
    <div>
      <div class="date-label">${diaInfo.titulo}</div>
      <div class="day-title">Fila do dia</div>
    </div>
  `;
  const voltarBtn = document.createElement("button");
  voltarBtn.type = "button";
  voltarBtn.className = "icon-btn";
  voltarBtn.setAttribute("aria-label", "Fechar");
  voltarBtn.textContent = "✕";
  voltarBtn.addEventListener("click", () => { if (onVoltar) onVoltar(); });
  header.appendChild(voltarBtn);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const anel = montarAnelProgresso(exerciciosConcluidos, exerciciosHoje.length);
  const legenda = document.createElement("p");
  legenda.textContent = `${exerciciosHoje.length * 3} séries no total · ${totalSeriesFeitas}/${exerciciosHoje.length * 3} feitas`;
  anel.appendChild(legenda);
  main.appendChild(anel);

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
