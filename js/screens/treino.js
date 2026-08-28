// js/screens/treino.js
import { getAll, get } from "../data/db.js";
import { getSeriesDoDia } from "../data/historico.js";
import { getHabito, registrarHabito } from "../data/habitos.js";
import { registrarCardio } from "../data/cardio.js";
import { getUltimoDiaRegistrado } from "../data/sequenciaSemanal.js";
import { DIAS_SEQUENCIA, obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { prepararSessaoDoDia } from "../engine/contextoSessao.js";
import { calcularEstatisticasSessao } from "../engine/sessao.js";
import { calcularAtividadeMensal } from "../engine/atividade.js";
import { getCardioRecente } from "../data/cardio.js";
import { getFicha, getInicioDoBloco } from "../data/ficha.js";
import { calcularSemanaDoBloco } from "../engine/fichaFixa.js";
import { planejarPausasPosturais, proximaPausaPostural, pausasPendentes } from "../engine/lembretes.js";
import { calcularSequenciaDias } from "../engine/consistencia.js";
import { calcularReadiness } from "../engine/readiness.js";
import { abrirNovaAtividade } from "./novaAtividade.js";
import { statusPermissao, pedirPermissaoNotificacao } from "../lib/notificacoes.js";

const MINUTOS_ESTIMADOS_POR_EXERCICIO = 7; // 3 séries + descanso, arredondado (heurística de exibição, não um limite do protocolo)
const DIAS_SEMANA_EXTENSO = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function saudacaoPorHorario(agora = new Date()) {
  const hora = agora.getHours();
  if (hora < 5) return "Boa noite";
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const ICONE_SINO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>`;
const ICONE_MAIS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
const ICONE_HALTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8"/></svg>`;
const ICONE_CHAMA = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s5 5 5 9a5 5 0 0 1-10 0c0-1.5.7-2.8.7-2.8S6 11 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12z"/></svg>`;
const ICONE_RELOGIO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>`;
const ICONE_RAIO = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>`;
const ICONE_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`;
const ICONE_CAPSULA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="16" height="6" rx="3" transform="rotate(-40 12 12)"/><line x1="9" y1="9" x2="15" y2="15" transform="rotate(-40 12 12)"/></svg>`;
const ICONE_LUA = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>`;
const ICONE_GOTA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c4 5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-8 7-13z"/></svg>`;
const ICONE_TACA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l-1 6a5 5 0 0 1-10 0L6 3z"/><path d="M12 14v6M9 20h6"/></svg>`;

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarTelaTreino(db, { onIrParaCardio, onIniciarCardio, onIniciarAtividadeAgora, onComecarTreino, onAbrirDia, onAtividadeAdicionada } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const [seriesDeHoje, todasAsSeries, ultimoDiaRegistrado, cardioRecente, ficha, inicioDoBloco, habito, perfil, todosCardios, todosRegistrosDiarios] = await Promise.all([
    getSeriesDoDia(db, hoje),
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getCardioRecente(db, 1),
    getFicha(db),
    getInicioDoBloco(db),
    getHabito(db, hoje),
    get(db, "perfil", "1.0"),
    getAll(db, "registrosCardio"),
    getAll(db, "registrosDiarios"),
  ]);
  // Sequência de dias seguidos com pelo menos uma atividade — treino,
  // cardio ou refeição marcada na dieta — mesmo reforço de consistência
  // que qualquer app de hábito usa (Duolingo, Strava).
  const datasComAtividade = new Set([
    ...todasAsSeries.filter((s) => s.tipoSerie !== "aquecimento").map((s) => s.data),
    ...todosCardios.map((c) => c.data),
    ...todosRegistrosDiarios.filter((r) => r.refeicoes && Object.keys(r.refeicoes).length > 0).map((r) => r.data),
  ]);
  const sequenciaDias = calcularSequenciaDias(datasComAtividade, hoje);
  const readiness = calcularReadiness({
    sonoOntem: habito?.sonoOntem ?? null,
    alcoolOntem: habito?.alcool === true,
    sequenciaDias,
  });
  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);
  const atividade = calcularAtividadeMensal(todasAsSeries, hoje);
  // "Último cardio" só conta pra hoje se foi de fato lançado hoje — antes o
  // card mostrava o último registro de qualquer dia (ex.: bicicleta de
  // ontem) por cima do cardio prescrito de hoje (ex.: escada).
  const ultimoCardioGeral = cardioRecente[0] ?? null;
  const cardioDeHojeLogado = ultimoCardioGeral?.data === hoje ? ultimoCardioGeral : null;
  const semanaDoBloco = calcularSemanaDoBloco(inicioDoBloco, hoje);
  const { exerciciosHoje } = prepararSessaoDoDia({
    todosExercicios, protocolo, todasAsSeries, hoje, diaInfo, ficha, semanaDoBloco,
  });
  const controladorHabitos = criarControladorHabitos(db, hoje, habito ?? {});

  const root = document.createElement("div");
  root.className = "tela-treino";

  const header = document.createElement("header");
  header.className = "top greeting";
  header.innerHTML = `
    <div>
      <div class="day-title">${saudacaoPorHorario()} 👋</div>
      <div class="date-label">${DIAS_SEMANA_EXTENSO[new Date().getDay()]} · Dia ${diaDaSessao} do ciclo</div>
      ${sequenciaDias > 0 ? `<div class="sequencia-chip">${ICONE_CHAMA}<span>${sequenciaDias} dia${sequenciaDias === 1 ? "" : "s"} seguido${sequenciaDias === 1 ? "" : "s"}</span></div>` : ""}
    </div>
    <div class="icon-row">
      <button type="button" class="icon-btn" aria-label="Notificações">${ICONE_SINO}${statusPermissao() === "default" ? '<i class="badge-dot" aria-hidden="true"></i>' : ""}</button>
      <button type="button" class="icon-btn lime" aria-label="Nova atividade">${ICONE_MAIS}</button>
    </div>
  `;
  root.appendChild(header);

  const sinoBtn = header.querySelector('[aria-label="Notificações"]');
  sinoBtn.addEventListener("click", async () => {
    if (statusPermissao() !== "default") return;
    await pedirPermissaoNotificacao();
    sinoBtn.querySelector(".badge-dot")?.remove();
  });

  // Compartilhado entre o "+" do cabeçalho e o card de cardio quando não há
  // nada prescrito nem registrado hoje (botão "Registrar") — os dois abrem
  // a mesma folha e reagem igual à escolha de "começar agora" vs "só registrar".
  async function abrirFluxoNovaAtividade() {
    const resultado = await abrirNovaAtividade(perfil?.dadosBasicos?.peso_kg);
    if (!resultado) return;
    const { iniciarAgora, ...dadosAtividade } = resultado;
    if (iniciarAgora && onIniciarAtividadeAgora) {
      onIniciarAtividadeAgora(dadosAtividade);
      return;
    }
    await registrarCardio(db, { data: hoje, ...dadosAtividade, mesmoDiaDeTreino: false });
    if (onAtividadeAdicionada) onAtividadeAdicionada();
  }

  const addBtn = header.querySelector('[aria-label="Nova atividade"]');
  addBtn.addEventListener("click", abrirFluxoNovaAtividade);

  const main = document.createElement("main");
  root.appendChild(main);

  main.appendChild(montarCardReadiness(readiness));
  main.appendChild(montarChipsHabitos(controladorHabitos));

  const totalSeriesPrevistas = exerciciosHoje.reduce((soma, e) => soma + (e.seriesAlvo ?? 3), 0);
  // A ficha traz a duração real de cada dia (séries × descanso prescrito). Só
  // cai na heurística de minutos-por-exercício quando o dia vem do gerador.
  const diaDaFichaHoje = ficha?.dias?.find((d) => d.numero === diaDaSessao) ?? null;
  const minutosEstimados = diaDaFichaHoje?.duracaoEstimadaMin
    ?? exerciciosHoje.length * MINUTOS_ESTIMADOS_POR_EXERCICIO;

  // O card de hoje precisa refletir o que já aconteceu — sem isso ele
  // continuava mostrando "Começar treino" com a contagem prevista mesmo
  // depois da sessão concluída, como se nada tivesse sido feito ainda.
  // O sinal de verdade é o mesmo que já é gravado (registrarDiaDaSessao):
  // sem registro pra hoje = não começado; registro com concluido:false =
  // começado mas não terminado; concluido:true = terminado.
  const registroDeHoje = ultimoDiaRegistrado?.data === hoje ? ultimoDiaRegistrado : null;
  const sessaoConcluidaHoje = registroDeHoje?.concluido === true;
  const sessaoIniciadaHoje = registroDeHoje != null && !sessaoConcluidaHoje;
  const statsHoje = calcularEstatisticasSessao(seriesDeHoje);

  const planoCard = document.createElement("section");
  planoCard.className = sessaoConcluidaHoje ? "plano-hero alt" : "plano-hero";
  planoCard.innerHTML = `
    <div class="rotulo">${sessaoConcluidaHoje ? "✓ Treino de hoje · concluído" : "Treino de hoje"}</div>
    <h2>${diaInfo.titulo}</h2>
    <div class="meta">
      ${sessaoConcluidaHoje
        ? `<span><b>${statsHoje.exerciciosTreinados}</b> exercícios</span><span><b>${statsHoje.totalSeries}</b> séries feitas</span>`
        : `<span><b>${exerciciosHoje.length}</b> exercícios</span><span><b>${totalSeriesPrevistas}</b> séries</span><span>~<b>${minutosEstimados}</b> min</span>`}
    </div>
    <button type="button">${sessaoConcluidaHoje ? "Ver treino" : sessaoIniciadaHoje ? "Continuar treino" : "Começar treino"}</button>
  `;
  planoCard.classList.add("clicavel");
  planoCard.addEventListener("click", () => {
    if (onComecarTreino) onComecarTreino();
  });

  const carrossel = document.createElement("div");
  carrossel.className = "carrossel-plano";
  carrossel.appendChild(planoCard);
  carrossel.appendChild(montarCardCardio(cardioDeHojeLogado, diaDaFichaHoje?.cardio, onIrParaCardio, onIniciarCardio, abrirFluxoNovaAtividade));
  for (let passo = 1; passo < DIAS_SEQUENCIA.length; passo++) {
    const numero = ((diaDaSessao - 1 + passo) % DIAS_SEQUENCIA.length) + 1;
    const diaFuturoInfo = obterDiaPorNumero(numero);
    const { exerciciosHoje: exerciciosDoDiaFuturo } = prepararSessaoDoDia({
      todosExercicios, protocolo, todasAsSeries, hoje, diaInfo: diaFuturoInfo, ficha, semanaDoBloco,
    });
    carrossel.appendChild(montarCardProximoDia(diaFuturoInfo, exerciciosDoDiaFuturo, () => {
      if (onAbrirDia) onAbrirDia(numero);
    }));
  }
  main.appendChild(carrossel);
  main.appendChild(montarDotsCarrossel(carrossel));

  main.appendChild(montarCardAtividade(atividade));

  const cardPausa = await montarCardPausaPostural(db, hoje, ficha?.pausaPostural);
  if (cardPausa) main.appendChild(cardPausa);

  main.appendChild(montarCardHabitos(controladorHabitos));

  return root;
}

// Estado compartilhado dos hábitos do dia entre os chips do topo e o card
// detalhado mais abaixo — evita os dois ficarem dessincronizados depois de
// um toque em qualquer um dos dois lugares.
function criarControladorHabitos(db, hoje, habitoInicial) {
  const habito = { ...habitoInicial };
  const assinantes = { creatina: [], alcool: [], sonoOntem: [], hidratacao: [] };

  function assinar(campo, aoMudar) {
    assinantes[campo].push(aoMudar);
    aoMudar(habito[campo]);
  }

  async function definir(campo, valor) {
    habito[campo] = valor;
    await registrarHabito(db, hoje, { [campo]: valor });
    for (const aoMudar of assinantes[campo]) aoMudar(valor);
  }

  return { habito, assinar, definir };
}

function montarDotsCarrossel(carrossel) {
  const dots = document.createElement("div");
  dots.className = "carrossel-dots";
  dots.setAttribute("aria-hidden", "true");
  for (let i = 0; i < carrossel.children.length; i++) {
    const dot = document.createElement("i");
    if (i === 0) dot.classList.add("on");
    dots.appendChild(dot);
  }

  let aguardandoFrame = false;
  carrossel.addEventListener("scroll", () => {
    if (aguardandoFrame) return;
    aguardandoFrame = true;
    requestAnimationFrame(() => {
      const primeiroCard = carrossel.children[0];
      const larguraCard = primeiroCard.getBoundingClientRect().width + 12;
      const indice = Math.round(carrossel.scrollLeft / larguraCard);
      dots.querySelectorAll("i").forEach((dot, i) => dot.classList.toggle("on", i === indice));
      aguardandoFrame = false;
    });
  }, { passive: true });

  return dots;
}

const ICONES_HABITO = { creatina: ICONE_CAPSULA, sonoOntem: ICONE_LUA, hidratacao: ICONE_GOTA, alcool: ICONE_TACA };

function criarChipToggle(controlador, campo, rotulo) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "habito-chip";
  chip.innerHTML = `<span class="ring" aria-hidden="true"></span><span class="txt">${rotulo}</span>`;
  const anel = chip.querySelector(".ring");
  chip.addEventListener("click", () => controlador.definir(campo, !controlador.habito[campo]));
  controlador.assinar(campo, (valor) => {
    chip.classList.toggle("done", valor === true);
    chip.setAttribute("aria-pressed", String(valor === true));
    anel.innerHTML = valor === true ? ICONE_CHECK : ICONES_HABITO[campo];
  });
  return chip;
}

