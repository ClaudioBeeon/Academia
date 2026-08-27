// js/screens/divisao.js
//
// Aba "Treinos" (antiga Divisão) — ciclo de 5 dias, o dia de hoje por
// extenso, cobertura de séries por músculo, sessões recentes com
// lançamento retroativo de cardio/exercício, e um calendário do mês.
import { getAll, get } from "../data/db.js";
import { getSeriesDoDia, getUltimasSessoesPorExercicio, getSeriesDesde, getSessoesAgrupadasPorDia, registrarSerie, getSeriesDoExercicioNaData } from "../data/historico.js";
import { DIAS_SEQUENCIA, obterDiaPorNumero, obterDiaPeloMusculo, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { getCheckinsRecentes } from "../data/checkin.js";
import { avaliarAlertasRecuperacao } from "../engine/alertasRecuperacao.js";
import { avaliarAlertasDesempenho } from "../engine/alertasDesempenho.js";
import { avaliarAlertasVolume } from "../engine/alertasVolume.js";
import { registrarCardio, getCardioDesde } from "../data/cardio.js";
import { avaliarCardio } from "../engine/cardio.js";
import { getUltimoDiaRegistrado } from "../data/sequenciaSemanal.js";
import { getHabitosRecentes } from "../data/habitos.js";
import { apontarCausaProvavelDesempenho } from "../engine/autorregulacao.js";
import { getSelecoesRecentes, getDietaBase, calcularTotalDoDia } from "../data/dieta.js";
import { calcularTMB, calcularMetaCalorica, avaliarDeficitConsistente } from "../engine/nutricao.js";
import { getFicha, getInicioDoBloco } from "../data/ficha.js";
import { calcularSemanaDoBloco } from "../engine/fichaFixa.js";
import { prepararSessaoDoDia } from "../engine/contextoSessao.js";
import { calcularCoberturaMuscular } from "../engine/cobertura.js";
import { estimarCaloriasDaSessao } from "../engine/calorias.js";
import { abrirDetalheDia } from "./historicoSessoes.js";

const MODALIDADES_CARDIO = ["bicicleta", "eliptico", "escada", "caminhada", "corrida"];
const NOME_MODALIDADE = {
  bicicleta: "Bicicleta", eliptico: "Elíptico", escada: "Escada",
  caminhada: "Caminhada", corrida: "Corrida",
};
const NOME_MUSCULO = {
  peito: "Peito", costas: "Costas", biceps: "Bíceps", triceps: "Tríceps",
  ombro: "Ombro (lateral)", deltoide_posterior: "Deltoide posterior",
  quadriceps: "Quadríceps", posterior_coxa: "Posterior de coxa",
  gluteo: "Glúteo", panturrilha: "Panturrilha", abdomen: "Abdômen",
  antebraco: "Antebraço", ombro_anterior: "Ombro (anterior)",
};
const NOME_CATEGORIA_COBERTURA = {
  priorizado: "Priorizado", recomposicao: "Recomposição", manutencao: "Manutenção", padrao: "Padrão",
};

function nomeDoMusculo(chave) {
  return NOME_MUSCULO[chave] ?? chave.replace(/_/g, " ");
}

function obterDataLocal() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function subtrairDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatarDataCurta(dataIso) {
  const [, mes, dia] = dataIso.split("-");
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return { dia, mes: MESES[Number(mes) - 1] };
}

async function calcularHouveDeficitConsistente(db) {
  const perfil = await get(db, "perfil", "1.0");
  if (!perfil?.dadosBasicos?.idade) return false;

  const [dietaBase, selecoesRecentes] = await Promise.all([getDietaBase(db), getSelecoesRecentes(db)]);
  if (!dietaBase || selecoesRecentes.length === 0) return false;

  const tmb = calcularTMB({
    sexo: perfil.dadosBasicos.sexo,
    pesoKg: perfil.dadosBasicos.peso_kg,
    alturaCm: perfil.dadosBasicos.altura_cm,
    idade: perfil.dadosBasicos.idade,
  });
  const metaCalorica = calcularMetaCalorica({ tmb, fase: perfil.fase?.atual });
  const totaisDiarios = selecoesRecentes.map((registro) => calcularTotalDoDia(dietaBase, registro.refeicoes).total);

  return avaliarDeficitConsistente({ totaisDiarios, metaCalorica });
}

export async function montarTelaDivisao(db, { onAbrirHistoricoTreinos } = {}) {
  const hoje = obterDataLocal();
  const root = document.createElement("div");
  root.className = "tela-divisao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Ciclo de 5 dias</div><div class="day-title">Treinos</div></div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const [
    todasAsSeries, seriesDeHoje, checkinsRecentes, sessoesPorExercicio,
    seriesUltimos7Dias, exercicios, cardioUltimos7Dias, ultimoDiaRegistrado, habitosRecentes,
    ficha, inicioDoBloco, perfil, cardioTodos, sessoesAgrupadas, protocolos,
  ] = await Promise.all([
    getAll(db, "historicoSeries"),
    getSeriesDoDia(db, hoje),
    getCheckinsRecentes(db),
    getUltimasSessoesPorExercicio(db),
    getSeriesDesde(db, subtrairDias(hoje, 6)),
    getAll(db, "exercicios"),
    getCardioDesde(db, subtrairDias(hoje, 6)),
    getUltimoDiaRegistrado(db),
    getHabitosRecentes(db),
    getFicha(db),
    getInicioDoBloco(db),
    get(db, "perfil", "1.0"),
    getAll(db, "registrosCardio"),
    getSessoesAgrupadasPorDia(db, 12),
    getAll(db, "protocolo"),
  ]);
  const protocolo = protocolos[0] ?? null;

  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);
  const semanaDoBloco = calcularSemanaDoBloco(inicioDoBloco, hoje);
  const { exerciciosHoje } = prepararSessaoDoDia({
    todosExercicios: exercicios, protocolo, todasAsSeries, hoje, diaInfo, ficha, semanaDoBloco,
  });

  const exercicioPorId = new Map(exercicios.map((e) => [e.id, e]));
  const alertasRecuperacao = avaliarAlertasRecuperacao(checkinsRecentes);
  const alertasDesempenho = avaliarAlertasDesempenho(sessoesPorExercicio);
  const musculosComDesempenhoCaindo = new Set(
    alertasDesempenho.map((a) => exercicioPorId.get(a.exercicioId)?.musculoPrimario).filter(Boolean)
  );
  const alertasVolume = avaliarAlertasVolume({
    seriesUltimos7Dias, seriesHoje: seriesDeHoje, sessoesPorExercicio, musculosComDesempenhoCaindo, hoje,
  });

  const houveDeficitConsistente = await calcularHouveDeficitConsistente(db);
  const alertasDesempenhoComCausa = alertasDesempenho.map((alerta) => {
    if (alerta.tipo !== "desempenho_caindo") return alerta;
    const causaProvavel = apontarCausaProvavelDesempenho({ habitosRecentes, houveDeficitConsistente });
    if (!causaProvavel || causaProvavel.causa === "deficit") return alerta;
    return { ...alerta, mensagem: `${alerta.mensagem} ${causaProvavel.mensagem}` };
  });

  const todosAlertas = [...alertasRecuperacao, ...alertasDesempenhoComCausa, ...alertasVolume];
  if (todosAlertas.length > 0) {
    main.appendChild(montarCardAlertas(todosAlertas, exercicioPorId));
  }

  main.appendChild(montarCardFitaDoCiclo(diaDaSessao, diaInfo, exerciciosHoje));
  main.appendChild(montarCardSemana(seriesUltimos7Dias, cardioUltimos7Dias, perfil?.dadosBasicos?.peso_kg));

  const definicaoFase = protocolo?.volumeSemanalPorFase?.[perfil?.fase?.atual ?? "definicao"];
  const cobertura = calcularCoberturaMuscular({ seriesUltimos7Dias, definicaoFase });
  if (cobertura.length > 0) main.appendChild(montarCardCobertura(cobertura));

  // Editar um dia no detalhe (js/screens/historicoSessoes.js, aberto daqui
  // pelo calendário e pela lista de sessões) pode mudar séries e cardio de
  // qualquer data — mais simples e confiável recarregar os dois cards que
  // mostram isso diretamente do zero do que tentar remendar cada linha.
  let cardSessoesAtual = montarCardSessoes(db, sessoesAgrupadas, cardioTodos, exercicios, perfil?.dadosBasicos?.peso_kg, diaInfo, hoje, onAbrirHistoricoTreinos, recarregarSessoesECalendario);
  let cardCalendarioAtual = montarCardCalendario(db, todasAsSeries, cardioTodos, hoje, recarregarSessoesECalendario);
  main.appendChild(cardSessoesAtual);
  main.appendChild(cardCalendarioAtual);

  async function recarregarSessoesECalendario() {
    const [todasAsSeriesNovas, cardioTodosNovo, sessoesAgrupadasNovas] = await Promise.all([
      getAll(db, "historicoSeries"),
      getAll(db, "registrosCardio"),
      getSessoesAgrupadasPorDia(db, 12),
    ]);
    const cardSessoesNovo = montarCardSessoes(db, sessoesAgrupadasNovas, cardioTodosNovo, exercicios, perfil?.dadosBasicos?.peso_kg, diaInfo, hoje, onAbrirHistoricoTreinos, recarregarSessoesECalendario);
    const cardCalendarioNovo = montarCardCalendario(db, todasAsSeriesNovas, cardioTodosNovo, hoje, recarregarSessoesECalendario);
    cardSessoesAtual.replaceWith(cardSessoesNovo);
    cardCalendarioAtual.replaceWith(cardCalendarioNovo);
    cardSessoesAtual = cardSessoesNovo;
    cardCalendarioAtual = cardCalendarioNovo;
  }

  return root;
}

