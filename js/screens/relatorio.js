// js/screens/relatorio.js
import { getSeriesDoDia } from "../data/historico.js";
import { calcularEstatisticasSessao } from "../engine/sessao.js";

export async function montarTelaRelatorio(db, contexto, callbacks) {
  const { hoje, prsDaSessao } = contexto;
  const { onConcluir } = callbacks;

  const seriesDoDia = await getSeriesDoDia(db, hoje);
  const stats = calcularEstatisticasSessao(seriesDoDia);

  const root = document.createElement("div");
  root.className = "tela-relatorio";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div class="date-label">Sessão concluída</div>
    <div class="day-title">Bom treino! 🎉</div>
  `;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const statsCard = document.createElement("section");
  statsCard.className = "exercise-card";
  statsCard.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Resumo</div></div>
    <div class="stats-grid" style="padding:0 18px 18px;">
      <div class="stat-tile"><b></b><span>Séries feitas</span></div>
      <div class="stat-tile"><b></b><span>Volume (kg)</span></div>
      <div class="stat-tile"><b></b><span>Exercícios</span></div>
      <div class="stat-tile"><b class="stat-tile-texto"></b><span>Músculos treinados</span></div>
    </div>
  `;
  const tiles = statsCard.querySelectorAll(".stat-tile b");
  tiles[0].textContent = stats.totalSeries;
  tiles[1].textContent = stats.volumeTotal;
  tiles[2].textContent = stats.exerciciosTreinados;
  tiles[3].textContent = stats.musculosTreinados.length > 0 ? stats.musculosTreinados.join(", ") : "—";
  main.appendChild(statsCard);

  if (prsDaSessao.length > 0) {
    const prsCard = document.createElement("section");
    prsCard.className = "exercise-card";
    prsCard.innerHTML = `<div class="exercise-head"><div class="exercise-name">🏆 Recordes desta sessão</div></div>`;
    const lista = document.createElement("div");
    lista.className = "sets";
    lista.style.padding = "0 18px 18px";
    for (const pr of prsDaSessao) {
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.textContent = pr.mensagem;
      lista.appendChild(linha);
    }
    prsCard.appendChild(lista);
    main.appendChild(prsCard);
  }

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px;";
  rodape.innerHTML = `<button type="button" class="swap-pill concluir-btn" style="width:100%; background:var(--accent); color:var(--accent-ink);">Concluir</button>`;
  rodape.querySelector(".concluir-btn").addEventListener("click", () => { if (onConcluir) onConcluir(); });
  root.appendChild(rodape);

  return root;
}
