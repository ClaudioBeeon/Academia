// js/screens/treino.js
import { getAll } from "../data/db.js";
import { getSeriesDoDia } from "../data/historico.js";
import { getCheckin, registrarCheckin } from "../data/checkin.js";
import { getHabito, registrarHabito } from "../data/habitos.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { DIAS_SEQUENCIA, obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { prepararSessaoDoDia } from "../engine/contextoSessao.js";
import { calcularAtividadeMensal } from "../engine/atividade.js";
import { getCardioRecente } from "../data/cardio.js";
import { getFicha, getInicioDoBloco } from "../data/ficha.js";
import { calcularSemanaDoBloco } from "../engine/fichaFixa.js";
import { planejarPausasPosturais, proximaPausaPostural, pausasPendentes } from "../engine/lembretes.js";

const MINUTOS_ESTIMADOS_POR_EXERCICIO = 7; // 3 séries + descanso, arredondado (heurística de exibição, não um limite do protocolo)

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

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarTelaTreino(db, { onIrParaCardio, onComecarTreino, onAbrirDia } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const [seriesDeHoje, todasAsSeries, ultimoDiaRegistrado, cardioRecente, ficha, inicioDoBloco] = await Promise.all([
    getSeriesDoDia(db, hoje),
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getCardioRecente(db, 1),
    getFicha(db),
    getInicioDoBloco(db),
  ]);
  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);
  const atividade = calcularAtividadeMensal(todasAsSeries, hoje);
  const ultimoCardio = cardioRecente[0] ?? null;
  const semanaDoBloco = calcularSemanaDoBloco(inicioDoBloco, hoje);
  const { exerciciosHoje } = prepararSessaoDoDia({
    todosExercicios, protocolo, todasAsSeries, hoje, diaInfo, ficha, semanaDoBloco,
  });

  const root = document.createElement("div");
  root.className = "tela-treino";

  const header = document.createElement("header");
  header.className = "top greeting";
  header.innerHTML = `
    <div>
      <div class="date-label">${saudacaoPorHorario()} 👋</div>
      <div class="day-title">Pronto pra treinar?</div>
    </div>
    <div class="icon-row">
      <button type="button" class="icon-btn" aria-label="Notificações">${ICONE_SINO}</button>
      <button type="button" class="icon-btn lime" aria-label="Adicionar">${ICONE_MAIS}</button>
    </div>
  `;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const totalSeriesPrevistas = exerciciosHoje.reduce((soma, e) => soma + (e.seriesAlvo ?? 3), 0);
  // A ficha traz a duração real de cada dia (séries × descanso prescrito). Só
  // cai na heurística de minutos-por-exercício quando o dia vem do gerador.
  const diaDaFichaHoje = ficha?.dias?.find((d) => d.numero === diaDaSessao) ?? null;
  const minutosEstimados = diaDaFichaHoje?.duracaoEstimadaMin
    ?? exerciciosHoje.length * MINUTOS_ESTIMADOS_POR_EXERCICIO;
  const planoCard = document.createElement("section");
  planoCard.className = "plano-hero";
  planoCard.innerHTML = `
    <div class="rotulo">Treino de hoje</div>
    <h2>${diaInfo.titulo}</h2>
    <div class="meta">
      <span><b>${exerciciosHoje.length}</b> exercícios</span>
      <span><b>${totalSeriesPrevistas}</b> séries</span>
      <span>~<b>${minutosEstimados}</b> min</span>
    </div>
    <button type="button">Começar treino</button>
  `;
  planoCard.classList.add("clicavel");
  planoCard.addEventListener("click", () => {
    if (onComecarTreino) onComecarTreino();
  });

  if (seriesDeHoje.length === 0) {
    const seletorDia = document.createElement("select");
    seletorDia.className = "trocar-dia-select";
    seletorDia.style.cssText = "width:100%; max-width:100%; background:var(--accent-ink); color:var(--accent); border:none; border-radius:8px; font-size:0.85rem; padding:6px 8px; margin-top:8px; cursor:pointer; font-family:inherit;";
    seletorDia.innerHTML = DIAS_SEQUENCIA.map((d) =>
      `<option value="${d.numero}">Dia ${d.numero}: ${d.titulo}</option>`
    ).join("");
    seletorDia.value = String(diaDaSessao);
    seletorDia.addEventListener("click", (event) => event.stopPropagation());
    seletorDia.addEventListener("change", async () => {
      await registrarDiaDaSessao(db, Number(seletorDia.value), hoje);
      window.location.reload();
    });
    planoCard.insertBefore(seletorDia, planoCard.querySelector("button"));
  }

  const carrossel = document.createElement("div");
  carrossel.className = "carrossel-plano";
  carrossel.appendChild(planoCard);
  carrossel.appendChild(montarCardCardio(ultimoCardio, onIrParaCardio));
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

  main.appendChild(montarCardAtividade(atividade));

  main.appendChild(await montarCardCheckin(db, hoje));
  const cardPausa = await montarCardPausaPostural(db, hoje, ficha?.pausaPostural);
  if (cardPausa) main.appendChild(cardPausa);

  main.appendChild(await montarCardHabitos(db, hoje));

  return root;
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