// ═══════════════ Alertas (recuperação, desempenho, volume) ═══════════════
function montarCardAlertas(alertas, exercicioPorId) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Alertas</div></div>`;

  const lista = document.createElement("div");
  lista.className = "sets";
  lista.style.padding = "0 18px 18px";

  for (const alerta of alertas) {
    const nomeExercicio = alerta.exercicioId ? exercicioPorId.get(alerta.exercicioId)?.nome : undefined;
    const linha = document.createElement("div");
    linha.className = "prev-hint";
    linha.textContent = `⚠️ ${nomeExercicio ? `${nomeExercicio}: ` : ""}${alerta.mensagem}`;
    lista.appendChild(linha);
  }

  card.appendChild(lista);
  return card;
}

// ═══════════════ Fita do ciclo + dia de hoje ═══════════════
function montarCardFitaDoCiclo(diaDaSessao, diaInfo, exerciciosHoje) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Ciclo de 5 dias</div></div>`;

  const fita = document.createElement("div");
  fita.className = "fita-ciclo";
  fita.style.margin = "0 18px";
  for (const dia of DIAS_SEQUENCIA) {
    const casa = document.createElement("div");
    casa.className = "fita-dia";
    if (dia.numero === diaDaSessao) casa.classList.add("hoje");
    else if (dia.numero < diaDaSessao) casa.classList.add("feito");
    casa.innerHTML = `<b>${dia.numero}</b>${dia.numero === diaDaSessao ? "hoje" : dia.numero < diaDaSessao ? "ok" : ""}`;
    fita.appendChild(casa);
  }
  card.appendChild(fita);

  const legenda = document.createElement("p");
  legenda.className = "fita-legenda";
  legenda.innerHTML = `O dia avança <b>a cada treino registrado</b>, não por dia da semana.`;
  card.appendChild(legenda);

  const detalhe = document.createElement("div");
  detalhe.className = "prev-hint";
  detalhe.style.cssText = "margin:0 18px 16px; padding:14px 16px; background:var(--card-2); border-radius:16px;";
  detalhe.innerHTML = `
    <div style="font-family:var(--font-mono); font-size:0.68rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent);">Hoje · dia ${diaInfo.numero} de 5</div>
    <div style="font-size:1rem; font-weight:800; color:var(--ink); letter-spacing:-0.01em; margin:6px 0 10px;">${diaInfo.titulo}</div>
  `;
  const lista = document.createElement("ul");
  lista.className = "dia-hoje-lista";
  lista.style.padding = "0";
  for (const exercicio of exerciciosHoje) {
    const li = document.createElement("li");
    li.innerHTML = `<em>${exercicio.seriesAlvo ?? 3}×</em><span></span>`;
    li.querySelector("span").textContent = exercicio.nome;
    lista.appendChild(li);
  }
  detalhe.appendChild(lista);
  card.appendChild(detalhe);

  return card;
}