function criarChipCiclo(controlador, campo, rotuloBase, opcoes) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "habito-chip";
  chip.innerHTML = `<span class="ring" aria-hidden="true">${ICONES_HABITO[campo]}</span><span class="txt">${rotuloBase}</span>`;
  const txt = chip.querySelector(".txt");
  chip.addEventListener("click", () => {
    const indiceAtual = opcoes.findIndex(([valor]) => valor === controlador.habito[campo]);
    const proximo = opcoes[(indiceAtual + 1) % opcoes.length][0];
    controlador.definir(campo, proximo);
  });
  controlador.assinar(campo, (valor) => {
    const opcao = opcoes.find(([v]) => v === valor);
    chip.classList.toggle("done", !!opcao);
    txt.textContent = opcao ? opcao[1] : rotuloBase;
  });
  return chip;
}

// Álcool por último — é o hábito menos frequente dos quatro, não precisa do
// primeiro toque disponível na fileira.
function montarChipsHabitos(controlador) {
  const linha = document.createElement("div");
  linha.className = "habito-chips";
  linha.appendChild(criarChipToggle(controlador, "creatina", "Creatina"));
  linha.appendChild(criarChipCiclo(controlador, "sonoOntem", "Sono", [
    ["bom", "Sono bom"], ["medio", "Sono médio"], ["ruim", "Sono ruim"],
  ]));
  linha.appendChild(criarChipCiclo(controlador, "hidratacao", "Água", [
    ["clara", "Água clara"], ["media", "Água média"], ["escura", "Água escura"],
  ]));
  linha.appendChild(criarChipToggle(controlador, "alcool", "Álcool"));
  return linha;
}

