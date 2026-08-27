// js/screens/evolucao.js
import { getAll } from "../data/db.js";
import { calcularProgressao1RM, calcularVolumeSemanalPorMusculo } from "../engine/graficos.js";
import { getMedidas, registrarMedida } from "../data/medidas.js";
import { prepararSerieTemporal } from "../engine/medidas.js";
import { montarCardPostura } from "./postura.js";

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarTelaEvolucao(db, { onAbrirHistoricoTreinos } = {}) {
  const root = document.createElement("div");
  root.className = "tela-evolucao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Progressão</div><div class="day-title">Evolução</div></div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  if (onAbrirHistoricoTreinos) {
    const historicoBtn = document.createElement("button");
    historicoBtn.type = "button";
    historicoBtn.className = "swap-pill";
    historicoBtn.style.cssText = "align-self:flex-start; margin-bottom:4px;";
    historicoBtn.textContent = "Histórico de treinos →";
    historicoBtn.addEventListener("click", onAbrirHistoricoTreinos);
    main.appendChild(historicoBtn);
  }

  const [exercicios, todasAsSeries, linhasMedidas] = await Promise.all([
    getAll(db, "exercicios"),
    getAll(db, "historicoSeries"),
    getMedidas(db),
  ]);

  // Postura abre a tela: virou prioridade declarada na auditoria e é a única
  // das quatro que não tinha nenhum acompanhamento. Vem antes dos gráficos de
  // carga porque é a que o usuário esqueceria de olhar.
  const hoje = obterDataLocal();
  const slotPostura = document.createElement("div");
  main.appendChild(slotPostura);
  const redesenharPostura = async () => {
    const novo = await montarCardPostura(db, hoje, redesenharPostura);
    slotPostura.replaceChildren(novo);
  };
  await redesenharPostura();

  if (todasAsSeries.length === 0) {
    // append, não innerHTML: o card de postura já está no main e faz sentido
    // existir mesmo antes do primeiro treino registrado — a foto inicial é
    // justamente pra ser tirada antes de começar.
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = "Sem treinos registrados ainda.";
    main.appendChild(vazio);
  } else {
    montarSecaoCarga(main, exercicios, todasAsSeries);
    montarSecaoVolume(main, todasAsSeries);
  }

  montarSecaoMedidas(main, db, linhasMedidas);

  return root;
}

function montarSecaoCarga(main, exercicios, todasAsSeries) {
  const idsComHistorico = new Set(todasAsSeries.map((s) => s.exercicioId));
  const exerciciosComHistorico = exercicios.filter((e) => idsComHistorico.has(e.id));
  if (exerciciosComHistorico.length === 0) return;

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Progressão de carga (1RM estimado)</div></div>
    <div class="sets" style="padding:0 18px 18px;">
      <div class="set-field" style="grid-column:1/-1;">
        <label>Exercício
          <select class="select-exercicio" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;"></select>
        </label>
      </div>
      <div class="grafico-1rm" style="grid-column:1/-1;"></div>
    </div>
  `;
  main.appendChild(card);

  const select = card.querySelector(".select-exercicio");
  for (const exercicio of exerciciosComHistorico) {
    const option = document.createElement("option");
    option.value = exercicio.id;
    option.textContent = exercicio.nome;
    select.appendChild(option);
  }

  const container = card.querySelector(".grafico-1rm");

  const desenhar = (exercicioId) => {
    const seriesDoExercicio = todasAsSeries.filter((s) => s.exercicioId === exercicioId);
    const pontos = calcularProgressao1RM(seriesDoExercicio);
    container.innerHTML = "";
    if (pontos.length === 0) {
      container.innerHTML = `<p class="prev-hint">Sem dados suficientes para este exercício.</p>`;
      return;
    }
    container.appendChild(criarSvgLinha(pontos.map((p) => ({ data: p.data, valor: p.carga1RM }))));
  };

  select.addEventListener("change", () => desenhar(select.value));
  select.value = exerciciosComHistorico[0].id;
  desenhar(exerciciosComHistorico[0].id);
}

function montarSecaoVolume(main, todasAsSeries) {
  const volumePorMusculo = calcularVolumeSemanalPorMusculo(todasAsSeries);
  const musculos = Object.keys(volumePorMusculo).sort();

  if (musculos.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = "Sem volume semanal suficiente ainda.";
    main.appendChild(vazio);
    return;
  }

  for (const musculo of musculos) {
    const semanas = volumePorMusculo[musculo];
    const card = document.createElement("section");
    card.className = "exercise-card";

    const head = document.createElement("div");
    head.className = "exercise-head";
    head.innerHTML = `<div class="exercise-name"></div>`;
    head.querySelector(".exercise-name").textContent = `Volume semanal — ${musculo}`;
    card.appendChild(head);

    const corpo = document.createElement("div");
    corpo.className = "sets";
    corpo.style.padding = "0 18px 18px";
    corpo.appendChild(criarSvgBarras(semanas));
    card.appendChild(corpo);

    main.appendChild(card);
  }
}

function formatarDataCurta(dataIso) {
  const [, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}`;
}

