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
    <div class="rest-ctl"><button data-action="menos">−30s</button><button data-action="mais">+30s</button></div>
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
    const rir = Number(linha.querySelector('[name="rir"]').value);
    if (!carga || !reps) return;

    await registrarSerie(db, {
      exercicioId: exercicio.id,
      data: HOJE,
      musculo: exercicio.musculoPrimario,
      contribuicao: 1.0,
      tipoSerie: "normal",
      carga,
      reps,
      rir: rir || RIR_ALVO,
    });

    linha.classList.add("done");
    linha.querySelectorAll("input").forEach((input) => (input.disabled = true));

    iniciarDescansoNoCartaoSeguinte(card);
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
  form.innerHTML = `
    <div class="set-ring"><i>${jaFeita ? "✓" : numero}</i></div>
    <div class="set-field"><label>Carga</label><input name="carga" type="number" step="0.5" placeholder="${placeholderCarga}" value="${jaFeita ? jaFeita.carga : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>Reps</label><input name="reps" type="number" placeholder="${placeholderReps}" value="${jaFeita ? jaFeita.reps : ""}" ${jaFeita ? "disabled" : ""} /></div>
    <div class="set-field"><label>RIR</label><input name="rir" type="number" step="0.5" placeholder="${RIR_ALVO}" value="${jaFeita ? jaFeita.rir : ""}" ${jaFeita ? "disabled" : ""} /></div>
    ${jaFeita ? "" : '<button type="submit" style="grid-column: 1 / -1; display:none;">Confirmar</button>'}
  `;
  if (!jaFeita) {
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  }
  return form;
}

function iniciarDescansoNoCartaoSeguinte(card) {
  const restBar = card.nextElementSibling;
  if (!restBar || !restBar.classList.contains("rest-bar")) return;

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