const CATEGORIA_READINESS_LABEL = { otimo: "Ótimo", bom: "Bom", atencao: "Atenção", baixo: "Baixo" };

function montarCardReadiness(readiness) {
  const card = document.createElement("section");
  card.className = "exercise-card readiness-card";
  card.innerHTML = `
    <div class="exercise-head">
      <div class="exercise-name">Como você está hoje</div>
      <div class="readiness-score readiness-${readiness.categoria}">${readiness.score}</div>
    </div>
    <div class="readiness-body">
      <div class="readiness-categoria">${CATEGORIA_READINESS_LABEL[readiness.categoria]}</div>
      ${readiness.fatores.length > 0
        ? `<ul class="readiness-fatores">${readiness.fatores.map((f) => `<li>${f}</li>`).join("")}</ul>`
        : `<p class="readiness-fatores-vazio">Nenhum fator negativo registrado — segue no ritmo.</p>`}
    </div>
  `;
  return card;
}

function horaAgora(agora = new Date()) {
  return `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
}

async function montarCardPausaPostural(db, hoje, pausaPostural) {
  if (!pausaPostural) return null;

  const habito = (await getHabito(db, hoje)) ?? {};
  const feitas = habito.pausasPosturais ?? 0;
  const horarios = planejarPausasPosturais();
  const agora = horaAgora();
  const proxima = proximaPausaPostural(horarios, agora);
  const pendentes = pausasPendentes(horarios, agora, feitas);

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head">
      <div>
        <div class="exercise-name">Pausa postural</div>
        <div class="exercise-meta"></div>
      </div>
      <div class="pausa-contador"></div>
    </div>
  `;
  card.querySelector(".exercise-meta").textContent = `${horarios.length} no expediente · ~2 min cada`;
  card.querySelector(".pausa-contador").textContent = `${feitas}/${horarios.length}`;

  const corpo = document.createElement("div");
  corpo.style.cssText = "padding:0 18px 18px;";
  card.appendChild(corpo);

  const status = document.createElement("p");
  status.className = "prev-hint";
  if (pendentes > 0) {
    status.style.color = "var(--accent)";
    status.textContent = `${pendentes} pausa${pendentes > 1 ? "s" : ""} pendente${pendentes > 1 ? "s" : ""} — faça agora, leva 2 minutos.`;
  } else if (proxima) {
    status.textContent = `Em dia. Próxima às ${proxima}.`;
  } else {
    status.textContent = feitas > 0 ? "Expediente encerrado — tudo feito por hoje." : "Fora do horário de expediente.";
  }
  corpo.appendChild(status);

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "swap-pill";
  botao.style.cssText = "width:100%; margin-top:10px;";
  botao.textContent = "Marcar pausa feita";
  botao.addEventListener("click", async () => {
    const novo = Math.min(horarios.length, feitas + 1);
    await registrarHabito(db, hoje, { pausasPosturais: novo });
    const atualizado = await montarCardPausaPostural(db, hoje, pausaPostural);
    card.replaceWith(atualizado);
  });
  corpo.appendChild(botao);

  const det = document.createElement("details");
  det.className = "explicacao-execucao";
  det.style.marginTop = "12px";
  const sum = document.createElement("summary");
  sum.textContent = "Os 4 movimentos";
  det.appendChild(sum);
  const porque = document.createElement("p");
  porque.textContent = pausaPostural.porque;
  det.appendChild(porque);
  for (const item of pausaPostural.exercicios) {
    const h = document.createElement("h5");
    h.textContent = `${item.nome} — ${item.prescricao}`;
    const p = document.createElement("p");
    p.textContent = item.como;
    det.append(h, p);
  }
  const lim = document.createElement("p");
  lim.style.cssText = "color:var(--ink-faint); margin-top:10px;";
  lim.textContent = pausaPostural.limitacao;
  det.appendChild(lim);
  corpo.appendChild(det);

  return card;
}