// ═══════════════ Esta semana (treinos, volume, kcal) ═══════════════
function montarCardSemana(seriesUltimos7Dias, cardioUltimos7Dias, pesoKg) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Esta semana</div></div>`;

  const validas = seriesUltimos7Dias.filter((s) => s.tipoSerie !== "aquecimento");
  const datasComTreino = new Set(validas.map((s) => s.data));
  const volumeTotal = validas.reduce((soma, s) => soma + s.carga * s.reps, 0);

  let kcalTotal = 0;
  for (const data of datasComTreino) {
    const totalSeriesDoDia = validas.filter((s) => s.data === data).length;
    const cardioDoDia = cardioUltimos7Dias.filter((r) => r.data === data);
    kcalTotal += estimarCaloriasDaSessao({ totalSeries: totalSeriesDoDia, pesoKg, registrosCardioDoDia: cardioDoDia }).total;
  }
  // Cardio feito em dia sem musculação também soma calorias.
  for (const registro of cardioUltimos7Dias) {
    if (!datasComTreino.has(registro.data)) {
      kcalTotal += estimarCaloriasDaSessao({ totalSeries: 0, pesoKg, registrosCardioDoDia: [registro] }).total;
    }
  }

  const grid = document.createElement("div");
  grid.className = "stats-grid";
  grid.style.padding = "0 18px 18px";
  grid.innerHTML = `
    <div class="stat-tile"><b></b><span>Treinos</span></div>
    <div class="stat-tile"><b></b><span>kg de volume</span></div>
    <div class="stat-tile"><b></b><span>kcal estimadas</span></div>
  `;
  const tiles = grid.querySelectorAll(".stat-tile b");
  tiles[0].textContent = datasComTreino.size;
  tiles[1].textContent = Math.round(volumeTotal);
  tiles[2].textContent = pesoKg > 0 ? Math.round(kcalTotal) : "—";
  card.appendChild(grid);

  return card;
}

// ═══════════════ Séries por músculo ═══════════════
function montarCardCobertura(cobertura) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Séries por músculo</div><div class="exercise-meta">7 dias</div></div>`;

  const corpo = document.createElement("div");
  corpo.className = "sets";
  corpo.style.padding = "0 18px 18px";

  for (const item of cobertura) {
    const bloco = document.createElement("div");
    bloco.className = "meta-barra";
    bloco.style.background = "transparent";
    bloco.style.padding = "0";
    const faixaTexto = item.min != null ? `${item.atual} / ${item.min}–${item.max}` : `${item.atual}`;
    const percentual = item.min != null ? Math.min(100, (item.atual / item.min) * 100) : 100;
    bloco.innerHTML = `
      <div class="meta-barra-topo"><span>${nomeDoMusculo(item.musculo)}</span><b>${faixaTexto}</b></div>
      <div class="meta-barra-trilho"><div class="meta-barra-preenchida ${item.abaixoDoAlvo ? "abaixo" : "ok"}" style="width:${percentual.toFixed(0)}%"></div></div>
      ${item.abaixoDoAlvo ? `<div class="meta-barra-nota">${NOME_CATEGORIA_COBERTURA[item.categoria]} — abaixo do alvo desta fase.</div>` : ""}
    `;
    corpo.appendChild(bloco);
  }
  card.appendChild(corpo);
  return card;
}

