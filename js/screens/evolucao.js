// js/screens/evolucao.js
import { getAll, get } from "../data/db.js";
import { calcularProgressao1RM, calcularProgressaoCarga, calcularVolumeSemanalPorMusculo } from "../engine/graficos.js";
import { getMedidas, registrarMedida } from "../data/medidas.js";
import { prepararSerieTemporal } from "../engine/medidas.js";
import { calcularCoberturaMuscular } from "../engine/cobertura.js";
import { criarSvgLinha } from "../lib/graficoLinha.js";
import { salvarTesteSalto, getTestesSalto, diasAteProximoTeste, DIAS_ENTRE_TESTES } from "../data/testesSalto.js";
import { listarRecordesPorExercicio } from "../engine/recordes.js";
import { expandirContribuicoes } from "../engine/volume.js";
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
    // Séries indiretas contam pela fração do catálogo (as faixas do
    // protocolo são em séries fracionadas).
    const cobertura = calcularCoberturaMuscular({ seriesUltimos7Dias: expandirContribuicoes(seriesUltimos7Dias, exercicios), definicaoFase });
    main.appendChild(montarHeatmapCobertura(cobertura));

    montarSecaoCarga(main, exercicios, todasAsSeries);
    montarSecaoRecordes(main, exercicios, todasAsSeries);
    montarSecaoVolume(main, expandirContribuicoes(todasAsSeries, exercicios));
  }

  await montarSecaoSalto(main, db);
  montarSecaoMedidas(main, db, linhasMedidas);

  return root;
}

// Recordes pessoais por exercício — lista fixa, que antes só existia como
// aviso passageiro na hora da série e no resumo do dia.
function montarSecaoRecordes(main, exercicios, todasAsSeries) {
  const recordes = listarRecordesPorExercicio(todasAsSeries, exercicios);
  if (recordes.length === 0) return;
  const kg = (v) => String(v).replace(".", ",");
  const dataCurta = (iso) => iso.split("-").reverse().slice(0, 2).join("/");

  const card = document.createElement("details");
  card.className = "exercise-card recordes-card";
  card.innerHTML = `<summary class="exercise-head"><div class="exercise-name">Recordes pessoais</div><div class="exercise-meta"></div></summary><div class="recordes-lista"></div>`;
  card.querySelector(".exercise-meta").textContent = `${recordes.length} exercícios`;
  const lista = card.querySelector(".recordes-lista");
  for (const r of recordes) {
    const item = document.createElement("div");
    item.className = "recorde-item";
    const partes = [];
    if (r.maiorCarga) partes.push(`maior carga ${kg(r.maiorCarga.carga)} kg × ${r.maiorCarga.reps} (${dataCurta(r.maiorCarga.data)})`);
    if (r.melhor1RM) partes.push(`1RM est. ${kg(r.melhor1RM.valor)} kg`);
    if (r.maisReps) partes.push(`mais reps ${r.maisReps.reps}${r.maisReps.carga > 0 ? ` com ${kg(r.maisReps.carga)} kg` : ""}`);
    item.innerHTML = `<b></b><span></span>`;
    item.querySelector("b").textContent = r.nome;
    item.querySelector("span").textContent = partes.join(" · ");
    lista.appendChild(item);
  }
  main.appendChild(card);
}

function montarSecaoCarga(main, exercicios, todasAsSeries) {
  const idsComHistorico = new Set(todasAsSeries.map((s) => s.exercicioId));
  const exerciciosComHistorico = exercicios.filter((e) => idsComHistorico.has(e.id));
  if (exerciciosComHistorico.length === 0) return;

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Progressão de carga</div><div class="exercise-meta grafico-tipo"></div></div>
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
    // 1RM estimado só vale com séries de até 12 reps; isoladores de
    // 12–25 reps caem na maior carga de trabalho de cada dia.
    const pontos1RM = calcularProgressao1RM(seriesDoExercicio);
    const pontos = pontos1RM.length > 0
      ? pontos1RM.map((p) => ({ data: p.data, valor: p.carga1RM }))
      : calcularProgressaoCarga(seriesDoExercicio).map((p) => ({ data: p.data, valor: p.carga }));
    card.querySelector(".grafico-tipo").textContent = pontos1RM.length > 0 ? "1RM estimado" : "maior carga do dia";
    container.innerHTML = "";
    if (pontos.length === 0) {
      container.innerHTML = `<p class="prev-hint">Sem dados suficientes para este exercício.</p>`;
      return;
    }
    container.appendChild(criarSvgLinha(pontos));
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
    head.querySelector(".exercise-name").textContent = `Volume semanal — ${nomeDoMusculo(musculo)}`;
    card.appendChild(head);

    const corpo = document.createElement("div");
    corpo.className = "sets";
    corpo.style.padding = "0 18px 18px";
    corpo.appendChild(criarSvgBarras(semanas));
    card.appendChild(corpo);

    main.appendChild(card);
  }
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

