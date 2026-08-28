// js/screens/evolucao.js
import { getAll, get } from "../data/db.js";
import { calcularProgressao1RM, calcularVolumeSemanalPorMusculo } from "../engine/graficos.js";
import { getMedidas, registrarMedida } from "../data/medidas.js";
import { prepararSerieTemporal } from "../engine/medidas.js";
import { calcularCoberturaMuscular } from "../engine/cobertura.js";
import { montarCardPostura } from "./postura.js";

const NOME_MUSCULO = {
  peito: "Peito", costas: "Costas", biceps: "Bíceps", triceps: "Tríceps",
  ombro: "Ombro (lateral)", deltoide_posterior: "Deltoide posterior",
  quadriceps: "Quadríceps", posterior_coxa: "Posterior de coxa",
  gluteo: "Glúteo", panturrilha: "Panturrilha", abdomen: "Abdômen",
  antebraco: "Antebraço", ombro_anterior: "Ombro (anterior)",
};
function nomeDoMusculo(chave) {
  return NOME_MUSCULO[chave] ?? chave.replace(/_/g, " ");
}

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function subtrairDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Heatmap de cobertura muscular — grade colorida em vez de barra fina, pra
// ler de relance quais músculos estão em dia e quais estão abaixo do alvo
// da fase, sem precisar ler número por número (Boostcamp Pro faz algo
// parecido). Cor por status (verde-lima = ok, âmbar = abaixo), intensidade
// proporcional a quão perto do alvo está.
function montarHeatmapCobertura(cobertura) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Cobertura muscular</div><div class="exercise-meta">7 dias</div></div>`;

  // Sem isso o card simplesmente sumia da tela quando não há série nos
  // últimos 7 dias — parecia que a funcionalidade nem existia, diferente do
  // resto da tela (Postura, por exemplo), que sempre mostra algum estado
  // vazio explicando o que falta.
  if (cobertura.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "prev-hint";
    vazio.style.cssText = "padding:0 18px 18px;";
    vazio.textContent = "Nenhuma série registrada nos últimos 7 dias — treine algo pra ver a cobertura por músculo aqui.";
    card.appendChild(vazio);
    return card;
  }

  const grid = document.createElement("div");
  grid.className = "heatmap-cobertura";
  for (const item of cobertura) {
    const pct = item.min != null ? Math.min(100, Math.max(0, Math.round((item.atual / item.min) * 100))) : 100;
    const corBase = item.abaixoDoAlvo ? "224, 176, 74" : "201, 242, 65"; // --aviso / --accent em rgb
    const opacidade = (0.14 + (pct / 100) * 0.6).toFixed(2);

    const celula = document.createElement("div");
    celula.className = "heatmap-celula";
    celula.style.background = `rgba(${corBase}, ${opacidade})`;
    celula.innerHTML = `<b></b><span></span>`;
    celula.querySelector("b").textContent = nomeDoMusculo(item.musculo);
    celula.querySelector("span").textContent = item.min != null ? `${item.atual}/${item.min}` : `${item.atual}`;
    grid.appendChild(celula);
  }
  card.appendChild(grid);
  return card;
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

  const [exercicios, todasAsSeries, linhasMedidas, protocolos, perfil] = await Promise.all([
    getAll(db, "exercicios"),
    getAll(db, "historicoSeries"),
    getMedidas(db),
    getAll(db, "protocolo"),
    get(db, "perfil", "1.0"),
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
    const protocolo = protocolos[0] ?? null;
    const definicaoFase = protocolo?.volumeSemanalPorFase?.[perfil?.fase?.atual ?? "definicao"];
    const seriesUltimos7Dias = todasAsSeries.filter((s) => s.data >= subtrairDias(hoje, 6));
    const cobertura = calcularCoberturaMuscular({ seriesUltimos7Dias, definicaoFase });
    main.appendChild(montarHeatmapCobertura(cobertura));

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
          <select class="select-exercicio"></select>
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

  // Com poucos pontos a linha some (1 ponto) ou quase não diz nada (2-4) — o
  // valor precisa aparecer escrito, senão sobra só uma bolinha sem
  // significado nenhum (era o caso do peso/1RM com um único registro).
  if (pontos.length <= 4) {
    pontos.forEach((p, i) => {
      const valorLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      valorLabel.setAttribute("x", escalaX(i));
      valorLabel.setAttribute("y", escalaY(p.valor) - 8);
      valorLabel.setAttribute("font-size", "11");
      valorLabel.setAttribute("font-weight", "700");
      valorLabel.setAttribute("fill", "var(--ink)");
      valorLabel.setAttribute("text-anchor", "middle");
      valorLabel.textContent = Number.isInteger(p.valor) ? p.valor : p.valor.toFixed(1);
      svg.appendChild(valorLabel);
    });
  }

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
  const slotBarra = (largura - margem * 2) / semanas.length;
  // Sem isso, com 1-2 semanas de dado a barra ocupa o slot inteiro e vira um
  // bloco sólido sem forma de "barra" nenhuma — trava a largura num valor
  // razoável mesmo quando o slot disponível é bem maior.
  const larguraBarra = Math.min(slotBarra - 4, 44);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura + 16}`);
  svg.setAttribute("width", "100%");
  svg.style.display = "block";

  semanas.forEach((s, i) => {
    const centroSlot = margem + i * slotBarra + slotBarra / 2;
    const alturaBarra = (s.volume / maxValor) * (altura - margem);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(centroSlot - larguraBarra / 2));
    rect.setAttribute("y", String(altura - alturaBarra));
    rect.setAttribute("width", String(Math.max(larguraBarra, 1)));
    rect.setAttribute("height", String(alturaBarra));
    rect.setAttribute("fill", "var(--accent)");
    rect.setAttribute("rx", "2");
    svg.appendChild(rect);

    // Mesma lógica do gráfico de linha: sem o número escrito, uma barra
    // sozinha não diz quase nada além de "existe volume".
    const valorLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    valorLabel.setAttribute("x", String(centroSlot));
    valorLabel.setAttribute("y", String(altura - alturaBarra - 6));
    valorLabel.setAttribute("font-size", "10");
    valorLabel.setAttribute("font-weight", "700");
    valorLabel.setAttribute("fill", "var(--ink)");
    valorLabel.setAttribute("text-anchor", "middle");
    valorLabel.textContent = Math.round(s.volume);
    svg.appendChild(valorLabel);
  });

  // Com uma única semana, "início" e "fim" são a mesma coisa — repetir o
  // mesmo rótulo nas duas pontas parecia um bug de renderização. Uma semana
  // só, centralizada, é o que realmente está sendo mostrado.
  if (semanas.length === 1) {
    const rotuloUnico = document.createElementNS("http://www.w3.org/2000/svg", "text");
    rotuloUnico.setAttribute("x", String(largura / 2));
    rotuloUnico.setAttribute("y", String(altura + 12));
    rotuloUnico.setAttribute("font-size", "9");
    rotuloUnico.setAttribute("fill", "var(--ink-faint)");
    rotuloUnico.setAttribute("text-anchor", "middle");
    rotuloUnico.textContent = semanas[0].semana;
    svg.appendChild(rotuloUnico);
    return svg;
  }

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
        <label>Data<input name="data" type="date" /></label>
      </div>
      <div class="set-field">
        <label>Peso (kg)<input name="peso_kg" type="number" step="0.1" /></label>
      </div>
      <div class="set-field">
        <label>Cintura (cm)<input name="cintura_cm" type="number" step="0.5" /></label>
      </div>
      <div class="set-field">
        <label>% Gordura<input name="percentualGordura" type="number" step="0.1" /></label>
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