// ═══════════════ Sessões recentes + lançamento retroativo ═══════════════
function montarCardSessoes(db, sessoesAgrupadas, cardioTodos, exercicios, pesoKg, diaInfoHoje, hoje, onAbrirHistoricoTreinos, recarregarTudo) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  const cabecalho = document.createElement("div");
  cabecalho.className = "exercise-head";
  cabecalho.innerHTML = `<div class="exercise-name">Sessões</div>`;
  if (onAbrirHistoricoTreinos) {
    const verTodas = document.createElement("button");
    verTodas.type = "button";
    verTodas.className = "swap-pill";
    verTodas.textContent = "Ver todas";
    verTodas.addEventListener("click", onAbrirHistoricoTreinos);
    cabecalho.appendChild(verTodas);
  }
  card.appendChild(cabecalho);

  const corpo = document.createElement("div");
  corpo.style.padding = "0 18px 18px";
  card.appendChild(corpo);

  // Um dia sem nenhuma série (só cardio, ou nada ainda) não tem sessão
  // agrupada — sem essa linha pinada, não existiria onde lançar o cardio
  // de um dia que não passou pela musculação.
  const temSessaoHoje = sessoesAgrupadas.some((s) => s.data === hoje);
  const sessoes = temSessaoHoje
    ? sessoesAgrupadas
    : [{ data: hoje, series: [] }, ...sessoesAgrupadas];

  for (const sessao of sessoes) {
    corpo.appendChild(montarLinhaSessao(db, sessao, cardioTodos, exercicios, pesoKg, diaInfoHoje, hoje, recarregarTudo));
  }

  return card;
}