async function montarCardHabitos(db, hoje) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Hábitos de hoje</div></div>`;

  const corpo = document.createElement("div");
  corpo.className = "sets";
  corpo.style.cssText = "padding:0 18px 18px; display:flex; flex-direction:column; gap:12px;";
  card.appendChild(corpo);

  const habito = (await getHabito(db, hoje)) ?? {};

  const linhaToggle = (campo, rotulo) => {
    const linha = document.createElement("div");
    linha.style.cssText = "display:flex; align-items:center; justify-content:space-between;";
    linha.innerHTML = `<span>${rotulo}</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swap-pill";
    const atualizarTexto = (valor) => { btn.textContent = valor === true ? "Sim" : valor === false ? "Não" : "Marcar"; };
    atualizarTexto(habito[campo]);
    btn.addEventListener("click", async () => {
      const novoValor = !habito[campo];
      habito[campo] = novoValor;
      await registrarHabito(db, hoje, { [campo]: novoValor });
      atualizarTexto(novoValor);
    });
    linha.appendChild(btn);
    return linha;
  };

  corpo.appendChild(linhaToggle("creatina", "Creatina hoje"));
  corpo.appendChild(linhaToggle("alcool", "Álcool hoje"));

  const linhaSono = document.createElement("div");
  linhaSono.innerHTML = `<span>Sono de ontem</span>`;
  const opcoesSono = document.createElement("div");
  opcoesSono.style.cssText = "display:flex; gap:8px; margin-top:6px;";
  for (const [valor, rotulo] of [["bom", "Bom"], ["medio", "Médio"], ["ruim", "Ruim"]]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swap-pill";
    btn.textContent = rotulo;
    btn.style.opacity = habito.sonoOntem === valor ? "1" : "0.5";
    btn.addEventListener("click", async () => {
      habito.sonoOntem = valor;
      await registrarHabito(db, hoje, { sonoOntem: valor });
      opcoesSono.querySelectorAll("button").forEach((b) => { b.style.opacity = b === btn ? "1" : "0.5"; });
    });
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
  const OPCOES_AGUA = [
    ["clara", "Clara", "Urina clara ao longo do dia — hidratação boa."],
    ["media", "Amarela", "Amarelo médio — dá pra beber um pouco mais."],
    ["escura", "Escura", "Urina escura — beba mais água hoje."],
  ];
  const notaAgua = document.createElement("div");
  notaAgua.className = "prev-hint";
  notaAgua.style.marginTop = "6px";
  const atualizarNotaAgua = (valor) => {
    const opcao = OPCOES_AGUA.find(([v]) => v === valor);
    notaAgua.textContent = opcao ? opcao[2] : "Marque pela cor da urina — é mais útil que contar litros.";
  };
  for (const [valor, rotulo] of OPCOES_AGUA) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swap-pill";
    btn.textContent = rotulo;
    btn.style.opacity = habito.hidratacao === valor ? "1" : "0.5";
    btn.addEventListener("click", async () => {
      habito.hidratacao = valor;
      await registrarHabito(db, hoje, { hidratacao: valor });
      opcoesAgua.querySelectorAll("button").forEach((b) => { b.style.opacity = b === btn ? "1" : "0.5"; });
      atualizarNotaAgua(valor);
    });
    opcoesAgua.appendChild(btn);
  }
  atualizarNotaAgua(habito.hidratacao);
  linhaAgua.append(opcoesAgua, notaAgua);
  corpo.appendChild(linhaAgua);

  return card;
}

