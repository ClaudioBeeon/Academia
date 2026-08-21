// js/screens/execucao.js
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDaUltimaSessaoAnterior } from "../data/historico.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { avaliarProgressao } from "../engine/progressao.js";
import { calcularAnilhas } from "../engine/anilhas.js";
import { gerarEscadaAquecimento } from "../engine/aquecimento.js";
import { detectarPRs } from "../engine/recordes.js";
import { criarCronometro } from "./timer.js";
import { abrirSeletorCarga } from "./seletorCarga.js";
import { criarIconeExercicio } from "./iconeExercicio.js";

const CONFIG_PADRAO = { repsMin: 8, repsMax: 12, rirAlvo: 2, descansoSegundos: 90 };
const TOTAL_SERIES_ALVO = 3;

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

function arredondarMeioKg(carga) {
  return Math.round(carga * 2) / 2;
}

function calcularProximoPasso(sugestao, ultimaAnterior) {
  if (sugestao.cargaSugerida == null || !ultimaAnterior) return "—";
  const diff = arredondarMeioKg(sugestao.cargaSugerida - ultimaAnterior.carga);
  if (diff > 0) return `+${diff}kg`;
  if (diff < 0) return `${diff}kg`;
  return "Manter";
}

export async function montarTelaExecucao(db, contexto, callbacks) {
  const { exercicio, indice, total, todosExercicios, protocolo, equipamento, hoje, mostrarExplicacaoAberta } = contexto;
  const { onFechar, onProximoExercicio, onAbrirHistorico, onSerieRegistrada, onPrsDetectados } = callbacks;

  const cfg = obterConfigExercicio(protocolo, exercicio);
  let cronometroAtivo = null;
  let wakeLockAtivo = null;
  const seriesHoje = await getSeriesDoExercicioNaData(db, exercicio.id, hoje);
  const ultimaAnterior = await getUltimaSerieAnterior(db, exercicio.id, hoje);
  const amostras = await getAmostrasRecentesDoExercicio(db, exercicio.id);
  const sugestao = sugerirCarga(amostras, cfg.rirAlvo);
  const sessaoAnteriorCompleta = await getSeriesDaUltimaSessaoAnterior(db, exercicio.id, hoje);

  const cargaPadrao = sugestao.cargaSugerida ?? (ultimaAnterior ? ultimaAnterior.carga : cfg.repsMin);
  let cargaSelecionada = Math.min(100, Math.max(1, Math.round(cargaPadrao)));

  const root = document.createElement("div");
  root.className = "tela-execucao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div>
      <div class="date-label">Exercício ${indice} de ${total}</div>
      <div class="day-title"></div>
    </div>
  `;
  header.querySelector(".day-title").textContent = exercicio.nome;
  const fecharBtn = document.createElement("button");
  fecharBtn.type = "button";
  fecharBtn.className = "icon-btn";
  fecharBtn.setAttribute("aria-label", "Fechar");
  fecharBtn.textContent = "✕";
  fecharBtn.addEventListener("click", () => { if (onFechar) onFechar(); });
  header.appendChild(fecharBtn);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const card = document.createElement("section");
  card.className = "exercise-card";
  main.appendChild(card);

  if (exercicio.observacoesExecucao) {
    const explicacao = document.createElement("details");
    explicacao.className = "explicacao-execucao";
    explicacao.open = Boolean(mostrarExplicacaoAberta);
    explicacao.innerHTML = `<summary>Como executar</summary><p></p>`;
    explicacao.querySelector("p").textContent = exercicio.observacoesExecucao;
    card.appendChild(explicacao);
  }

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `
    <div style="display:flex; align-items:center; gap:14px;">
      <div class="exercise-head-texto">
        <div class="exercise-name"></div>
        <div class="exercise-meta">${cfg.repsMin}–${cfg.repsMax} reps · RIR ${cfg.rirAlvo}</div>
      </div>
    </div>
    <div style="display:flex; gap:6px;">
      <button class="swap-pill trocar-pill" type="button">Trocar</button>
    </div>
  `;
  head.querySelector("div").prepend(criarIconeExercicio(exercicio.id, 60));
  head.querySelector(".exercise-name").textContent = exercicio.nome;
  card.appendChild(head);

  const tilesEl = document.createElement("div");
  tilesEl.className = "exec-tiles";
  card.appendChild(tilesEl);

  if (exercicio.equipamento === "barra") {
    const ferramentasPill = document.createElement("button");
    ferramentasPill.type = "button";
    ferramentasPill.className = "swap-pill";
    ferramentasPill.textContent = "Ferramentas";
    ferramentasPill.style.margin = "0 18px 12px";
    card.appendChild(ferramentasPill);

    const painelFerramentas = document.createElement("div");
    painelFerramentas.className = "sets";
    painelFerramentas.style.display = "none";
    painelFerramentas.style.padding = "0 18px 12px";
    card.appendChild(painelFerramentas);

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

  const cargaPillEl = document.createElement("button");
  cargaPillEl.type = "button";
  cargaPillEl.className = "exec-carga-pill";
  card.appendChild(cargaPillEl);

  const shead = document.createElement("div");
  shead.className = "shead";
  shead.style.padding = "0 18px";
  shead.innerHTML = `<h4>Séries</h4><s>${TOTAL_SERIES_ALVO} no total</s>`;
  card.appendChild(shead);

  const seriesListEl = document.createElement("div");
  seriesListEl.className = "exec-series";
  card.appendChild(seriesListEl);

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

  const restCard = document.createElement("div");
  restCard.className = "exec-rest rest-bar-hidden";
  restCard.innerHTML = `
    <div class="label">Descanso</div>
    <div class="time">00:00</div>
    <div class="sub">o relógio segue contando se você passar</div>
    <div class="rest-ctl"><button type="button" data-action="menos">−30s</button><button type="button" data-action="mais">+30s</button></div>
  `;
  card.appendChild(restCard);
  card.style.paddingBottom = "18px";

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

  function numeroPendenteAtual() {
    for (let numero = 1; numero <= TOTAL_SERIES_ALVO; numero++) {
      if (!seriesHoje.find((s) => s.serieNumero === numero)) return numero;
    }
    return null;
  }

  function renderizarTiles() {
    const cargaSugeridaTexto = sugestao.cargaSugerida != null
      ? `${sugestao.cargaSugerida}kg`
      : (ultimaAnterior ? `${ultimaAnterior.carga}kg` : "—");
    tilesEl.innerHTML = `
      <div class="exec-tile"><div class="ic">🏋️</div><b>${cargaSugeridaTexto}</b><s>Carga sugerida</s></div>
      <div class="exec-tile"><div class="ic">⚡</div><b>${calcularProximoPasso(sugestao, ultimaAnterior)}</b><s>Próximo passo</s></div>
    `;
  }

  function renderizarPill() {
    cargaPillEl.innerHTML = `
      <span class="label">Carga da série</span>
      <span class="valor">${cargaSelecionada} kg</span>
      <span class="editar">Ajustar</span>
    `;
  }

  function renderizarSeries() {
    const pendente = numeroPendenteAtual();
    seriesListEl.innerHTML = "";
    for (let numero = 1; numero <= TOTAL_SERIES_ALVO; numero++) {
      const feita = seriesHoje.find((s) => s.serieNumero === numero);
      const row = document.createElement("div");
      row.className = "exec-serie-row" + (!feita && numero === pendente ? " pendente" : "");
      if (feita) {
        row.innerHTML = `
          <div class="exec-serie-chk"><i>✓</i></div>
          <div class="exec-serie-info"><h5>${feita.carga} kg · ${feita.reps} reps</h5><p>RIR ${feita.rir}</p></div>
        `;
      } else if (numero === pendente) {
        row.innerHTML = `
          <div class="exec-serie-chk off">${numero}</div>
          <div class="exec-serie-info"><h5 class="aguardando">Aguardando série…</h5></div>
        `;
      } else {
        row.innerHTML = `
          <div class="exec-serie-chk off">${numero}</div>
          <div class="exec-serie-info"><h5 class="aguardando" style="opacity:.5">—</h5></div>
        `;
      }
      seriesListEl.appendChild(row);
    }
  }

  function renderizarFooter() {
    const pendente = numeroPendenteAtual();
    if (pendente == null) {
      primarioBtn.textContent = "Concluir exercício";
      cargaPillEl.disabled = true;
      cargaPillEl.style.opacity = "0.5";
    } else {
      primarioBtn.textContent = `Iniciar série ${pendente}`;
      cargaPillEl.disabled = false;
      cargaPillEl.style.opacity = "1";
    }
  }

  function renderizarTudo() {
    renderizarTiles();
    renderizarPill();
    renderizarSeries();
    atualizarProgressao();
    renderizarFooter();
  }

  cargaPillEl.addEventListener("click", async () => {
    const escolhido = await abrirSeletorCarga(cargaSelecionada);
    if (escolhido != null) {
      cargaSelecionada = escolhido;
      renderizarPill();
    }
  });

  function pararTudo() {
    if (cronometroAtivo) {
      cronometroAtivo.parar();
      cronometroAtivo = null;
    }
    if (wakeLockAtivo) {
      wakeLockAtivo.release().catch(() => {});
      wakeLockAtivo = null;
    }
  }

  function iniciarDescanso(descansoSegundos) {
    if (cronometroAtivo) {
      cronometroAtivo.parar();
    }

    restCard.classList.remove("rest-bar-hidden");
    const timeEl = restCard.querySelector(".time");

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

    cronometroAtivo = cronometro;

    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((lock) => { wakeLockAtivo = lock; }).catch(() => {});
    }

    cronometro.iniciar();
  }

  restCard.querySelector('[data-action="menos"]').addEventListener("click", () => cronometroAtivo && cronometroAtivo.ajustar(-30));
  restCard.querySelector('[data-action="mais"]').addEventListener("click", () => cronometroAtivo && cronometroAtivo.ajustar(30));

  async function registrarSerieAtual(numero) {
    const carga = cargaSelecionada;
    const reps = cfg.repsMax;
    const rir = cfg.rirAlvo;

    const seriesAnteriores = await getHistoricoCompletoDoExercicio(db, exercicio.id);
    const prs = detectarPRs({ carga, reps }, seriesAnteriores.map((s) => ({ carga: s.carga, reps: s.reps })));

    const registro = {
      exercicioId: exercicio.id,
      data: hoje,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir,
      serieNumero: numero,
    };

    await registrarSerie(db, registro);
    seriesHoje.push(registro);

    renderizarTudo();
    iniciarDescanso(cfg.descansoSegundos);

    const prsRelevantes = prs.filter((p) => p.tipo !== "primeira_serie");
    if (prsRelevantes.length > 0) {
      mostrarToastPR(prsRelevantes);
      if (onPrsDetectados) onPrsDetectados(prsRelevantes);
    }

    if (onSerieRegistrada) await onSerieRegistrada();
  }

  card.querySelector(".trocar-pill").addEventListener("click", () => {
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios);
    const nomes = sugestoes.map((e) => e.nome).join(", ") || "nenhuma alternativa encontrada";
    alert(`Alternativas: ${nomes}`);
  });

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px; display:flex; gap:10px;";
  rodape.innerHTML = `
    <button type="button" class="swap-pill historico-btn" aria-label="Histórico" style="width:52px; border-radius:999px; display:flex; align-items:center; justify-content:center;">🕐</button>
    <button type="button" class="swap-pill primario-btn" style="flex:1; background:var(--accent); color:var(--accent-ink);"></button>
  `;
  rodape.querySelector(".historico-btn").addEventListener("click", () => {
    if (onAbrirHistorico) onAbrirHistorico(exercicio);
  });
  const primarioBtn = rodape.querySelector(".primario-btn");
  primarioBtn.addEventListener("click", async () => {
    const pendente = numeroPendenteAtual();
    if (pendente == null) {
      if (onProximoExercicio) onProximoExercicio();
      return;
    }
    await registrarSerieAtual(pendente);
  });
  root.appendChild(rodape);

  renderizarTudo();

  root._dispose = pararTudo;

  return root;
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
