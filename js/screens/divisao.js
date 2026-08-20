// js/screens/divisao.js
import { getAll } from "../data/db.js";
import { getUltimaSerieGeral, getSeriesDoDia, getUltimasSessoesPorExercicio, getSeriesDesde } from "../data/historico.js";
import { obterGrupoDoMusculo, determinarGrupoDaSessao } from "../engine/divisao.js";
import { getCheckinsRecentes } from "../data/checkin.js";
import { avaliarAlertasRecuperacao } from "../engine/alertasRecuperacao.js";
import { avaliarAlertasDesempenho } from "../engine/alertasDesempenho.js";
import { avaliarAlertasVolume } from "../engine/alertasVolume.js";
import { registrarCardio, getCardioRecente } from "../data/cardio.js";
import { avaliarCardio } from "../engine/cardio.js";
import { getGrupoForcado } from "../data/grupoForcado.js";

const MODALIDADES_CARDIO = ["bicicleta", "eliptico", "escada", "caminhada", "corrida"];
const NOME_MODALIDADE = {
  bicicleta: "Bicicleta",
  eliptico: "Elíptico",
  escada: "Escada",
  caminhada: "Caminhada",
  corrida: "Corrida",
};

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
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarTelaDivisao(db) {
  const hoje = obterDataLocal();
  const root = document.createElement("div");
  root.className = "tela-divisao";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Divisão de treino</div><div class="day-title">Divisão</div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const [ultimaSerieGeral, todasAsSeries, seriesDeHoje, checkinsRecentes, sessoesPorExercicio, seriesUltimos7Dias, exercicios, cardioRecente, grupoForcado] = await Promise.all([
    getUltimaSerieGeral(db),
    getAll(db, "historicoSeries"),
    getSeriesDoDia(db, hoje),
    getCheckinsRecentes(db),
    getUltimasSessoesPorExercicio(db),
    getSeriesDesde(db, subtrairDias(hoje, 6)),
    getAll(db, "exercicios"),
    getCardioRecente(db),
    getGrupoForcado(db, hoje),
  ]);

  const grupoDeHoje = grupoForcado ?? determinarGrupoDaSessao(seriesDeHoje, ultimaSerieGeral);
  const tituloGrupo = grupoDeHoje === "superior" ? "Superior" : "Inferior";

  const exercicioPorId = new Map(exercicios.map((e) => [e.id, e]));
  const alertasRecuperacao = avaliarAlertasRecuperacao(checkinsRecentes);
  const alertasDesempenho = avaliarAlertasDesempenho(sessoesPorExercicio);
  const musculosComDesempenhoCaindo = new Set(
    alertasDesempenho.map((a) => exercicioPorId.get(a.exercicioId)?.musculoPrimario).filter(Boolean)
  );
  const alertasVolume = avaliarAlertasVolume({
    seriesUltimos7Dias,
    seriesHoje: seriesDeHoje,
    sessoesPorExercicio,
    musculosComDesempenhoCaindo,
    hoje,
  });

  const todosAlertas = [...alertasRecuperacao, ...alertasDesempenho, ...alertasVolume];
  if (todosAlertas.length > 0) {
    main.appendChild(montarCardAlertas(todosAlertas, exercicioPorId));
  }
  main.appendChild(montarCardHoje(tituloGrupo));
  main.appendChild(montarCardCardio(db, hoje, grupoDeHoje, cardioRecente));
  main.appendChild(montarCardHistorico(todasAsSeries));

  return root;
}

function montarCardCardio(db, hoje, grupoDeHoje, cardioRecente) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Cardio</div></div>`;

  const corpo = document.createElement("div");
  card.appendChild(corpo);
  renderizarCardio(corpo, db, hoje, grupoDeHoje, cardioRecente, null);

  return card;
}

function renderizarCardio(corpo, db, hoje, grupoDeHoje, cardioRecente, avisoRecente) {
  corpo.innerHTML = "";

  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0 18px 18px";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Modalidade</label>
      <select name="modalidade" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;">
        ${MODALIDADES_CARDIO.map((m) => `<option value="${m}">${NOME_MODALIDADE[m]}</option>`).join("")}
      </select>
    </div>
    <div class="set-field">
      <label>Duração (min)</label>
      <input type="number" name="duracaoMinutos" placeholder="30" />
    </div>
    <div class="set-field">
      <label>Intensidade percebida (1-5)</label>
      <select name="intensidadePercebida" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;">
        <option value="1">1 — muito leve</option>
        <option value="2">2 — leve</option>
        <option value="3">3 — moderada</option>
        <option value="4">4 — forte</option>
        <option value="5">5 — muito forte</option>
      </select>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Registrar</button>
  `;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const modalidade = form.modalidade.value;
    const duracaoMinutos = Number(form.duracaoMinutos.value) || undefined;
    const intensidadePercebida = Number(form.intensidadePercebida.value);

    await registrarCardio(db, { data: hoje, modalidade, duracaoMinutos, intensidadePercebida });

    const avisoCardio = avaliarCardio({ modalidade, grupoDoDia: grupoDeHoje });
    const atualizado = await getCardioRecente(db);
    renderizarCardio(corpo, db, hoje, grupoDeHoje, atualizado, avisoCardio);
  });

  corpo.appendChild(form);

  if (avisoRecente) {
    const aviso = document.createElement("div");
    aviso.className = "prev-hint";
    aviso.style.padding = "0 18px 18px";
    aviso.textContent = `⚠️ ${avisoRecente.mensagem}`;
    corpo.appendChild(aviso);
  }

  const lista = document.createElement("div");
  lista.className = "sets";
  lista.style.padding = "0 18px 18px";

  if (cardioRecente.length === 0) {
    lista.innerHTML = `<p class="vazio">Nenhuma sessão de cardio registrada ainda.</p>`;
  } else {
    for (const registro of cardioRecente) {
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      const duracao = registro.duracaoMinutos ? `${registro.duracaoMinutos}min · ` : "";
      linha.textContent = `${registro.data} — ${NOME_MODALIDADE[registro.modalidade] ?? registro.modalidade} · ${duracao}intensidade ${registro.intensidadePercebida}/5`;
      lista.appendChild(linha);
    }
  }

  corpo.appendChild(lista);
}

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

function montarCardHoje(tituloGrupo) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Hoje: ${tituloGrupo}</div></div>
    <div class="prev-hint" style="padding:0 18px 18px;">Rotação por sessão: o grupo alterna a cada treino registrado, não por dia fixo da semana.</div>
  `;
  return card;
}

function montarCardHistorico(todasAsSeries) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Sessões recentes</div></div>`;

  const musculoPorData = new Map();
  for (const serie of todasAsSeries) {
    if (!musculoPorData.has(serie.data)) musculoPorData.set(serie.data, serie.musculo);
  }

  const datasOrdenadas = [...musculoPorData.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 14);

  const lista = document.createElement("div");
  lista.className = "sets";
  lista.style.padding = "0 18px 18px";

  if (datasOrdenadas.length === 0) {
    lista.innerHTML = `<p class="vazio">Nenhuma sessão registrada ainda.</p>`;
  } else {
    for (const data of datasOrdenadas) {
      const grupo = obterGrupoDoMusculo(musculoPorData.get(data));
      const rotulo = grupo === "superior" ? "Superior" : grupo === "inferior" ? "Inferior" : "Grupo não identificado";
      const linha = document.createElement("div");
      linha.className = "prev-hint";
      linha.textContent = `${data} — ${rotulo}`;
      lista.appendChild(linha);
    }
  }

  card.appendChild(lista);
  return card;
}