function criarSvgLinha(pontos) {
  const largura = 320;
  const altura = 140;
  const margem = 24;

  const valores = pontos.map((p) => p.valor);
  const minValor = Math.min(...valores);
  const maxValor = Math.max(...valores);
  const faixa = maxValor - minValor || 1;
  const folga = faixa * 0.1;
  const min = minValor - folga;
  const max = maxValor + folga;

  const escalaX = (i) => margem + (i / Math.max(pontos.length - 1, 1)) * (largura - margem * 2);
  const escalaY = (valor) => altura - margem - ((valor - min) / (max - min)) * (altura - margem * 2);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura + 20}`);
  svg.setAttribute("width", "100%");
  svg.style.display = "block";

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute(
    "points",
    pontos.map((p, i) => `${escalaX(i)},${escalaY(p.valor)}`).join(" ")
  );
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "var(--accent)");
  polyline.setAttribute("stroke-width", "2");
  svg.appendChild(polyline);

  pontos.forEach((p, i) => {
    const circulo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circulo.setAttribute("cx", escalaX(i));
    circulo.setAttribute("cy", escalaY(p.valor));
    circulo.setAttribute("r", "3");
    circulo.setAttribute("fill", "var(--accent)");
    svg.appendChild(circulo);
  });

  const passoRotulo = Math.max(1, Math.ceil(pontos.length / 6));
  pontos.forEach((p, i) => {
    if (i % passoRotulo !== 0 && i !== pontos.length - 1) return;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", escalaX(i));
    label.setAttribute("y", altura + 14);
    label.setAttribute("font-size", "9");
    label.setAttribute("fill", "var(--ink-faint)");
    label.setAttribute("text-anchor", "middle");
    label.textContent = formatarDataCurta(p.data);
    svg.appendChild(label);
  });

  return svg;
}

function criarSvgBarras(semanas) {
  const largura = 320;
  const altura = 100;
  const margem = 16;
  const maxValor = Math.max(...semanas.map((s) => s.volume), 1);
  const larguraBarra = (largura - margem * 2) / semanas.length;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura + 16}`);
  svg.setAttribute("width", "100%");
  svg.style.display = "block";

  semanas.forEach((s, i) => {
    const alturaBarra = (s.volume / maxValor) * (altura - margem);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(margem + i * larguraBarra + 2));
    rect.setAttribute("y", String(altura - alturaBarra));
    rect.setAttribute("width", String(Math.max(larguraBarra - 4, 1)));
    rect.setAttribute("height", String(alturaBarra));
    rect.setAttribute("fill", "var(--accent)");
    rect.setAttribute("rx", "2");
    svg.appendChild(rect);
  });

  const rotuloPrimeira = document.createElementNS("http://www.w3.org/2000/svg", "text");
  rotuloPrimeira.setAttribute("x", String(margem));
  rotuloPrimeira.setAttribute("y", String(altura + 12));
  rotuloPrimeira.setAttribute("font-size", "9");
  rotuloPrimeira.setAttribute("fill", "var(--ink-faint)");
  rotuloPrimeira.setAttribute("text-anchor", "start");
  rotuloPrimeira.textContent = semanas[0].semana;
  svg.appendChild(rotuloPrimeira);

  const rotuloUltima = document.createElementNS("http://www.w3.org/2000/svg", "text");
  rotuloUltima.setAttribute("x", String(largura - margem));
  rotuloUltima.setAttribute("y", String(altura + 12));
  rotuloUltima.setAttribute("font-size", "9");
  rotuloUltima.setAttribute("fill", "var(--ink-faint)");
  rotuloUltima.setAttribute("text-anchor", "end");
  rotuloUltima.textContent = semanas[semanas.length - 1].semana;
  svg.appendChild(rotuloUltima);

  return svg;
}

