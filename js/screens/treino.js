// js/screens/treino.js
import { get, getAll } from "../data/db.js";
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio } from "../data/historico.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { criarCronometro } from "./timer.js";

const HOJE = new Date().toISOString().slice(0, 10);
const FAIXA_REPS = { min: 8, max: 12 };
const RIR_ALVO = 2;
const DESCANSO_PADRAO_SEGUNDOS = 90;

export async function montarTelaTreino(db) {
  const todosExercicios = await getAll(db, "exercicios");
  const exerciciosHoje = todosExercicios.filter((e) => e.musculoPrimario === "peito");

  const root = document.createElement("div");
  root.className = "tela-treino";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div class="date-label">Sessão de hoje</div>
    <div class="day-title">Peito</div>
  `;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  for (let i = 0; i < exerciciosHoje.length; i++) {
    const exercicio = exerciciosHoje[i];
    const card = await montarCardExercicio(db, exercicio, todosExercicios);
    main.appendChild(card);
    if (i < exerciciosHoje.length - 1) {
      main.appendChild(criarPlaceholderDescanso());
    }
  }

  if (exerciciosHoje.length === 0) {
    main.innerHTML = `<p class="vazio">Nenhum exercício de peito cadastrado ainda.</p>`;
  }

  return root;
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

async function montarCardExercicio(db, exercicio, todosExercicios) {
  const seriesHoje = await getSeriesDoExercicioNaData(db, exercicio.id, HOJE);
  const ultimaAnterior = await getUltimaSerieAnterior(db, exercicio.id, HOJE);
  const amostras = await getAmostrasRecentesDoExercicio(db, exercicio.id);
  const sugestao = sugerirCarga(amostras, RIR_ALVO);

  const card = document.createElement("section");
  card.className = "exercise-card";

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `
    <div>
      <div class="exercise-name">${exercicio.nome}</div>
      <div class="exercise-meta">${FAIXA_REPS.min}–${FAIXA_REPS.max} reps · RIR ${RIR_ALVO}</div>
    </div>
    <button class="swap-pill" type="button">Trocar</button>
  `;
  card.appendChild(head);

  const setsContainer = document.createElement("div");
  setsContainer.className = "sets";
  card.appendChild(setsContainer);

  const placeholderCarga = sugestao.cargaSugerida != null
    ? `${sugestao.cargaSugerida} kg`
    : (ultimaAnterior ? `${ultimaAnterior.carga} kg` : "—");
  const placeholderReps = ultimaAnterior ? String(ultimaAnterior.reps) : String(FAIXA_REPS.min);

  const totalSeriesAlvo = 3;
  for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
    const jaFeita = seriesHoje[numero - 1];
    setsContainer.appendChild(criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps }));
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

  setsContainer.addEventListener("submit", async (event) => {
    const linha = event.target.closest(".set-row");
    if (!linha) return;
    event.preventDefault();
    const carga = Number(linha.querySelector('[name="carga"]').value);
    const reps = Number(linha.querySelector('[name="reps"]').value);
    const rirInput = linha.querySelector('[name="rir"]').value;
    const rirDigitado = Number(rirInput);
    if (!carga || !reps) return;

    await registrarSerie(db, {
      exercicioId: exercicio.id,
      data: HOJE,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir: rirInput === "" || Number.isNaN(rirDigitado) ? RIR_ALVO : rirDigitado,
    });

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
    iniciarDescanso(restBar);
  });

  card.querySelector(".swap-pill").addEventListener("click", () => {
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios);
    const nomes = sugestoes.map((e) => e.nome).join(", ") || "nenhuma alternativa encontrada";
    alert(`Alternativas: ${nomes}`);
  });

  return card;
}

function criarLinhaSerie({ numero, jaFeita, placeholderCarga, placeholderReps }) {
  const form = document.createElement("form");
  form.className = "set-row" + (jaFeita ? " done" : "");
  const ringHtml = jaFeita
    ? `<div class="set-ring"><i>✓</i></div>`
    : `<button type="submit" class="set-ring" aria-label="Marcar série ${numero} concluída"><i>${numero}</i></button>`;
  form.innerHTML = `
    ${ringHtml}
    <div class="set-field"><label>Carga</label><input name="carga" type="number" step="0.5" placeholder="${placeholderCarga}" value="${jaFeita ? jaFeita.carga : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>Reps</label><input name="reps" type="number" placeholder="${placeholderReps}" value="${jaFeita ? jaFeita.reps : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>RIR</label><input name="rir" type="number" step="0.5" placeholder="${RIR_ALVO}" value="${jaFeita ? jaFeita.rir : ""}" ${jaFeita ? "disabled" : ""} /></div>
  `;
  return form;
}

function iniciarDescanso(restBar) {
  if (!restBar || !restBar.classList || !restBar.classList.contains("rest-bar")) return;

  restBar.classList.remove("rest-bar-hidden");
  const timeEl = restBar.querySelector(".time");

  const cronometro = criarCronometro({
    duracaoInicialSegundos: DESCANSO_PADRAO_SEGUNDOS,
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
