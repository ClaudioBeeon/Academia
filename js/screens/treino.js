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

  const pularBtn = document.createElement("button");
  pularBtn.type = "button";
  pularBtn.className = "pular-treino-btn";
  pularBtn.textContent = "Já treinei — pular →";
  pularBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    await registrarDiaDaSessao(db, diaDaSessao, hoje, true);
    window.location.reload();
  });
  planoCard.appendChild(pularBtn);

  const carrossel = document.createElement("div");
  carrossel.className = "carrossel-plano";
  carrossel.appendChild(planoCard);
  carrossel.appendChild(montarCardCardio(ultimoCardio, onIrParaCardio));
  main.appendChild(carrossel);

  main.appendChild(montarSecaoProximosDias(diaDaSessao));

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

function montarSecaoProximosDias(diaDaSessao) {
  const section = document.createElement("section");
  section.className = "atividade-secao";

  const cabecalho = document.createElement("div");
  cabecalho.className = "shead";
  cabecalho.innerHTML = "<h4>Próximos dias</h4>";
  section.appendChild(cabecalho);

  const strip = document.createElement("div");
  strip.className = "dias-strip";
  for (let passo = 1; passo < DIAS_SEQUENCIA.length; passo++) {
    const numero = ((diaDaSessao - 1 + passo) % DIAS_SEQUENCIA.length) + 1;
    const dia = obterDiaPorNumero(numero);
    const chip = document.createElement("div");
    chip.className = "dia-chip";
    chip.innerHTML = `
      <div class="num">Dia ${dia.numero}</div>
      <div class="titulo">${dia.titulo}</div>
      <div class="musc">${dia.musculos.join(", ")}</div>
    `;
    strip.appendChild(chip);
  }
  section.appendChild(strip);

  return section;
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