const OPCOES_AGUA = [
  ["clara", "Clara", "Urina clara ao longo do dia — hidratação boa."],
  ["media", "Amarela", "Amarelo médio — dá pra beber um pouco mais."],
  ["escura", "Escura", "Urina escura — beba mais água hoje."],
];

function montarCardHabitos(controlador) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Hábitos de hoje</div></div>`;

  const corpo = document.createElement("div");
  corpo.className = "sets";
  corpo.style.cssText = "padding:0 18px 18px; display:flex; flex-direction:column; gap:12px;";
  card.appendChild(corpo);

  const linhaToggle = (campo, rotulo) => {
    const linha = document.createElement("div");
    linha.style.cssText = "display:flex; align-items:center; justify-content:space-between;";
    linha.innerHTML = `<span>${rotulo}</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swap-pill";
    btn.addEventListener("click", () => controlador.definir(campo, !controlador.habito[campo]));
    controlador.assinar(campo, (valor) => {
      btn.textContent = valor === true ? "Sim" : valor === false ? "Não" : "Marcar";
      btn.classList.toggle("selecionada", valor === true);
    });
    linha.appendChild(btn);
    return linha;
  };

  corpo.appendChild(linhaToggle("creatina", "Creatina hoje"));

  const linhaSono = document.createElement("div");
  linhaSono.innerHTML = `<span>Sono de ontem</span>`;
  const opcoesSono = document.createElement("div");
  opcoesSono.style.cssText = "display:flex; gap:8px; margin-top:6px;";
  for (const [valor, rotulo] of [["bom", "Bom"], ["medio", "Médio"], ["ruim", "Ruim"]]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swap-pill";
    btn.textContent = rotulo;
    btn.addEventListener("click", () => controlador.definir("sonoOntem", valor));
    controlador.assinar("sonoOntem", (valorAtual) => btn.classList.toggle("selecionada", valorAtual === valor));
    opcoesSono.appendChild(btn);
  }
  linhaSono.appendChild(opcoesSono);
  corpo.appendChild(linhaSono);

  // Hidratação por cor da urina, não por litros. Meta fixa de litros tem
  // evidência fraca e vira contabilidade inútil; a cor é o marcador prático
  // que a própria pessoa consegue ler várias vezes por dia.
  const linhaAgua = document.createElement("div");
  linhaAgua.innerHTML = `<span>Hidratação hoje</span>`;
  const opcoesAgua = document.createElement("div");
  opcoesAgua.style.cssText = "display:flex; gap:8px; margin-top:6px;";
  const notaAgua = document.createElement("div");
  notaAgua.className = "prev-hint";
  notaAgua.style.marginTop = "6px";
  for (const [valor, rotulo] of OPCOES_AGUA) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swap-pill";
    btn.textContent = rotulo;
    btn.addEventListener("click", () => controlador.definir("hidratacao", valor));
    controlador.assinar("hidratacao", (valorAtual) => btn.classList.toggle("selecionada", valorAtual === valor));
    opcoesAgua.appendChild(btn);
  }
  controlador.assinar("hidratacao", (valorAtual) => {
    const opcao = OPCOES_AGUA.find(([v]) => v === valorAtual);
    notaAgua.textContent = opcao ? opcao[2] : "Marque pela cor da urina — é mais útil que contar litros.";
  });
  linhaAgua.append(opcoesAgua, notaAgua);
  corpo.appendChild(linhaAgua);

  corpo.appendChild(linhaToggle("alcool", "Álcool hoje"));

  return card;
}