function montarLinhaSessao(db, sessao, cardioTodos, exercicios, pesoKg, diaInfoHoje, hoje, recarregarTudo) {
  const wrap = document.createElement("div");
  const { data, series } = sessao;
  const validas = series.filter((s) => s.tipoSerie !== "aquecimento");
  const primeiroMusculo = validas[0]?.musculo;
  const diaEncontrado = primeiroMusculo ? obterDiaPeloMusculo(primeiroMusculo) : null;
  const semTreinoAinda = validas.length === 0;
  const rotulo = semTreinoAinda && data === hoje ? "Hoje" : diaEncontrado ? diaEncontrado.titulo : "Sessão";
  const { dia, mes } = formatarDataCurta(data);

  let cardioDoDia = cardioTodos.filter((r) => r.data === data);

  const linha = document.createElement("div");
  linha.className = "sessao-linha";
  linha.innerHTML = `
    <div class="quando"><b>${dia}</b><span>${mes}</span></div>
    <div class="oque"><b></b><span></span></div>
  `;
  linha.querySelector(".oque b").textContent = rotulo;
  // Recalcula a cada chamada (não uma vez só na montagem): "+ Cardio" e
  // "+ Exercício" mudam validas.length e cardioDoDia depois que a linha já
  // está na tela, e a kcal precisa acompanhar.
  const atualizarLinhaTexto = () => {
    if (validas.length === 0) {
      linha.querySelector(".oque span").textContent = "Nenhum treino de musculação ainda";
      return;
    }
    const kcal = estimarCaloriasDaSessao({ totalSeries: validas.length, pesoKg, registrosCardioDoDia: cardioDoDia }).total;
    const exs = new Set(validas.map((s) => s.exercicioId)).size;
    linha.querySelector(".oque span").textContent =
      `${exs} exercício${exs === 1 ? "" : "s"} · ${validas.length} série${validas.length === 1 ? "" : "s"}${pesoKg > 0 ? ` · ${kcal} kcal` : ""}`;
  };
  atualizarLinhaTexto();
  linha.addEventListener("click", () => {
    abrirDetalheDia(db, data, { aoFechar: recarregarTudo });
  });
  wrap.appendChild(linha);

  const extrasWrap = document.createElement("div");
  wrap.appendChild(extrasWrap);
  const renderizarExtrasCardio = () => {
    extrasWrap.innerHTML = "";
    for (const registro of cardioDoDia) {
      const extra = document.createElement("div");
      extra.className = "sessao-extra";
      const dur = registro.duracaoMinutos ? `${registro.duracaoMinutos} min` : "";
      extra.innerHTML = `<span class="selo">+ cardio</span>${NOME_MODALIDADE[registro.modalidade] ?? registro.modalidade}${dur ? " · " + dur : ""}`;
      extrasWrap.appendChild(extra);
    }
  };
  renderizarExtrasCardio();

  const acoes = document.createElement("div");
  acoes.className = "sessao-acoes";
  const btnCardio = document.createElement("button");
  btnCardio.type = "button";
  btnCardio.className = "sessao-add-btn";
  btnCardio.textContent = "+ Cardio";
  const btnExercicio = document.createElement("button");
  btnExercicio.type = "button";
  btnExercicio.className = "sessao-add-btn";
  btnExercicio.textContent = "+ Exercício";
  acoes.append(btnCardio, btnExercicio);
  wrap.appendChild(acoes);

  const formWrap = document.createElement("div");
  formWrap.className = "sessao-form-wrap";
  formWrap.style.display = "none";
  wrap.appendChild(formWrap);

  btnCardio.addEventListener("click", () => {
    const abrindo = formWrap.style.display === "none";
    formWrap.style.display = abrindo ? "block" : "none";
    if (!abrindo) return;
    formWrap.innerHTML = "";
    formWrap.appendChild(montarFormCardio(db, data, diaEncontrado ?? diaInfoHoje, async (novoRegistro) => {
      cardioDoDia = [...cardioDoDia, novoRegistro];
      renderizarExtrasCardio();
      atualizarLinhaTexto();
      formWrap.style.display = "none";
    }));
  });

  btnExercicio.addEventListener("click", () => {
    const abrindo = formWrap.style.display === "none";
    formWrap.style.display = abrindo ? "block" : "none";
    if (!abrindo) return;
    formWrap.innerHTML = "";
    formWrap.appendChild(montarFormExercicio(db, data, exercicios, async (novaSerie) => {
      validas.push(novaSerie);
      atualizarLinhaTexto();
      formWrap.style.display = "none";
    }));
  });

  return wrap;
}