async function montarCardCheckin(db, hoje) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Check-in de hoje</div></div>`;

  const corpo = document.createElement("div");
  card.appendChild(corpo);

  const checkinExistente = await getCheckin(db, hoje);
  if (checkinExistente?.qualidadePercebida !== undefined) {
    renderizarResumoCheckin(corpo, db, hoje, checkinExistente);
  } else {
    renderizarFormularioCheckin(corpo, db, hoje, checkinExistente);
  }

  return card;
}

function renderizarResumoCheckin(corpo, db, hoje, checkin) {
  corpo.innerHTML = "";

  const resumo = document.createElement("div");
  resumo.className = "prev-hint";
  resumo.style.padding = "0 18px 18px";
  const partes = [`Qualidade: ${checkin.qualidadePercebida}/5`];
  if (checkin.bemEstarBaixo) partes.push("sono/motivação baixos");
  if (checkin.dorArticularOuTendinea) partes.push("dor articular/tendínea");
  if (checkin.domsPersistente) partes.push("dor muscular residual");
  resumo.textContent = partes.join(" · ");
  corpo.appendChild(resumo);

  const editarBtn = document.createElement("button");
  editarBtn.type = "button";
  editarBtn.className = "swap-pill";
  editarBtn.textContent = "Editar";
  editarBtn.style.margin = "0 18px 18px";
  editarBtn.addEventListener("click", () => renderizarFormularioCheckin(corpo, db, hoje, checkin));
  corpo.appendChild(editarBtn);
}

function renderizarFormularioCheckin(corpo, db, hoje, checkinExistente) {
  corpo.innerHTML = "";

  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0 18px 18px";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Como foi a sessão hoje, no geral? (1-5)</label>
      <input type="hidden" name="qualidadePercebida" value="3" />
      <div class="checkin-qual" role="radiogroup" aria-label="Qualidade percebida">
        <button type="button" data-valor="1">1</button>
        <button type="button" data-valor="2">2</button>
        <button type="button" data-valor="3" class="on">3</button>
        <button type="button" data-valor="4">4</button>
        <button type="button" data-valor="5">5</button>
      </div>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label><input type="checkbox" name="bemEstarBaixo" /> Sono ruim, motivação baixa ou irritação sustentada hoje?</label>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label><input type="checkbox" name="dorArticularOuTendinea" /> Alguma dor articular ou de tendão persistente?</label>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label><input type="checkbox" name="domsPersistente" /> Ainda com dor muscular do treino anterior?</label>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
  `;

  const qualidadeInput = form.qualidadePercebida;
  form.querySelectorAll(".checkin-qual button").forEach((botao) => {
    botao.addEventListener("click", () => {
      qualidadeInput.value = botao.dataset.valor;
      form.querySelectorAll(".checkin-qual button").forEach((b) => b.classList.toggle("on", b === botao));
    });
  });

  if (checkinExistente) {
    qualidadeInput.value = String(checkinExistente.qualidadePercebida ?? 3);
    form.querySelectorAll(".checkin-qual button").forEach((b) => b.classList.toggle("on", b.dataset.valor === qualidadeInput.value));
    form.bemEstarBaixo.checked = !!checkinExistente.bemEstarBaixo;
    form.dorArticularOuTendinea.checked = !!checkinExistente.dorArticularOuTendinea;
    form.domsPersistente.checked = !!checkinExistente.domsPersistente;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const campos = {
      qualidadePercebida: Number(form.qualidadePercebida.value),
      bemEstarBaixo: form.bemEstarBaixo.checked,
      dorArticularOuTendinea: form.dorArticularOuTendinea.checked,
      domsPersistente: form.domsPersistente.checked,
    };
    const salvo = await registrarCheckin(db, hoje, campos);
    renderizarResumoCheckin(corpo, db, hoje, salvo);
  });

  corpo.appendChild(form);
}

const NOME_MODALIDADE_CARDIO = {
  bicicleta: "Bicicleta",
  eliptico: "Elíptico",
  escada: "Escada",
  caminhada: "Caminhada",
  corrida: "Corrida",
};

function montarCardCardio(ultimoCardio, onIrParaCardio) {
  const card = document.createElement("section");
  card.className = "plano-hero";

  const rotulo = document.createElement("div");
  rotulo.className = "rotulo";
  rotulo.textContent = "Cardio";
  card.appendChild(rotulo);

  const titulo = document.createElement("h2");
  if (ultimoCardio) {
    titulo.textContent = NOME_MODALIDADE_CARDIO[ultimoCardio.modalidade] ?? ultimoCardio.modalidade;
  } else {
    titulo.textContent = "Nenhum registro ainda";
  }
  card.appendChild(titulo);

  const meta = document.createElement("div");
  meta.className = "meta";
  if (ultimoCardio && ultimoCardio.duracaoMinutos) {
    const duracao = document.createElement("span");
    duracao.innerHTML = `<b>${ultimoCardio.duracaoMinutos}</b> min`;
    meta.appendChild(duracao);
  } else if (ultimoCardio) {
    const semDuracao = document.createElement("span");
    semDuracao.textContent = "Duração não registrada";
    meta.appendChild(semDuracao);
  } else {
    const vazio = document.createElement("span");
    vazio.textContent = "Registre sua primeira sessão";
    meta.appendChild(vazio);
  }
  card.appendChild(meta);

  const botao = document.createElement("button");
  botao.type = "button";
  botao.textContent = ultimoCardio ? "Ver mais" : "Registrar";
  botao.addEventListener("click", () => {
    if (onIrParaCardio) onIrParaCardio();
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
  grid.className = "stats-grid";
  grid.appendChild(criarStatTile(ICONE_HALTER, String(atividade.treinosEsteMes), "Treinos este mês"));
  grid.appendChild(criarStatTile(ICONE_CHAMA, String(atividade.seriesEstaSemana), "Séries esta semana"));
  grid.appendChild(criarStatTile(ICONE_RELOGIO, `~${formatarMinutosAtivos(atividade.minutosAtivosEstaSemana)}`, "Tempo ativo (estimado)"));
  grid.appendChild(criarStatTile(ICONE_RAIO, String(atividade.diasSeguidos), "Dias seguidos"));
  section.appendChild(grid);

  return section;
}

function criarStatTile(icone, valor, rotulo) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";
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