const NOME_MODALIDADE_CARDIO = {
  bicicleta: "Bicicleta",
  eliptico: "Elíptico",
  escada: "Escada",
  caminhada: "Caminhada",
  corrida: "Corrida",
  patins: "Patins",
  volei_praia: "Vôlei de praia",
  beach_tenis: "Beach tênis",
};

function montarCardCardio(cardioLogadoHoje, cardioDeHoje, onIrParaCardio, onIniciarCardio, onRegistrarSemPrescricao) {
  const card = document.createElement("section");
  // Mesmo tratamento visual do "Treino de hoje" quando feito — card muda de
  // lima pra escuro e ganha o "✓ ... concluído" no rótulo. Sem isso, cardio
  // já registrado ficava com a MESMA cara de cardio ainda pendente, só o
  // texto do botão ("Ver mais") avisava, fácil de não notar.
  card.className = cardioLogadoHoje ? "plano-hero alt" : "plano-hero";

  const rotulo = document.createElement("div");
  rotulo.className = "rotulo";
  rotulo.textContent = cardioLogadoHoje ? "✓ Cardio · concluído" : "Cardio";
  card.appendChild(rotulo);

  const titulo = document.createElement("h2");
  if (cardioLogadoHoje) {
    titulo.textContent = NOME_MODALIDADE_CARDIO[cardioLogadoHoje.modalidade] ?? cardioLogadoHoje.modalidade;
  } else if (cardioDeHoje) {
    titulo.textContent = NOME_MODALIDADE_CARDIO[cardioDeHoje.modalidade] ?? cardioDeHoje.modalidade;
  } else {
    titulo.textContent = "Nenhum cardio hoje";
  }
  card.appendChild(titulo);

  const meta = document.createElement("div");
  meta.className = "meta";
  if (cardioLogadoHoje && cardioLogadoHoje.duracaoMinutos) {
    const duracao = document.createElement("span");
    duracao.innerHTML = `<b>${cardioLogadoHoje.duracaoMinutos}</b> min`;
    meta.appendChild(duracao);
  } else if (cardioLogadoHoje) {
    const semDuracao = document.createElement("span");
    semDuracao.textContent = "Duração não registrada";
    meta.appendChild(semDuracao);
  } else if (cardioDeHoje) {
    const previsto = document.createElement("span");
    previsto.innerHTML = cardioDeHoje.duracaoMin
      ? `Previsto pra hoje · <b>${cardioDeHoje.duracaoMin}</b> min`
      : "Previsto pra hoje";
    meta.appendChild(previsto);
  } else {
    const vazio = document.createElement("span");
    vazio.textContent = "Nenhum cardio prescrito hoje";
    meta.appendChild(vazio);
  }
  card.appendChild(meta);

  // Com cardio prescrito e ainda não feito, o botão abre o cronômetro da
  // sessão em vez de mandar pra tela de lançamento manual — registrar vem
  // depois, no fim do tempo, com os minutos que realmente rolaram.
  const podeIniciar = !cardioLogadoHoje && cardioDeHoje;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.textContent = cardioLogadoHoje ? "Ver mais" : podeIniciar ? "Iniciar" : "Registrar";
  botao.addEventListener("click", () => {
    if (podeIniciar && onIniciarCardio) onIniciarCardio(cardioDeHoje);
    else if (cardioLogadoHoje && onIrParaCardio) onIrParaCardio(cardioLogadoHoje);
    else if (!cardioLogadoHoje && !cardioDeHoje && onRegistrarSemPrescricao) onRegistrarSemPrescricao();
  });
  card.appendChild(botao);

  return card;
}

