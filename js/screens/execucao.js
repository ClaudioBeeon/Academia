// js/screens/execucao.js
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDaUltimaSessaoAnterior } from "../data/historico.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { avaliarProgressao } from "../engine/progressao.js";
import { calcularAnilhas } from "../engine/anilhas.js";
import { gerarEscadaAquecimento } from "../engine/aquecimento.js";
import { detectarPRs } from "../engine/recordes.js";
import { validarRir } from "../engine/rir.js";
import { criarCronometro } from "./timer.js";

const CONFIG_PADRAO = { repsMin: 8, repsMax: 12, rirAlvo: 2, descansoSegundos: 90 };

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
    <div>
      <div class="exercise-name"></div>
      <div class="exercise-meta">${cfg.repsMin}–${cfg.repsMax} reps · RIR ${cfg.rirAlvo}</div>
    </div>
    <div style="display:flex; gap:6px;">
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

  function iniciarDescanso(restBar, descansoSegundos) {
    if (!restBar || !restBar.classList || !restBar.classList.contains("rest-bar")) return;

    if (cronometroAtivo) {
      cronometroAtivo.parar();
    }

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

    cronometroAtivo = cronometro;

    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((lock) => { wakeLockAtivo = lock; }).catch(() => {});
    }

    restBar.querySelector('[data-action="menos"]').addEventListener("click", () => cronometro.ajustar(-30));
    restBar.querySelector('[data-action="mais"]').addEventListener("click", () => cronometro.ajustar(30));

    cronometro.iniciar();
  }

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
      : null;
    iniciarDescanso(restBar, cfg.descansoSegundos);

    const prsRelevantes = prs.filter((p) => p.tipo !== "primeira_serie");
    if (prsRelevantes.length > 0) {
      mostrarToastPR(prsRelevantes);
      if (onPrsDetectados) onPrsDetectados(prsRelevantes);
    }

    if (onSerieRegistrada) await onSerieRegistrada();
  });

  card.querySelector(".trocar-pill").addEventListener("click", () => {
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios);
    const nomes = sugestoes.map((e) => e.nome).join(", ") || "nenhuma alternativa encontrada";
    alert(`Alternativas: ${nomes}`);
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

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px; display:flex; gap:10px;";
  rodape.innerHTML = `
    <button type="button" class="swap-pill historico-btn">Histórico</button>
    <button type="button" class="swap-pill concluir-btn" style="flex:1; background:var(--accent); color:var(--accent-ink);">Concluir exercício</button>
  `;
  rodape.querySelector(".historico-btn").addEventListener("click", () => {
    if (onAbrirHistorico) onAbrirHistorico(exercicio);
  });
  rodape.querySelector(".concluir-btn").addEventListener("click", () => {
    if (onProximoExercicio) onProximoExercicio();
  });
  root.appendChild(rodape);

  root._dispose = pararTudo;

  return root;
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

function criarPlaceholderDescanso() {
  const div = document.createElement("div");
  div.className = "rest-bar rest-bar-hidden";
  div.innerHTML = `
    <div><div class="label">Descanso</div><div class="time">00:00</div></div>
    <div class="rest-ctl"><button type="button" data-action="menos">−30s</button><button type="button" data-action="mais">+30s</button></div>
  `;
  return div;
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
