// js/screens/treino.js
import { get, getAll } from "../data/db.js";
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDoDia, getSeriesDaUltimaSessaoAnterior } from "../data/historico.js";
import { getEquipamento } from "../data/equipamento.js";
import { getCheckin, registrarCheckin } from "../data/checkin.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { avaliarProgressao } from "../engine/progressao.js";
import { calcularAnilhas } from "../engine/anilhas.js";
import { gerarEscadaAquecimento } from "../engine/aquecimento.js";
import { detectarPRs } from "../engine/recordes.js";
import { calcularEstatisticasSessao } from "../engine/sessao.js";
import { DIAS_SEQUENCIA, obterDiaPorNumero, obterMusculosDoDia, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { validarRir } from "../engine/rir.js";
import { gerarSessaoDoDia } from "../engine/sessaoGerada.js";
import { criarCronometro } from "./timer.js";
import { calcularAtividadeMensal } from "../engine/atividade.js";
import { getCardioRecente } from "../data/cardio.js";

const MINUTOS_ESTIMADOS_POR_EXERCICIO = 7; // 3 séries + descanso, arredondado (heurística de exibição, não um limite do protocolo)

function saudacaoPorHorario(agora = new Date()) {
  const hora = agora.getHours();
  if (hora < 5) return "Boa noite";
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const CONFIG_PADRAO = { repsMin: 8, repsMax: 12, rirAlvo: 2, descansoSegundos: 90 };

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function obterConfigExercicio(protocolo, exercicio) {
  const config = protocolo?.tiposDeExercicio?.[exercicio.tipo];
  if (!config) return CONFIG_PADRAO;
  return {
    repsMin: config.faixaRepeticoes.min,
    repsMax: config.faixaRepeticoes.max,
    rirAlvo: (config.rirAlvo.min + config.rirAlvo.max) / 2,
    descansoSegundos: config.descansoSegundos.min,
  };
}

export async function montarTelaTreino(db, { onAbrirHistorico, onIrParaCardio } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const [seriesDeHoje, todasAsSeries, ultimoDiaRegistrado, cardioRecente] = await Promise.all([
    getSeriesDoDia(db, hoje),
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getCardioRecente(db, 1),
  ]);
  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  const diaJaPersistidoHoje = Boolean(ultimoDiaRegistrado && ultimoDiaRegistrado.data === hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);
  const atividade = calcularAtividadeMensal(todasAsSeries, hoje);
  const ultimoCardio = cardioRecente[0] ?? null;
  const TODOS_MUSCULOS_MAPEADOS = new Set(DIAS_SEQUENCIA.flatMap((d) => d.musculos));
  const exerciciosDoGrupo = todosExercicios.filter((e) => {
    return diaInfo.musculos.includes(e.musculoPrimario) || !TODOS_MUSCULOS_MAPEADOS.has(e.musculoPrimario);
  });
  const sessoesAnterioresDoGrupo = new Set(
    todasAsSeries
      .filter((s) => s.data !== hoje && diaInfo.musculos.includes(s.musculo))
      .map((s) => s.data)
  ).size;
  const definicaoFase = protocolo?.volumeSemanalPorFase?.definicao;
  const exerciciosHoje = gerarSessaoDoDia({
    exerciciosDoGrupo,
    musculosPriorizados: definicaoFase?.musculoPriorizadoCrescimento ?? [],
    musculosEmManutencao: definicaoFase?.musculoEmManutencao ?? [],
    sessoesAnterioresDoGrupo,
  });

  const root = document.createElement("div");
  root.className = "tela-treino";

  const header = document.createElement("header");
  header.className = "top greeting";
  header.innerHTML = `
    <div class="date-label">${saudacaoPorHorario()}</div>
    <div class="day-title">Pronto pra treinar?</div>
  `;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const totalSeriesPrevistas = exerciciosHoje.length * 3;
  const minutosEstimados = exerciciosHoje.length * MINUTOS_ESTIMADOS_POR_EXERCICIO;
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
    main.querySelector(".exercise-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (seriesDeHoje.length === 0) {
    const seletorDia = document.createElement("select");
    seletorDia.className = "trocar-dia-select";
    seletorDia.style.cssText = "background:var(--accent-ink); color:var(--accent); border:none; border-radius:8px; font-size:0.85rem; padding:6px 8px; margin-top:8px; cursor:pointer; font-family:inherit;";
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
  main.appendChild(carrossel);

  main.appendChild(montarCardAtividade(atividade));

  main.appendChild(await montarCardCheckin(db, hoje));

  const resumoCard = montarCardResumoSessao();
  let diaPersistido = diaJaPersistidoHoje;
  const aoRegistrarSerie = async () => {
    if (!diaPersistido) {
      await registrarDiaDaSessao(db, diaDaSessao, hoje);
      diaPersistido = true;
    }
    const seriesDoDia = await getSeriesDoDia(db, hoje);
    atualizarResumoSessao(resumoCard, calcularEstatisticasSessao(seriesDoDia));
  };

  for (let i = 0; i < exerciciosHoje.length; i++) {
    const exercicio = exerciciosHoje[i];
    const card = await montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico, equipamento, aoRegistrarSerie);
    main.appendChild(card);
    if (i < exerciciosHoje.length - 1) {
      main.appendChild(criarPlaceholderDescanso());
    }
  }

  if (exerciciosHoje.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = `Nenhum exercício de ${diaInfo.titulo} cadastrado ainda.`;
    main.appendChild(vazio);
  }

  await aoRegistrarSerie();
  main.appendChild(resumoCard);

  return root;
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
      <select name="qualidadePercebida" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;">
        <option value="1">1 — muito ruim</option>
        <option value="2">2 — ruim</option>
        <option value="3">3 — neutra</option>
        <option value="4">4 — boa</option>
        <option value="5">5 — muito boa</option>
      </select>
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

  if (checkinExistente) {
    form.qualidadePercebida.value = String(checkinExistente.qualidadePercebida ?? 3);
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
  card.className = "plano-hero alt";

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
  grid.appendChild(criarStatTile(String(atividade.treinosEsteMes), "Treinos este mês"));
  grid.appendChild(criarStatTile(String(atividade.seriesEstaSemana), "Séries esta semana"));
  grid.appendChild(criarStatTile(`~${formatarMinutosAtivos(atividade.minutosAtivosEstaSemana)}`, "Tempo ativo (estimado)"));
  grid.appendChild(criarStatTile(String(atividade.diasSeguidos), "Dias seguidos"));
  section.appendChild(grid);

  return section;
}

function criarStatTile(valor, rotulo) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";
  const b = document.createElement("b");
  b.textContent = valor;
  const span = document.createElement("span");
  span.textContent = rotulo;
  tile.appendChild(b);
  tile.appendChild(span);
  return tile;
}

function montarCardResumoSessao() {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Resumo da sessão</div></div>
    <div class="stats-grid" style="padding:0 18px 18px;">
      <div class="stat-tile"><b class="stat-series">0</b><span>Séries feitas</span></div>
      <div class="stat-tile"><b class="stat-volume">0</b><span>Volume (kg)</span></div>
      <div class="stat-tile"><b class="stat-exercicios">0</b><span>Exercícios</span></div>
      <div class="stat-tile"><b class="stat-musculos stat-tile-texto">—</b><span>Músculos treinados</span></div>
    </div>
  `;
  return card;
}

function atualizarResumoSessao(card, stats) {
  card.querySelector(".stat-series").textContent = stats.totalSeries;
  card.querySelector(".stat-volume").textContent = stats.volumeTotal;
  card.querySelector(".stat-exercicios").textContent = stats.exerciciosTreinados;
  card.querySelector(".stat-musculos").textContent = stats.musculosTreinados.length > 0
    ? stats.musculosTreinados.join(", ")
    : "—";
}

function criarPlaceholderDescanso() {
  const div = document.createElement("div");
  div.className = "rest-bar rest-bar-hidden";
  div.innerHTML = `
    <div><div class="label">Descanso</div><div class="time">00:00</div></div>
    <div class="rest-ctl"><button type="button" data-action="menos">−30s</button><button type="button" data-action="mais">+30s</button></div>
  `;
  return div;
}

async function montarCardExercicio(db, exercicio, todosExercicios, protocolo, hoje, onAbrirHistorico, equipamento, aoRegistrarSerie) {
  const cfg = obterConfigExercicio(protocolo, exercicio);
  const seriesHoje = await getSeriesDoExercicioNaData(db, exercicio.id, hoje);
  const ultimaAnterior = await getUltimaSerieAnterior(db, exercicio.id, hoje);
  const amostras = await getAmostrasRecentesDoExercicio(db, exercicio.id);
  const sugestao = sugerirCarga(amostras, cfg.rirAlvo);
  const sessaoAnteriorCompleta = await getSeriesDaUltimaSessaoAnterior(db, exercicio.id, hoje);

  const card = document.createElement("section");
  card.className = "exercise-card";

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `
    <div>
      <div class="exercise-name"></div>
      <div class="exercise-meta">${cfg.repsMin}–${cfg.repsMax} reps · RIR ${cfg.rirAlvo}</div>
    </div>
    <div style="display:flex; gap:6px;">
      <button class="swap-pill history-pill" type="button">Histórico</button>
      <button class="swap-pill trocar-pill" type="button">Trocar</button>
    </div>
  `;
  head.querySelector(".exercise-name").textContent = exercicio.nome;
  card.appendChild(head);

  const setsContainer = document.createElement("div");
  setsContainer.className = "sets";
  card.appendChild(setsContainer);

  const placeholderCarga = sugestao.cargaSugerida != null
    ? `${sugestao.cargaSugerida} kg`
    : (ultimaAnterior ? `${ultimaAnterior.carga} kg` : "—");
  const placeholderReps = ultimaAnterior ? String(ultimaAnterior.reps) : String(cfg.repsMin);

  const totalSeriesAlvo = 3;
  for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
    const jaFeita = seriesHoje.find((s) => s.serieNumero === numero);
    setsContainer.appendChild(criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps, rirAlvo: cfg.rirAlvo }));
    if (numero < totalSeriesAlvo) {
      setsContainer.appendChild(criarPlaceholderDescanso());
    }
  }

  if (ultimaAnterior) {
    const hint = document.createElement("div");
    hint.className = "prev-hint";
    const sugestaoTexto = sugestao.cargaSugerida != null
      ? ` Sugestão de hoje: <b>${sugestao.cargaSugerida} kg</b> (confiança ${sugestao.confianca}).`
      : "";
    hint.innerHTML = `Última vez: <b>${ultimaAnterior.carga} kg × ${ultimaAnterior.reps}</b>, RIR ${ultimaAnterior.rir}.${sugestaoTexto}`;
    card.appendChild(hint);
  }

  const progressaoHint = document.createElement("div");
  progressaoHint.className = "prev-hint";
  progressaoHint.style.display = "none";
  card.appendChild(progressaoHint);

  const atualizarProgressao = () => {
    const avaliacao = avaliarProgressao({
      faixaMin: cfg.repsMin,
      faixaMax: cfg.repsMax,
      rirAlvo: cfg.rirAlvo,
      sessaoAtual: seriesHoje,
      sessaoAnterior: sessaoAnteriorCompleta,
    });
    if (avaliacao.acao === "aumentar_carga") {
      progressaoHint.textContent = `📈 ${avaliacao.motivo}`;
      progressaoHint.style.display = "";
    } else if (avaliacao.acao === "reduzir_carga") {
      progressaoHint.textContent = `📉 ${avaliacao.motivo}`;
      progressaoHint.style.display = "";
    } else {
      progressaoHint.style.display = "none";
    }
  };
  atualizarProgressao();

  setsContainer.addEventListener("submit", async (event) => {
    const linha = event.target.closest(".set-row");
    if (!linha) return;
    event.preventDefault();
    const carga = Number(linha.querySelector('[name="carga"]').value);
    const reps = Number(linha.querySelector('[name="reps"]').value);
    const rirInput = linha.querySelector('[name="rir"]').value;
    const rirDigitado = Number(rirInput);
    if (!carga || !reps) return;

    const seriesAnteriores = await getHistoricoCompletoDoExercicio(db, exercicio.id);
    const prs = detectarPRs({ carga, reps }, seriesAnteriores.map((s) => ({ carga: s.carga, reps: s.reps })));

    await registrarSerie(db, {
      exercicioId: exercicio.id,
      data: hoje,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir: rirInput === "" || Number.isNaN(rirDigitado) ? cfg.rirAlvo : rirDigitado,
      serieNumero: Number(linha.dataset.numero),
    });

    seriesHoje.push({
      exercicioId: exercicio.id,
      data: hoje,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir: rirInput === "" || Number.isNaN(rirDigitado) ? cfg.rirAlvo : rirDigitado,
      serieNumero: Number(linha.dataset.numero),
    });

    const numeroAtual = Number(linha.dataset.numero);
    const serieAnteriorMesmoExercicio = seriesHoje.find((s) => s.serieNumero === numeroAtual - 1);
    if (serieAnteriorMesmoExercicio && serieAnteriorMesmoExercicio.carga === carga) {
      const validacao = validarRir({
        rirDeclarado: serieAnteriorMesmoExercicio.rir,
        repsSerieAtual: serieAnteriorMesmoExercicio.reps,
        repsSerieSeguinte: reps,
        cargaIgual: true,
      });
      if (validacao.suspeitaSuperestimado) {
        mostrarToastRir(validacao.mensagem);
      }
    }

    atualizarProgressao();

    linha.classList.add("done");
    linha.querySelectorAll("input").forEach((input) => (input.disabled = true));
    const ring = linha.querySelector(".set-ring");
    if (ring) {
      const marcado = document.createElement("div");
      marcado.className = "set-ring";
      marcado.innerHTML = "<i>✓</i>";
      ring.replaceWith(marcado);
    }

    const restBar = linha.nextElementSibling && linha.nextElementSibling.classList.contains("rest-bar")
      ? linha.nextElementSibling
      : card.nextElementSibling;
    iniciarDescanso(restBar, cfg.descansoSegundos);

    const prsRelevantes = prs.filter((p) => p.tipo !== "primeira_serie");
    if (prsRelevantes.length > 0) {
      mostrarToastPR(prsRelevantes);
    }

    if (aoRegistrarSerie) await aoRegistrarSerie();
  });

  card.querySelector(".trocar-pill").addEventListener("click", () => {
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios);
    const nomes = sugestoes.map((e) => e.nome).join(", ") || "nenhuma alternativa encontrada";
    alert(`Alternativas: ${nomes}`);
  });

  card.querySelector(".history-pill").addEventListener("click", () => {
    if (onAbrirHistorico) onAbrirHistorico(exercicio);
  });

  if (exercicio.equipamento === "barra") {
    const ferramentasPill = document.createElement("button");
    ferramentasPill.type = "button";
    ferramentasPill.className = "swap-pill";
    ferramentasPill.textContent = "Ferramentas";
    ferramentasPill.style.margin = "0 18px 12px";
    card.insertBefore(ferramentasPill, card.querySelector(".sets"));

    const painelFerramentas = document.createElement("div");
    painelFerramentas.className = "sets";
    painelFerramentas.style.display = "none";
    painelFerramentas.style.padding = "0 18px 12px";
    card.insertBefore(painelFerramentas, card.querySelector(".sets"));

    ferramentasPill.addEventListener("click", () => {
      const abrindo = painelFerramentas.style.display === "none";
      painelFerramentas.style.display = abrindo ? "flex" : "none";
      if (abrindo) {
        const pesoAlvo = sugestao.cargaSugerida ?? (ultimaAnterior ? ultimaAnterior.carga : equipamento.pesoBarra);
        const anilhas = calcularAnilhas(pesoAlvo, equipamento.pesoBarra, equipamento.anilhasDisponiveis);
        const aquecimento = gerarEscadaAquecimento(pesoAlvo, equipamento.pesoBarra);

        const textoAnilhas = anilhas.anilhasPorLado.length > 0
          ? `${anilhas.anilhasPorLado.join(" + ")} kg por lado`
          : "Sem anilhas — só a barra";
        const textoAquecimento = aquecimento
          .map((p) => `${p.peso} kg × ${p.reps}`)
          .join(" → ");

        painelFerramentas.innerHTML = `
          <div class="prev-hint" style="grid-column:1/-1;">
            <b>Anilhas para ${pesoAlvo} kg:</b> ${textoAnilhas}${anilhas.atingivel ? "" : ` (falta ${anilhas.restante} kg por lado)`}
          </div>
          <div class="prev-hint" style="grid-column:1/-1;">
            <b>Aquecimento:</b> ${textoAquecimento || "—"}
          </div>
        `;
      }
    });
  }

  return card;
}

function criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps, rirAlvo }) {
  const form = document.createElement("form");
  form.className = "set-row" + (jaFeita ? " done" : "");
  form.dataset.numero = String(numero);
  const ringHtml = jaFeita
    ? `<div class="set-ring"><i>✓</i></div>`
    : `<button type="submit" class="set-ring" aria-label="Marcar série ${numero} concluída"><i>${numero}</i></button>`;
  form.innerHTML = `
    ${ringHtml}
    <div class="set-field"><label>Carga</label><input name="carga" type="number" step="0.5" placeholder="${placeholderCarga}" value="${jaFeita ? jaFeita.carga : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>Reps</label><input name="reps" type="number" placeholder="${placeholderReps}" value="${jaFeita ? jaFeita.reps : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>RIR</label><input name="rir" type="number" step="0.5" placeholder="${rirAlvo}" value="${jaFeita ? jaFeita.rir : ""}" ${jaFeita ? "disabled" : ""} /></div>
  `;
  return form;
}

function iniciarDescanso(restBar, descansoSegundos) {
  if (!restBar || !restBar.classList || !restBar.classList.contains("rest-bar")) return;

  restBar.classList.remove("rest-bar-hidden");
  const timeEl = restBar.querySelector(".time");

  const cronometro = criarCronometro({
    duracaoInicialSegundos: descansoSegundos,
    aoAtualizar: (restante) => {
      const min = String(Math.floor(restante / 60)).padStart(2, "0");
      const seg = String(restante % 60).padStart(2, "0");
      timeEl.textContent = `${min}:${seg}`;
    },
    aoFinalizar: () => {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    },
  });

  if ("wakeLock" in navigator) {
    navigator.wakeLock.request("screen").catch(() => {});
  }

  restBar.querySelector('[data-action="menos"]').addEventListener("click", () => cronometro.ajustar(-30));
  restBar.querySelector('[data-action="mais"]').addEventListener("click", () => cronometro.ajustar(30));

  cronometro.iniciar();
}

function mostrarToastRir(mensagem) {
  const toast = document.createElement("div");
  toast.className = "rest-bar toast-flutuante";
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = `${proximoOffsetToast()}px`;
  toast.style.transform = "translateX(-50%)";
  toast.style.width = "calc(100% - 44px)";
  toast.style.maxWidth = "398px";
  toast.style.zIndex = "10";
  toast.innerHTML = `<div><div class="label">💡 Calibração de RIR</div><div class="time" style="font-size:1rem;">${mensagem}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function mostrarToastPR(prs) {
  const toast = document.createElement("div");
  toast.className = "rest-bar toast-flutuante";
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = `${proximoOffsetToast()}px`;
  toast.style.transform = "translateX(-50%)";
  toast.style.width = "calc(100% - 44px)";
  toast.style.maxWidth = "398px";
  toast.style.zIndex = "10";
  toast.innerHTML = `<div><div class="label">🏆 Recorde pessoal</div><div class="time" style="font-size:1rem;">${prs.map((p) => p.mensagem).join(" ")}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function proximoOffsetToast() {
  const existentes = document.querySelectorAll(".toast-flutuante").length;
  return 108 + existentes * 64;
}