// Salto vertical (dia de Pernas + Impulsão): registro do teste do app My
// Jump a cada 3 semanas e o gráfico da evolução.
async function montarSecaoSalto(main, db) {
  const hoje = obterDataLocal();
  let testes = await getTestesSalto(db);

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Salto vertical</div><div class="exercise-meta salto-proximo"></div></div>
    <form class="sets salto-form" style="padding:0 18px 12px;">
      <div class="set-field"><label>Data<input name="data" type="date" /></label></div>
      <div class="set-field"><label>Salto, mãos na cintura (cm)<input name="cmj" type="text" inputmode="decimal" placeholder="ex.: 41,5" /></label></div>
      <div class="set-field"><label>Com balanço dos braços (cm, opcional)<input name="cmjBracos" type="text" inputmode="decimal" placeholder="ex.: 48" /></label></div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1;">Registrar teste</button>
      <div class="prev-hint salto-status" style="grid-column:1/-1;"></div>
    </form>
    <details class="salto-como" style="padding:0 18px 12px;">
      <summary class="prev-hint" style="padding:0; cursor:pointer;">Como fazer o teste</summary>
      <p class="prev-hint" style="padding:6px 0 0;">A cada 3 semanas, no começo do dia de pernas, depois do aquecimento. Use o app My Jump (validado contra plataforma de força): 3 saltos com as mãos na cintura, 1 min de pausa entre eles, registre o melhor. Sempre no mesmo lugar e com o mesmo tênis. Ganho esperado pra quem já é treinado: de 1 a 4 cm em umas 6 semanas.</p>
    </details>
    <div class="salto-grafico" style="padding:0 18px 18px;"></div>
  `;
  main.appendChild(card);

  const form = card.querySelector(".salto-form");
  form.data.value = hoje;
  form.data.max = hoje;
  const status = card.querySelector(".salto-status");
  const proximoEl = card.querySelector(".salto-proximo");
  const graficoEl = card.querySelector(".salto-grafico");

  function desenhar() {
    const faltam = diasAteProximoTeste(testes, hoje);
    proximoEl.textContent = faltam === 0 ? "dia de teste" : `próximo teste em ${faltam} dia${faltam === 1 ? "" : "s"}`;
    graficoEl.innerHTML = "";
    if (testes.length === 0) {
      graficoEl.innerHTML = `<p class="prev-hint" style="padding:0;">Faça o primeiro teste pra ter a linha de base.</p>`;
      return;
    }
    graficoEl.appendChild(criarSvgLinha(testes.map((t) => ({ data: t.data, valor: t.cmjCm }))));
    const primeiro = testes[0];
    const ultimo = testes.at(-1);
    const resumo = document.createElement("p");
    resumo.className = "prev-hint";
    resumo.style.padding = "8px 0 0";
    const diferenca = Math.round((ultimo.cmjCm - primeiro.cmjCm) * 10) / 10;
    resumo.textContent = testes.length > 1
      ? `Do primeiro teste até agora: ${diferenca >= 0 ? "+" : ""}${String(diferenca).replace(".", ",")} cm.`
      : `Linha de base: ${String(ultimo.cmjCm).replace(".", ",")} cm. Próximo teste daqui a ${DIAS_ENTRE_TESTES} dias.`;
    graficoEl.appendChild(resumo);
  }
  desenhar();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cmj = Number(String(form.cmj.value).replace(",", "."));
    const bracos = form.cmjBracos.value ? Number(String(form.cmjBracos.value).replace(",", ".")) : null;
    if (!form.data.value || !(cmj > 0 && cmj < 150)) {
      status.textContent = "Coloque a data e a altura do salto em centímetros (ex.: 41,5).";
      return;
    }
    if (form.data.value > hoje) {
      status.textContent = "A data do teste não pode ser no futuro.";
      return;
    }
    if (bracos != null && !(bracos > 0 && bracos < 150)) {
      status.textContent = "O salto com os braços precisa ser em centímetros (ex.: 48), ou deixe em branco.";
      return;
    }
    await salvarTesteSalto(db, { data: form.data.value, cmjCm: cmj, cmjBracosCm: bracos });
    testes = await getTestesSalto(db);
    form.cmj.value = "";
    form.cmjBracos.value = "";
    status.textContent = "Teste registrado.";
    desenhar();
  });
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

  // A cintura é a métrica principal do objetivo de gordura abdominal. O
  // valor inicial do perfil (62 cm pra 170 cm/71 kg) é implausível — abaixo
  // de ~65 cm em adulto quase sempre é medida errada (fita no lugar errado
  // ou apertada), e uma tendência que parte de um ponto errado não serve.
  const CINTURA_SUSPEITA_CM = 65;
  const desenharGraficos = () => {
    graficosContainer.innerHTML = "";
    const cinturas = prepararSerieTemporal(linhas, "cintura_cm");
    const ultimaCintura = cinturas.at(-1)?.valor;
    if (ultimaCintura != null && ultimaCintura < CINTURA_SUSPEITA_CM) {
      const aviso = document.createElement("p");
      aviso.className = "prev-hint";
      aviso.style.padding = "0";
      aviso.textContent = `A última cintura registrada (${ultimaCintura} cm) parece baixa demais — confira: fita na altura do umbigo, reta, sem apertar, medindo com o ar solto. É a métrica principal do objetivo de gordura abdominal.`;
      graficosContainer.appendChild(aviso);
    }
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
