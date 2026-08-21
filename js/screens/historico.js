// js/screens/historico.js
import { getHistoricoCompletoDoExercicio } from "../data/historico.js";

export async function montarTelaHistorico(db, exercicio, aoVoltar) {
  const root = document.createElement("div");
  root.className = "tela-historico";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Histórico</div><div class="day-title"></div></div>`;
  header.querySelector(".day-title").textContent = exercicio.nome;
  root.appendChild(header);

  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "swap-pill";
  voltar.style.margin = "12px 0 0";
  voltar.textContent = "← Voltar ao treino";
  voltar.addEventListener("click", aoVoltar);
  root.appendChild(voltar);

  const main = document.createElement("main");
  root.appendChild(main);

  const series = await getHistoricoCompletoDoExercicio(db, exercicio.id);

  if (series.length === 0) {
    main.innerHTML = `<p class="vazio">Nenhum registro ainda para este exercício.</p>`;
    return root;
  }

  const porData = new Map();
  for (const serie of series) {
    if (!porData.has(serie.data)) porData.set(serie.data, []);
    porData.get(serie.data).push(serie);
  }

  for (const [data, setsDoDia] of porData) {
    setsDoDia.sort((a, b) => (a.serieNumero ?? 0) - (b.serieNumero ?? 0));
    const card = document.createElement("section");
    card.className = "exercise-card";

    const head = document.createElement("div");
    head.className = "exercise-head";
    head.innerHTML = `<div class="exercise-name"></div>`;
    head.querySelector(".exercise-name").textContent = data;
    card.appendChild(head);

    const lista = document.createElement("div");
    lista.className = "sets";
    for (const serie of setsDoDia) {
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.style.padding = "8px 18px";
      linha.innerHTML = `<b>${serie.carga} kg × ${serie.reps}</b>, RIR ${serie.rir}`;
      lista.appendChild(linha);
    }
    card.appendChild(lista);
    main.appendChild(card);
  }

  return root;
}