export function montarFormCardio(db, data, diaParaAviso, aoSalvar) {
  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Modalidade
        <select name="modalidade" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;">
          ${MODALIDADES_CARDIO.map((m) => `<option value="${m}">${NOME_MODALIDADE[m]}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="set-field">
      <label>Duração (min)<input type="number" name="duracaoMinutos" placeholder="30" /></label>
    </div>
    <div class="set-field">
      <label>Intensidade (1-5)
        <select name="intensidadePercebida" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;">
          <option value="1">1 — muito leve</option>
          <option value="2">2 — leve</option>
          <option value="3" selected>3 — moderada</option>
          <option value="4">4 — forte</option>
          <option value="5">5 — muito forte</option>
        </select>
      </label>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Registrar</button>
  `;
  const avisoEl = document.createElement("div");
  avisoEl.className = "prev-hint";
  avisoEl.style.display = "none";
  form.appendChild(avisoEl);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const modalidade = form.modalidade.value;
    const duracaoMinutos = Number(form.duracaoMinutos.value) || undefined;
    const intensidadePercebida = Number(form.intensidadePercebida.value);
    const registro = { data, modalidade, duracaoMinutos, intensidadePercebida, mesmoDiaDeTreino: true };

    await registrarCardio(db, registro);

    if (diaParaAviso) {
      const cardiosRecentes = await getCardioDesde(db, subtrairDias(data, 6));
      const cardiosIntensosUltimos7Dias = cardiosRecentes.filter((r) => r.intensidadePercebida >= 3).length;
      const avisos = avaliarCardio({
        modalidade, intensidadePercebida,
        ehDiaDePernas: diaParaAviso.musculos.includes("quadriceps"),
        cardiosIntensosUltimos7Dias,
      });
      if (avisos.length > 0) {
        avisoEl.style.display = "";
        avisoEl.textContent = `⚠️ ${avisos[0].mensagem}`;
      }
    }

    aoSalvar(registro);
  });

  return form;
}