function montarCardProximoDia(dia, exerciciosDoDia, aoClicar) {
  const totalSeries = exerciciosDoDia.reduce((soma, e) => soma + (e.seriesAlvo ?? 3), 0);
  const minutosEstimados = exerciciosDoDia.length * MINUTOS_ESTIMADOS_POR_EXERCICIO;
  const card = document.createElement("section");
  card.className = "plano-hero alt clicavel";
  card.innerHTML = `
    <div class="rotulo">Dia ${dia.numero}</div>
    <h2>${dia.titulo}</h2>
    <div class="meta">
      <span><b>${exerciciosDoDia.length}</b> exercícios</span>
      <span><b>${totalSeries}</b> séries</span>
      <span>~<b>${minutosEstimados}</b> min</span>
    </div>
    <button type="button">Ver treino</button>
  `;
  card.addEventListener("click", aoClicar);
  return card;
}

function formatarMinutosAtivos(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

function montarCardAtividade(atividade) {
  const section = document.createElement("section");
  section.className = "atividade-secao";

  const cabecalho = document.createElement("div");
  cabecalho.className = "shead";
  const h4 = document.createElement("h4");
  h4.textContent = "Minha atividade";
  cabecalho.appendChild(h4);
  section.appendChild(cabecalho);

  const grid = document.createElement("div");
  grid.className = "stats-grid com-destaque";
  grid.appendChild(criarStatTile(ICONE_RAIO, String(atividade.diasSeguidos), "Dias seguidos", "stat-tile-destaque"));
  grid.appendChild(criarStatTile(ICONE_HALTER, String(atividade.treinosEsteMes), "Treinos este mês"));
  grid.appendChild(criarStatTile(ICONE_CHAMA, String(atividade.seriesEstaSemana), "Séries esta semana"));
  grid.appendChild(criarStatTile(ICONE_RELOGIO, `~${formatarMinutosAtivos(atividade.minutosAtivosEstaSemana)}`, "Tempo ativo (estimado)", "stat-tile-largo"));
  section.appendChild(grid);

  return section;
}

function criarStatTile(icone, valor, rotulo, classeExtra = "") {
  const tile = document.createElement("div");
  tile.className = classeExtra ? `stat-tile ${classeExtra}` : "stat-tile";
  const ic = document.createElement("div");
  ic.className = "ic";
  ic.innerHTML = icone;
  const b = document.createElement("b");
  b.textContent = valor;
  const span = document.createElement("span");
  span.textContent = rotulo;
  tile.appendChild(ic);
  tile.appendChild(b);
  tile.appendChild(span);
  return tile;
}
