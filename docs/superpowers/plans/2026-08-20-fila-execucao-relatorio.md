# Fila do Dia → Execução → Relatório Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "Começar treino" scrolling to inline exercise cards with a real 3-screen flow: Fila do Dia (queue overview) → Execução (one exercise at a time, full screen) → Relatório (session summary), matching the approved Emon prototype.

**Architecture:** Three new screen modules (`fila.js`, `execucao.js`, `relatorio.js`) plus a small orchestrator (`sessao.js`) that owns the flow's internal state (current sub-view, current exercise index, PRs accumulated during the session) and swaps between the three via its own re-render, mounted as a single unit from `app.js` exactly like every other screen. `js/screens/treino.js` sheds everything that moves into `execucao.js`/`fila.js`/`relatorio.js`, keeping only the dashboard (greeting, plano+cardio carousel, atividade, check-in, day picker). No engine or data module changes — every engine call (`cargas.js`, `anilhas.js`, `aquecimento.js`, `progressao.js`, `rir.js`, `recordes.js`, `sessao.js`, `substituicao.js`, `sequenciaSemanal.js`, `sessaoGerada.js`) is reused exactly as-is, just relocated to new call sites.

**Tech Stack:** Same as every prior plan — vanilla JS ES modules, no build step. No new automated tests this plan (screens aren't unit tested in this project — this plan is 100% screen/wiring code, consistent with every prior screen-only plan having zero new test files).

**Spec:** `docs/superpowers/specs/2026-08-20-fila-execucao-relatorio-design.md`.

## Global Constraints

- No build step. Every JS file must run unmodified in the browser via `<script type="module">`.
- No IndexedDB schema changes, no engine logic changes — this plan is pure UI/navigation restructuring.
- Any DB-sourced or user-editable string must never be interpolated into `innerHTML` — use `.textContent` instead. Exception, same as every prior plan: an engine-produced value that is always one of a small fixed set of literal strings (day titles, alert `tipo`/`mensagem` from this app's own engines) may go into `innerHTML` when the surrounding template needs it, matching the existing pattern already used throughout `treino.js`/`divisao.js`.
- Every screen module still fetches its own data from `db` — the one exception in this plan is the `sessao.js` orchestrator, which computes the day/exercise-queue data ONCE and passes it by reference to `fila.js`/`execucao.js`/`relatorio.js` as plain function arguments (not re-fetched by each), because these three are sub-states of one continuous session flow owned by the orchestrator, not independent tab screens a user can jump into directly.
- The weekly-sequence day-persistence logic (`registrarDiaDaSessao`, only fires once, the first time a set is actually logged that day) moves from `treino.js` to `sessao.js`'s orchestrator, since sets are no longer logged on the Home screen.

---

## Task 1: Screen — Execução (`js/screens/execucao.js`)

**Files:**
- Create: `js/screens/execucao.js`

**Interfaces:**
- Produces: `montarTelaExecucao(db, contexto, callbacks) => Promise<HTMLElement>` where:
  - `contexto = { exercicio, indice, total, todosExercicios, protocolo, equipamento, hoje, mostrarExplicacaoAberta }` — `indice`/`total` are 1-based (`"Exercício 3 de 7"`); `mostrarExplicacaoAberta` is a boolean (true only the very first time any exercise opens in a session).
  - `callbacks = { onFechar, onProximoExercicio, onAbrirHistorico, onSerieRegistrada, onPrsDetectados }` — all invoked with no arguments except `onAbrirHistorico(exercicio)` and `onPrsDetectados(prs)` (array of PR objects from `detectarPRs`).

This is the existing `montarCardExercicio` from `js/screens/treino.js`, adapted to a full-screen single-exercise layout with a header, a collapsible `observacoesExecucao` block, and a footer instead of being one card among many. The set-logging logic (load suggestion, anilhas, progression hint, PR/RIR toasts, rest timer) is unchanged from what's already tested and working in `treino.js` today.

- [ ] **Step 1: Create the file with the adapted screen**

Create `js/screens/execucao.js`:

```javascript
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
    <div class="date-label">Exercício ${indice} de ${total}</div>
    <div class="day-title"></div>
  `;
  header.querySelector(".day-title").textContent = exercicio.nome;
  const fecharBtn = document.createElement("button");
  fecharBtn.type = "button";
  fecharBtn.className = "swap-pill";
  fecharBtn.textContent = "✕";
  fecharBtn.style.cssText = "position:absolute; top:14px; right:18px;";
  fecharBtn.addEventListener("click", () => { if (onFechar) onFechar(); });
  header.style.position = "relative";
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
```

(Everything in this file is a direct port of already-tested logic from `js/screens/treino.js` — only the wrapper markup (header with close button, footer with Histórico/Concluir, the new `observacoesExecucao` `<details>` block) is new. The `.trocar-pill`/history-pill split changes slightly: the "Histórico" action moves to the footer instead of the card header, since there's only one exercise on screen at a time now — a `<details>`/`<summary>` needs no JS to expand/collapse, browsers handle that natively.)

- [ ] **Step 2: Manual smoke check (no automated test — this file isn't unit tested, consistent with every other screen)**

Not applicable as an automated step; covered by this plan's final Task 8 (manual browser verification).

- [ ] **Step 3: Commit**

```bash
git add js/screens/execucao.js
git commit -m "Add Execução screen: single-exercise full-screen logging"
```

---

## Task 2: Screen — Fila do Dia (`js/screens/fila.js`)

**Files:**
- Create: `js/screens/fila.js`

**Interfaces:**
- Produces: `montarTelaFila(db, contexto, callbacks) => Promise<HTMLElement>` where:
  - `contexto = { diaInfo, exerciciosHoje, hoje }`.
  - `callbacks = { onExecutar, onFinalizarSessao, onVoltar }` — `onExecutar(indice)` (0-based index into `exerciciosHoje`), the other two take no arguments.

- [ ] **Step 1: Create the file**

Create `js/screens/fila.js`:

```javascript
// js/screens/fila.js
import { getSeriesDoExercicioNaData } from "../data/historico.js";

export async function montarTelaFila(db, contexto, callbacks) {
  const { diaInfo, exerciciosHoje, hoje } = contexto;
  const { onExecutar, onFinalizarSessao, onVoltar } = callbacks;

  const seriesPorExercicio = await Promise.all(
    exerciciosHoje.map((e) => getSeriesDoExercicioNaData(db, e.id, hoje))
  );

  let totalSeriesFeitas = 0;
  let exerciciosConcluidos = 0;
  const estados = seriesPorExercicio.map((series) => {
    totalSeriesFeitas += series.length;
    if (series.length >= 3) {
      exerciciosConcluidos++;
      return "concluido";
    }
    return series.length > 0 ? "andamento" : "pendente";
  });

  const root = document.createElement("div");
  root.className = "tela-fila";

  const header = document.createElement("header");
  header.className = "top";
  header.style.position = "relative";
  header.innerHTML = `
    <div class="date-label">${diaInfo.titulo}</div>
    <div class="day-title">Fila do dia</div>
  `;
  const voltarBtn = document.createElement("button");
  voltarBtn.type = "button";
  voltarBtn.className = "swap-pill";
  voltarBtn.textContent = "✕";
  voltarBtn.style.cssText = "position:absolute; top:14px; right:18px;";
  voltarBtn.addEventListener("click", () => { if (onVoltar) onVoltar(); });
  header.appendChild(voltarBtn);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const progresso = document.createElement("div");
  progresso.className = "prev-hint";
  progresso.style.padding = "0 18px 14px";
  progresso.textContent = `${exerciciosConcluidos}/${exerciciosHoje.length} exercícios · ${totalSeriesFeitas}/${exerciciosHoje.length * 3} séries`;
  main.appendChild(progresso);

  exerciciosHoje.forEach((exercicio, indice) => {
    const item = document.createElement("section");
    item.className = "exercise-card fila-item fila-item-" + estados[indice];
    item.innerHTML = `
      <div class="exercise-head">
        <div>
          <div class="exercise-name"></div>
          <div class="exercise-meta"></div>
        </div>
        <div class="fila-status"></div>
      </div>
    `;
    item.querySelector(".exercise-name").textContent = exercicio.nome;
    item.querySelector(".exercise-meta").textContent = exercicio.musculoPrimario;
    const statusEl = item.querySelector(".fila-status");
    statusEl.textContent = estados[indice] === "concluido" ? "✓" : estados[indice] === "andamento" ? `${seriesPorExercicio[indice].length}/3` : "";
    item.addEventListener("click", () => { if (onExecutar) onExecutar(indice); });
    main.appendChild(item);
  });

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px;";
  rodape.innerHTML = `<button type="button" class="swap-pill finalizar-btn" style="width:100%; background:var(--accent); color:var(--accent-ink);">Finalizar sessão</button>`;
  rodape.querySelector(".finalizar-btn").addEventListener("click", () => { if (onFinalizarSessao) onFinalizarSessao(); });
  root.appendChild(rodape);

  return root;
}
```

(`item.addEventListener("click", ...)` on the whole `.exercise-card` mirrors the same whole-card-clickable pattern already established for the plan card on the Home screen. No `innerHTML` here interpolates anything beyond static literals — every dynamic value (`exercicio.nome`, `exercicio.musculoPrimario`) goes through `.textContent`.)

- [ ] **Step 2: Commit**

```bash
git add js/screens/fila.js
git commit -m "Add Fila do Dia screen: exercise queue with progress"
```

---

## Task 3: Screen — Relatório (`js/screens/relatorio.js`)

**Files:**
- Create: `js/screens/relatorio.js`

**Interfaces:**
- Produces: `montarTelaRelatorio(db, contexto, callbacks) => Promise<HTMLElement>` where:
  - `contexto = { hoje, prsDaSessao }` — `prsDaSessao` is the array accumulated by the orchestrator across the whole Execução flow (each entry shaped like `detectarPRs`'s output items: `{ tipo, mensagem, ... }`).
  - `callbacks = { onConcluir }` — no arguments.

- [ ] **Step 1: Create the file**

Create `js/screens/relatorio.js`:

```javascript
// js/screens/relatorio.js
import { getSeriesDoDia } from "../data/historico.js";
import { calcularEstatisticasSessao } from "../engine/sessao.js";

export async function montarTelaRelatorio(db, contexto, callbacks) {
  const { hoje, prsDaSessao } = contexto;
  const { onConcluir } = callbacks;

  const seriesDoDia = await getSeriesDoDia(db, hoje);
  const stats = calcularEstatisticasSessao(seriesDoDia);

  const root = document.createElement("div");
  root.className = "tela-relatorio";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div class="date-label">Sessão concluída</div>
    <div class="day-title">Bom treino! 🎉</div>
  `;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const statsCard = document.createElement("section");
  statsCard.className = "exercise-card";
  statsCard.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Resumo</div></div>
    <div class="stats-grid" style="padding:0 18px 18px;">
      <div class="stat-tile"><b></b><span>Séries feitas</span></div>
      <div class="stat-tile"><b></b><span>Volume (kg)</span></div>
      <div class="stat-tile"><b></b><span>Exercícios</span></div>
      <div class="stat-tile"><b class="stat-tile-texto"></b><span>Músculos treinados</span></div>
    </div>
  `;
  const tiles = statsCard.querySelectorAll(".stat-tile b");
  tiles[0].textContent = stats.totalSeries;
  tiles[1].textContent = stats.volumeTotal;
  tiles[2].textContent = stats.exerciciosTreinados;
  tiles[3].textContent = stats.musculosTreinados.length > 0 ? stats.musculosTreinados.join(", ") : "—";
  main.appendChild(statsCard);

  if (prsDaSessao.length > 0) {
    const prsCard = document.createElement("section");
    prsCard.className = "exercise-card";
    prsCard.innerHTML = `<div class="exercise-head"><div class="exercise-name">🏆 Recordes desta sessão</div></div>`;
    const lista = document.createElement("div");
    lista.className = "sets";
    lista.style.padding = "0 18px 18px";
    for (const pr of prsDaSessao) {
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.textContent = pr.mensagem;
      lista.appendChild(linha);
    }
    prsCard.appendChild(lista);
    main.appendChild(prsCard);
  }

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px;";
  rodape.innerHTML = `<button type="button" class="swap-pill concluir-btn" style="width:100%; background:var(--accent); color:var(--accent-ink);">Concluir</button>`;
  rodape.querySelector(".concluir-btn").addEventListener("click", () => { if (onConcluir) onConcluir(); });
  root.appendChild(rodape);

  return root;
}
```

(`pr.mensagem` is engine-produced from `recordes.js`, always one of its fixed Portuguese templates, rendered via `.textContent` here regardless — matching the project's blanket hardening convention.)

- [ ] **Step 2: Commit**

```bash
git add js/screens/relatorio.js
git commit -m "Add Relatório screen: session stats and PRs"
```

---

## Task 4: Screen — Orchestrator (`js/screens/sessao.js`)

**Files:**
- Create: `js/screens/sessao.js`

**Interfaces:**
- Produces: `montarFluxoSessao(db, callbacks) => Promise<HTMLElement>` where `callbacks = { onVoltarParaHoje, onAbrirHistorico }`.

**Consumes:** `montarTelaFila` (Task 2), `montarTelaExecucao` (Task 1), `montarTelaRelatorio` (Task 3); `getUltimoDiaRegistrado`, `registrarDiaDaSessao` from `../data/sequenciaSemanal.js`; `DIAS_SEQUENCIA`, `obterDiaPorNumero`, `obterMusculosDoDia`, `determinarDiaDaSessao` from `../engine/sequenciaSemanal.js`; `gerarSessaoDoDia` from `../engine/sessaoGerada.js`; `getEquipamento` from `../data/equipamento.js`; `getSeriesDoDia`, `getUltimaSerieGeral` from `../data/historico.js` (note: `getUltimaSerieGeral` is NOT needed here — `determinarDiaDaSessao`'s new signature only takes `ultimoDiaRegistrado`/`hoje`, no series history; do not import it).

- [ ] **Step 1: Create the file**

Create `js/screens/sessao.js`:

```javascript
// js/screens/sessao.js
import { getAll } from "../data/db.js";
import { getSeriesDoDia } from "../data/historico.js";
import { getEquipamento } from "../data/equipamento.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { DIAS_SEQUENCIA, obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { gerarSessaoDoDia } from "../engine/sessaoGerada.js";
import { montarTelaFila } from "./fila.js";
import { montarTelaExecucao } from "./execucao.js";
import { montarTelaRelatorio } from "./relatorio.js";

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarFluxoSessao(db, { onVoltarParaHoje, onAbrirHistorico } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const [todasAsSeries, ultimoDiaRegistrado] = await Promise.all([
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
  ]);

  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  let diaPersistido = Boolean(ultimoDiaRegistrado && ultimoDiaRegistrado.data === hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);

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
  let estadoAtual = "fila";
  let indiceExercicioAtual = 0;
  let explicacaoJaMostrada = false;
  const prsDaSessao = [];

  const persistirDiaSeNecessario = async () => {
    if (!diaPersistido) {
      await registrarDiaDaSessao(db, diaDaSessao, hoje);
      diaPersistido = true;
    }
  };

  async function renderizar() {
    root.innerHTML = "";
    let tela;
    if (estadoAtual === "fila") {
      tela = await montarTelaFila(db, { diaInfo, exerciciosHoje, hoje }, {
        onExecutar: async (indice) => {
          indiceExercicioAtual = indice;
          estadoAtual = "execucao";
          await renderizar();
        },
        onFinalizarSessao: async () => {
          estadoAtual = "relatorio";
          await renderizar();
        },
        onVoltar: onVoltarParaHoje,
      });
    } else if (estadoAtual === "execucao") {
      const exercicio = exerciciosHoje[indiceExercicioAtual];
      const mostrarExplicacaoAberta = !explicacaoJaMostrada;
      explicacaoJaMostrada = true;
      tela = await montarTelaExecucao(db, {
        exercicio,
        indice: indiceExercicioAtual + 1,
        total: exerciciosHoje.length,
        todosExercicios,
        protocolo,
        equipamento,
        hoje,
        mostrarExplicacaoAberta,
      }, {
        onFechar: async () => {
          estadoAtual = "fila";
          await renderizar();
        },
        onProximoExercicio: async () => {
          if (indiceExercicioAtual < exerciciosHoje.length - 1) {
            indiceExercicioAtual++;
            await renderizar();
          } else {
            estadoAtual = "relatorio";
            await renderizar();
          }
        },
        onAbrirHistorico,
        onSerieRegistrada: persistirDiaSeNecessario,
        onPrsDetectados: (prs) => { prsDaSessao.push(...prs); },
      });
    } else {
      tela = await montarTelaRelatorio(db, { hoje, prsDaSessao }, {
        onConcluir: onVoltarParaHoje,
      });
    }
    root.appendChild(tela);
  }

  await renderizar();
  return root;
}
```

(This duplicates the "compute today's day and exercise queue" logic that also lives in `js/screens/treino.js` — a deliberate, documented tradeoff from the spec: Fila/Execução/Relatório are sub-states of one continuous flow owned by this orchestrator, not independent tab screens, so passing the computed data down by reference instead of re-fetching per sub-screen avoids 3x redundant queries within a single session. `getUltimaSerieGeral` is correctly NOT imported — `determinarDiaDaSessao`'s current signature only needs `ultimoDiaRegistrado`/`hoje`.)

- [ ] **Step 2: Commit**

```bash
git add js/screens/sessao.js
git commit -m "Add sessão flow orchestrator tying Fila/Execução/Relatório together"
```

---

## Task 5: Screen — Simplify Treino, wire the new flow (`js/screens/treino.js`, `js/app.js`)

**Files:**
- Modify: `js/screens/treino.js`
- Modify: `js/app.js`

**Interfaces:**
- `montarTelaTreino(db, { onIrParaCardio, onComecarTreino } = {})` — drops `onAbrirHistorico` (no longer needed here; history is now reached from inside Execução, not from the Home dashboard) and gains `onComecarTreino` (invoked with no arguments).
- `montarFluxoSessao(db, { onVoltarParaHoje, onAbrirHistorico })` (Task 4) is called from `app.js`.

- [ ] **Step 1: Strip `treino.js` down to the dashboard**

Replace the ENTIRE contents of `js/screens/treino.js` with:

```javascript
// js/screens/treino.js
import { getAll } from "../data/db.js";
import { getSeriesDoDia } from "../data/historico.js";
import { getCheckin, registrarCheckin } from "../data/checkin.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { DIAS_SEQUENCIA, obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { gerarSessaoDoDia } from "../engine/sessaoGerada.js";
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

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarTelaTreino(db, { onIrParaCardio, onComecarTreino } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const [seriesDeHoje, todasAsSeries, ultimoDiaRegistrado, cardioRecente] = await Promise.all([
    getSeriesDoDia(db, hoje),
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getCardioRecente(db, 1),
  ]);
  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
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
    if (onComecarTreino) onComecarTreino();
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
```

(Note: the `if (exerciciosHoje.length === 0)` empty-state paragraph that used to sit below the inline exercise cards is gone along with the exercise cards themselves — the plan card's own `<h2>${diaInfo.titulo}</h2>` plus `<b>0</b> exercícios` already communicates an empty day; Fila will show its own empty state if the user still taps through with zero exercises. `exerciciosHoje` is still computed here purely to show the count/series/minutes estimate on the plan card — it does not render exercise cards anymore.)

- [ ] **Step 2: Wire `js/app.js`**

Change:
```javascript
import { montarTelaTreino } from "./screens/treino.js";
```
to:
```javascript
import { montarTelaTreino } from "./screens/treino.js";
import { montarFluxoSessao } from "./screens/sessao.js";
```

Change:
```javascript
      if (tabName === "hoje") {
        content.textContent = "";
        content.appendChild(await montarTelaTreino(db, {
          onAbrirHistorico: async (exercicio) => {
            content.textContent = "";
            content.appendChild(await montarTelaHistorico(db, exercicio, () => renderTab("hoje")));
          },
          onIrParaCardio: () => renderTab("divisao"),
        }));
        return;
      }
```
to:
```javascript
      if (tabName === "hoje") {
        content.textContent = "";
        content.appendChild(await montarTelaTreino(db, {
          onIrParaCardio: () => renderTab("divisao"),
          onComecarTreino: async () => {
            content.textContent = "";
            content.appendChild(await montarFluxoSessao(db, {
              onVoltarParaHoje: () => renderTab("hoje"),
              onAbrirHistorico: async (exercicio) => {
                content.textContent = "";
                content.appendChild(await montarTelaHistorico(db, exercicio, () => renderTab("hoje")));
              },
            }));
          },
        }));
        return;
      }
```

(`onAbrirHistorico`'s "voltar" callback goes to `renderTab("hoje")` — the Home dashboard — not back into the middle of a session flow; returning to an in-progress Fila/Execução state from History is explicitly out of scope, matching the spec's simplification list. This is the same behavior the old inline version already had — History always returned to Home, never resumed a specific scroll position.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — same count as after Task 4 (this task adds no new tests — screens aren't unit tested in this project, consistent with every prior screen change; no engine/data files are touched by this task).

- [ ] **Step 4: Commit**

```bash
git add js/screens/treino.js js/app.js
git commit -m "Simplify Treino to a dashboard; wire Começar treino to the new session flow"
```

---

## Task 6: Update service worker cache list

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Add the 4 new files to `APP_SHELL`, bump the cache version**

Add these entries anywhere in the `APP_SHELL` array:
```javascript
  "./js/screens/execucao.js",
  "./js/screens/fila.js",
  "./js/screens/relatorio.js",
  "./js/screens/sessao.js",
```

Change `const CACHE_NAME = "app-treino-shell-v16";` to `const CACHE_NAME = "app-treino-shell-v17";`.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — 178 tests total (unchanged from the prior plan; this plan adds zero automated tests), all green.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Add Fila/Execução/Relatório/sessão files to service worker cache, bump to v17"
```

---

## Task 7: Styling — Minimal CSS for the new screens (`css/styles.css`)

**Files:**
- Modify: `css/styles.css`

- [ ] **Step 1: Add styles for the new screen-specific classes**

Add these rules anywhere appropriate in the file:

```css
.explicacao-execucao { margin: 0 18px 14px; padding: 12px 14px; background: var(--card-2); border-radius: 12px; border: 1px solid var(--line); }
.explicacao-execucao summary { font-weight: 700; cursor: pointer; }
.explicacao-execucao p { margin: 8px 0 0; font-size: 0.85rem; color: var(--ink-2); line-height: 1.5; }
.fila-item { cursor: pointer; display: block; }
.fila-item .fila-status { font-weight: 800; font-size: 0.9rem; color: var(--ink-faint); }
.fila-item-concluido { opacity: 0.6; }
.fila-item-concluido .fila-status { color: var(--accent); }
.fila-item-andamento { border-color: var(--accent); }
```

(These reuse existing tokens — `var(--card-2)`, `var(--line)`, `var(--ink-2)`, `var(--ink-faint)`, `var(--accent)` — already defined in `css/tokens.css`, no new tokens introduced.)

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — CSS changes don't affect `node --test`; confirms nothing else broke.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "Add styles for Fila/Execução screens"
```

---

## Task 8: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Verify the Home → Fila transition**

Reload the app. Confirm the Home dashboard no longer shows exercise cards or a session-summary grid — just the carousel, Minha atividade, and check-in. Click anywhere on the "Treino de hoje" card. Confirm it navigates to a new Fila do Dia screen (not a scroll) showing the day's exercise list with progress counts.

- [ ] **Step 3: Verify Fila → Execução → back to Fila**

Click an exercise card in Fila. Confirm it opens Execução for that exercise (header shows "Exercício N de M" and the exercise name), with the suggested load, set rows, and (if `observacoesExecucao` exists for that exercise) an expandable "Como executar" block open by default on the first exercise of the session. Log a set — confirm PR/RIR toasts still work as before, and the rest timer still starts. Click the [✕] — confirm it returns to Fila, and that exercise's card now shows progress (e.g. "1/3").

- [ ] **Step 4: Verify Execução → next exercise → Relatório**

Re-enter Execução for an exercise, click "Concluir exercício" — confirm it advances to the next exercise in the queue (not back to Fila). Repeat until the last exercise, click "Concluir exercício" on it — confirm it goes straight to Relatório, showing session stats and any PRs logged during this manual test.

- [ ] **Step 5: Verify Relatório → Concluir → Home**

Click "Concluir" on Relatório. Confirm it returns to the Home dashboard, and that "Minha atividade"/the plan card reflect the sets just logged (e.g. séries esta semana incremented).

- [ ] **Step 6: Verify the day-picker and day-persistence still work inside this flow**

On a fresh day with zero sets logged, confirm the day-picker `<select>` is still visible on the Home plan card (unchanged from before). Change it, confirm the day updates. Enter the session flow and log a set — confirm (via IndexedDB inspection, same technique as prior plans) that `config["sequenciaSemanal"]` only updates at that point, not merely from opening Fila/Execução with zero sets logged.

- [ ] **Step 7: Verify History still reachable from Execução**

Click "Histórico" in an Execução screen's footer. Confirm it opens the per-exercise history screen; confirm its own back button returns to Home (not back into the session flow — matching the documented scope decision).

- [ ] **Step 8: Verify no console errors and offline still works**

Use `read_console_messages` throughout the above. Stop the dev server, reload, confirm the app (including the full Fila/Execução/Relatório flow) still loads and works fully from cache.

- [ ] **Step 9: Report result to the user**

Show the working 3-screen flow. Note this closes out the Emon prototype's remaining piece; the explicitly deferred items (session-vs-previous-session comparison, weekly volume in Relatório, DIA DETALHE day-strip) remain documented as future work if wanted.
