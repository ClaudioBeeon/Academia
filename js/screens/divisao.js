// js/screens/divisao.js
import { getAll } from "../data/db.js";
import { getUltimaSerieGeral } from "../data/historico.js";
import { GRUPO_POR_MUSCULO, obterGrupoDoMusculo, determinarProximoGrupo } from "../engine/divisao.js";

export async function montarTelaDivisao(db) {
  const root = document.createElement("div");
  root.className = "tela-divisao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Divisão de treino</div><div class="day-title">Divisão</div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const [ultimaSerieGeral, todasAsSeries] = await Promise.all([
    getUltimaSerieGeral(db),
    getAll(db, "historicoSeries"),
  ]);

  const grupoDeHoje = determinarProximoGrupo(ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";

  main.appendChild(montarCardHoje(tituloGrupo));
  main.appendChild(montarCardHistorico(todasAsSeries));

  return root;
}

function montarCardHoje(tituloGrupo) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Hoje: ${tituloGrupo}</div></div>
    <div class="prev-hint" style="padding:0 18px 18px;">Rotação por sessão: o grupo alterna a cada treino registrado, não por dia fixo da semana.</div>
  `;
  return card;
}

function montarCardHistorico(todasAsSeries) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Sessões recentes</div></div>`;

  const musculoPorData = new Map();
  for (const serie of todasAsSeries) {
    if (!musculoPorData.has(serie.data)) musculoPorData.set(serie.data, serie.musculo);
  }

  const datasOrdenadas = [...musculoPorData.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 14);

  const lista = document.createElement("div");
  lista.className = "sets";
  lista.style.padding = "0 18px 18px";

  if (datasOrdenadas.length === 0) {
    lista.innerHTML = `<p class="vazio">Nenhuma sessão registrada ainda.</p>`;
  } else {
    for (const data of datasOrdenadas) {
      const grupo = obterGrupoDoMusculo(musculoPorData.get(data));
      const rotulo = grupo === "superior" ? "Superior" : grupo === "inferior" ? "Inferior" : "Grupo não identificado";
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.style.gridColumn = "1/-1";
      linha.textContent = `${data} — ${rotulo}`;
      lista.appendChild(linha);
    }
  }

  card.appendChild(lista);
  return card;
}