function montarSecaoMedidas(main, db, linhasIniciais) {
  let linhas = linhasIniciais;

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Medidas corporais</div></div>
    <form class="sets medidas-form" style="padding:0 18px 18px;">
      <div class="set-field">
        <label>Data<input name="data" type="date" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" /></label>
      </div>
      <div class="set-field">
        <label>Peso (kg)<input name="peso_kg" type="number" step="0.1" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" /></label>
      </div>
      <div class="set-field">
        <label>Cintura (cm)<input name="cintura_cm" type="number" step="0.5" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" /></label>
      </div>
      <div class="set-field">
        <label>% Gordura<input name="percentualGordura" type="number" step="0.1" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" /></label>
      </div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1;">Registrar</button>
      <div class="prev-hint medidas-status" style="grid-column:1/-1;"></div>
    </form>
    <div class="sets medidas-graficos" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:16px;"></div>
  `;
  main.appendChild(card);

  const form = card.querySelector(".medidas-form");
  form.querySelector('input[name="data"]').value = obterDataLocal();
  const status = card.querySelector(".medidas-status");
  const graficosContainer = card.querySelector(".medidas-graficos");

  const METRICAS = [
    { campo: "peso_kg", titulo: "Peso (kg)" },
    { campo: "cintura_cm", titulo: "Cintura (cm)" },
    { campo: "percentualGordura", titulo: "% Gordura" },
  ];

  const desenharGraficos = () => {
    graficosContainer.innerHTML = "";
    for (const { campo, titulo } of METRICAS) {
      const pontos = prepararSerieTemporal(linhas, campo);
      if (pontos.length === 0) continue;
      const subCard = document.createElement("div");
      const rotulo = document.createElement("div");
      rotulo.className = "exercise-name";
      rotulo.style.fontSize = "0.85rem";
      rotulo.style.marginBottom = "6px";
      rotulo.textContent = titulo;
      subCard.appendChild(rotulo);
      subCard.appendChild(criarSvgLinha(pontos));
      graficosContainer.appendChild(subCard);
    }
  };
  desenharGraficos();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = form.querySelector('input[name="data"]').value;
    const peso_kg = form.querySelector('input[name="peso_kg"]').value;
    const cintura_cm = form.querySelector('input[name="cintura_cm"]').value;
    const percentualGordura = form.querySelector('input[name="percentualGordura"]').value;

    if (!data || (!peso_kg && !cintura_cm && !percentualGordura)) {
      status.textContent = "Preencha a data e ao menos uma medida.";
      return;
    }

    await registrarMedida(db, {
      data,
      peso_kg: peso_kg ? Number(peso_kg) : undefined,
      cintura_cm: cintura_cm ? Number(cintura_cm) : undefined,
      percentualGordura: percentualGordura ? Number(percentualGordura) : undefined,
    });

    linhas = await getMedidas(db);
    status.textContent = "Medida registrada.";
    form.querySelector('input[name="peso_kg"]').value = "";
    form.querySelector('input[name="cintura_cm"]').value = "";
    form.querySelector('input[name="percentualGordura"]').value = "";
    desenharGraficos();
  });
}