function montarFormExercicio(db, data, exercicios, aoSalvar) {
  const ordenados = [...exercicios].sort((a, b) => a.nome.localeCompare(b.nome));
  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Exercício
        <select name="exercicioId" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;">
          ${ordenados.map((e) => `<option value="${e.id}">${e.nome}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="set-field"><label>Carga (kg)<input type="number" name="carga" step="0.5" required /></label></div>
    <div class="set-field"><label>Reps<input type="number" name="reps" step="1" required /></label></div>
    <div class="set-field"><label>RIR<input type="number" name="rir" step="1" required /></label></div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Adicionar série</button>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const exercicioId = form.exercicioId.value;
    const carga = Number(form.carga.value);
    const reps = Number(form.reps.value);
    const rir = Number(form.rir.value);
    if (!(carga >= 0) || !(reps >= 0) || !(rir >= 0)) return;

    const exercicio = exercicios.find((e) => e.id === exercicioId);
    const jaExistentes = await getSeriesDoExercicioNaData(db, exercicioId, data);
    const registro = {
      exercicioId, data, musculo: exercicio.musculoPrimario, contribuicao: 1.0, tipoSerie: "normal",
      carga, reps, rir, serieNumero: jaExistentes.length + 1,
    };
    await registrarSerie(db, registro);
    aoSalvar(registro);
  });

  return form;
}

// ═══════════════ Calendário do mês ═══════════════
function montarCardCalendario(db, todasAsSeries, cardioTodos, hoje, recarregarTudo) {
  const card = document.createElement("section");
  card.className = "exercise-card";

  const [anoStr, mesStr] = hoje.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const diaSemanaDoPrimeiro = (new Date(ano, mes - 1, 1).getDay() + 6) % 7;

  const datasComAtividade = new Set([
    ...todasAsSeries.filter((s) => s.tipoSerie !== "aquecimento").map((s) => s.data),
    ...cardioTodos.map((r) => r.data),
  ]);

  const prefixo = `${anoStr}-${mesStr}`;
  const diasTreinados = [...datasComAtividade].filter((d) => d.startsWith(prefixo)).length;

  const NOME_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const cabecalho = document.createElement("div");
  cabecalho.className = "calendario-mes";
  cabecalho.innerHTML = `<b>${NOME_MES[mes - 1]}</b><span>${diasTreinados} de ${diasNoMes} dias</span>`;
  card.appendChild(cabecalho);

  const grade = document.createElement("div");
  grade.className = "calendario-grade";
  for (const letra of ["S", "T", "Q", "Q", "S", "S", "D"]) {
    const dh = document.createElement("div");
    dh.className = "dh";
    dh.textContent = letra;
    grade.appendChild(dh);
  }
  for (let i = 0; i < diaSemanaDoPrimeiro; i++) {
    const vazio = document.createElement("div");
    vazio.className = "dia fora";
    grade.appendChild(vazio);
  }
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataIso = `${prefixo}-${String(dia).padStart(2, "0")}`;
    const el = document.createElement("div");
    el.className = "dia";
    if (datasComAtividade.has(dataIso)) el.classList.add("treinou");
    if (dataIso === hoje) el.classList.add("hoje");
    el.textContent = dia;
    // Dia futuro não tem o que abrir — não faz sentido editar um treino que
    // ainda não aconteceu. Passado e hoje abrem o detalhe (js/screens/
    // historicoSessoes.js), mesmo sem nada registrado ainda: é dali que dá
    // pra lançar um dia esquecido, não só corrigir um já existente.
    if (dataIso <= hoje) {
      el.classList.add("clicavel");
      el.addEventListener("click", () => abrirDetalheDia(db, dataIso, { aoFechar: recarregarTudo }));
    }
    grade.appendChild(el);
  }
  card.appendChild(grade);

  const legenda = document.createElement("div");
  legenda.className = "calendario-legenda";
  legenda.innerHTML = `<span><i></i>treinou</span><span><i class="vazio"></i>sem treino</span><span>contorno = hoje</span>`;
  card.appendChild(legenda);

  return card;
}
