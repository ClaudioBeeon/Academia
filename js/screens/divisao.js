// js/screens/divisao.js
//
// Aba "Treinos" — faixa dos últimos 7 dias, relatório da semana (série vs.
// meta da ficha) ao lado da cobertura por músculo, sessões recentes (cada
// uma abre o detalhe do dia pra editar/lançar retroativo) e um calendário
// do mês inteiro.
import { getAll, get } from "../data/db.js";
import { getSeriesDesde, getSessoesAgrupadasPorDia } from "../data/historico.js";
import { obterDiaPeloMusculo } from "../engine/sequenciaSemanal.js";
import { registrarCardio, getCardioDesde } from "../data/cardio.js";
import { avaliarCardio } from "../engine/cardio.js";
import { getFicha } from "../data/ficha.js";
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
const NOME_DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const SVG_HALTERE = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8"/></svg>`;
const SVG_CORACAO = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s5 5 5 9a5 5 0 0 1-10 0c0-1.5.7-2.8.7-2.8S6 11 6 14a6 6 0 0 0 12 0c0-5-6-12-6-12z"/></svg>`;
const ICONE_POR_GRUPO = { peito: SVG_HALTERE, costas: SVG_HALTERE, perna: SVG_HALTERE, cardio: SVG_CORACAO, vazio: SVG_HALTERE };
const ICONE_CHECK = `<div class="sessao-check"><svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></div>`;

function nomeDoMusculo(chave) {
  return NOME_MUSCULO[chave] ?? chave.replace(/_/g, " ");
}

function classificarGrupo(musculo) {
  if (musculo === "peito") return "peito";
  if (["costas", "biceps", "deltoide_posterior"].includes(musculo)) return "costas";
  if (["quadriceps", "posterior_coxa", "gluteo", "panturrilha"].includes(musculo)) return "perna";
  return "vazio";
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
    todasAsSeries, seriesUltimos7Dias,
    ficha, perfil, cardioTodos, sessoesAgrupadas, protocolos,
  ] = await Promise.all([
    getAll(db, "historicoSeries"),
    getSeriesDesde(db, subtrairDias(hoje, 6)),
    getFicha(db),
    get(db, "perfil", "1.0"),
    getAll(db, "registrosCardio"),
    getSessoesAgrupadasPorDia(db, 6),
    getAll(db, "protocolo"),
  ]);
  const protocolo = protocolos[0] ?? null;
  const pesoKg = perfil?.dadosBasicos?.peso_kg;

  main.appendChild(montarFaixaDias(todasAsSeries, cardioTodos, hoje));

  const definicaoFase = protocolo?.volumeSemanalPorFase?.[perfil?.fase?.atual ?? "definicao"];
  const cobertura = calcularCoberturaMuscular({ seriesUltimos7Dias, definicaoFase });
  main.appendChild(montarParRelatorioECobertura(seriesUltimos7Dias, ficha, cobertura));

  // Editar um dia no detalhe (js/screens/historicoSessoes.js, aberto daqui
  // pelo calendário e pela lista de sessões) pode mudar séries e cardio de
  // qualquer data — mais simples e confiável recarregar os dois cards que
  // mostram isso diretamente do zero do que tentar remendar cada linha.
  let cardSessoesAtual = montarSecaoSessoes(db, sessoesAgrupadas, cardioTodos, pesoKg, hoje, onAbrirHistoricoTreinos, recarregarSessoesECalendario);
  let cardCalendarioAtual = montarCardCalendario(db, todasAsSeries, cardioTodos, hoje, recarregarSessoesECalendario);
  main.appendChild(cardSessoesAtual);
  main.appendChild(cardCalendarioAtual);

  async function recarregarSessoesECalendario() {
    const [todasAsSeriesNovas, cardioTodosNovo, sessoesAgrupadasNovas] = await Promise.all([
      getAll(db, "historicoSeries"),
      getAll(db, "registrosCardio"),
      getSessoesAgrupadasPorDia(db, 6),
    ]);
    const cardSessoesNovo = montarSecaoSessoes(db, sessoesAgrupadasNovas, cardioTodosNovo, pesoKg, hoje, onAbrirHistoricoTreinos, recarregarSessoesECalendario);
    const cardCalendarioNovo = montarCardCalendario(db, todasAsSeriesNovas, cardioTodosNovo, hoje, recarregarSessoesECalendario);
    cardSessoesAtual.replaceWith(cardSessoesNovo);
    cardCalendarioAtual.replaceWith(cardCalendarioNovo);
    cardSessoesAtual = cardSessoesNovo;
    cardCalendarioAtual = cardCalendarioNovo;
  }

  return root;
}

// ═══════════════ Faixa dos últimos 7 dias ═══════════════
function montarFaixaDias(todasAsSeries, cardioTodos, hoje) {
  const datasComAtividade = new Set([
    ...todasAsSeries.filter((s) => s.tipoSerie !== "aquecimento").map((s) => s.data),
    ...cardioTodos.map((r) => r.data),
  ]);

  const faixa = document.createElement("div");
  faixa.className = "faixa-dias";
  for (let i = 6; i >= 0; i--) {
    const dataIso = subtrairDias(hoje, i);
    const ehHoje = dataIso === hoje;
    const diaDoMes = Number(dataIso.split("-")[2]);
    const diaSemana = new Date(`${dataIso}T00:00:00`).getDay();

    const casa = document.createElement("div");
    casa.className = `fd-dia${datasComAtividade.has(dataIso) ? " treinou" : ""}${ehHoje ? " hoje" : ""}`;
    casa.innerHTML = `<div class="fd-num">${diaDoMes}</div><div class="fd-rot">${ehHoje ? "hoje" : NOME_DIA_SEMANA[diaSemana]}</div>`;
    faixa.appendChild(casa);
  }
  return faixa;
}

// ═══════════════ Relatório da semana + cobertura por músculo ═══════════════
function montarParRelatorioECobertura(seriesUltimos7Dias, ficha, cobertura) {
  const validas = seriesUltimos7Dias.filter((s) => s.tipoSerie !== "aquecimento");
  const seriesCount = validas.length;
  const volumeTotal = Math.round(validas.reduce((soma, s) => soma + s.carga * s.reps, 0));

  const metaSeries = ficha.dias.reduce(
    (soma, dia) => soma + dia.exercicios.reduce((s2, ex) => s2 + (ex.series ?? 0), 0),
    0
  );
  const percentual = metaSeries > 0 ? Math.min(100, Math.round((seriesCount / metaSeries) * 100)) : 0;
  const circunferencia = 264;
  const offset = Math.round(circunferencia * (1 - percentual / 100));

  const par = document.createElement("div");
  par.className = "par";
  par.innerHTML = `
    <div class="card-relatorio">
      <div class="rot">Esta semana</div>
      <div class="anel-wrap">
        <svg viewBox="0 0 100 100">
          <circle class="anel-trilha" cx="50" cy="50" r="42"></circle>
          <circle class="anel-prog" cx="50" cy="50" r="42" stroke-dasharray="${circunferencia}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="anel-centro"><b>${percentual}%</b><span>da meta</span></div>
      </div>
      <div class="sub">
        <div><b>${seriesCount}</b><span>séries</span></div>
        <div><b>${volumeTotal.toLocaleString("pt-BR")}</b><span>kg volume</span></div>
      </div>
    </div>
    <div class="card-cobertura">
      <div class="rot">Cobertura</div>
      ${montarItensCobertura(cobertura)}
    </div>
  `;
  return par;
}

function montarItensCobertura(cobertura) {
  if (cobertura.length === 0) {
    return `<div class="cob-item"><div class="cob-topo"><span>Sem dados ainda</span></div></div>`;
  }
  // Prioriza mostrar os músculos abaixo do alvo primeiro — é o dado mais
  // acionável, e o card só cabe uns 4 itens de forma legível.
  const priorizados = [...cobertura]
    .sort((a, b) => Number(b.abaixoDoAlvo) - Number(a.abaixoDoAlvo))
    .slice(0, 4);
  return priorizados
    .map((item) => {
      const faixaTexto = item.min != null ? `${item.atual}/${item.min}` : `${item.atual}`;
      const percentual = item.min != null ? Math.min(100, Math.round((item.atual / item.min) * 100)) : 100;
      return `
        <div class="cob-item">
          <div class="cob-topo"><span>${nomeDoMusculo(item.musculo)}</span><b>${faixaTexto}</b></div>
          <div class="cob-trilho"><i class="${item.abaixoDoAlvo ? "abaixo" : ""}" style="width:${percentual}%"></i></div>
        </div>
      `;
    })
    .join("");
}

// ═══════════════ Sessões recentes ═══════════════
function montarSecaoSessoes(db, sessoesAgrupadas, cardioTodos, pesoKg, hoje, onAbrirHistoricoTreinos, recarregarTudo) {
  const secao = document.createElement("section");

  const cabecalho = document.createElement("div");
  cabecalho.className = "secao-cab";
  cabecalho.innerHTML = `<h3>Sessões</h3>`;
  if (onAbrirHistoricoTreinos) {
    const verTodas = document.createElement("button");
    verTodas.type = "button";
    verTodas.textContent = "Ver todas";
    verTodas.addEventListener("click", onAbrirHistoricoTreinos);
    cabecalho.appendChild(verTodas);
  }
  secao.appendChild(cabecalho);

  // Um dia sem nenhuma série (só cardio, ou nada ainda) não tem sessão
  // agrupada — sem essa linha pinada, não existiria onde abrir o detalhe
  // de um dia que não passou pela musculação.
  const temSessaoHoje = sessoesAgrupadas.some((s) => s.data === hoje);
  const sessoes = temSessaoHoje ? sessoesAgrupadas : [{ data: hoje, series: [] }, ...sessoesAgrupadas];

  for (const sessao of sessoes) {
    secao.appendChild(montarLinhaSessao(db, sessao, cardioTodos, pesoKg, hoje, recarregarTudo));
  }

  return secao;
}

function montarLinhaSessao(db, sessao, cardioTodos, pesoKg, hoje, recarregarTudo) {
  const { data, series } = sessao;
  const validas = series.filter((s) => s.tipoSerie !== "aquecimento");
  const primeiroMusculo = validas[0]?.musculo;
  const diaEncontrado = primeiroMusculo ? obterDiaPeloMusculo(primeiroMusculo) : null;
  const cardioDoDia = cardioTodos.filter((r) => r.data === data);
  const feito = validas.length > 0;
  const { dia, mes } = formatarDataCurta(data);

  let bucket, titulo, subtitulo, kcal;
  if (feito) {
    bucket = classificarGrupo(primeiroMusculo);
    titulo = diaEncontrado ? diaEncontrado.titulo : "Sessão";
    const exs = new Set(validas.map((s) => s.exercicioId)).size;
    subtitulo = `${exs} exercício${exs === 1 ? "" : "s"} · ${validas.length} série${validas.length === 1 ? "" : "s"}`;
    kcal = estimarCaloriasDaSessao({ totalSeries: validas.length, pesoKg, registrosCardioDoDia: cardioDoDia }).total;
  } else if (cardioDoDia.length > 0) {
    bucket = "cardio";
    titulo = cardioDoDia.length === 1
      ? `Cardio — ${NOME_MODALIDADE[cardioDoDia[0].modalidade] ?? cardioDoDia[0].modalidade}`
      : `Cardio · ${cardioDoDia.length} registros`;
    const duracaoTotal = cardioDoDia.reduce((soma, r) => soma + (r.duracaoMinutos || 0), 0);
    subtitulo = duracaoTotal > 0 ? `${duracaoTotal} min` : "sem treino de musculação";
    kcal = estimarCaloriasDaSessao({ totalSeries: 0, pesoKg, registrosCardioDoDia: cardioDoDia }).total;
  } else {
    bucket = "vazio";
    titulo = data === hoje ? "Hoje" : `${dia}/${mes}`;
    subtitulo = "Nenhum treino ainda";
    kcal = 0;
  }

  const linha = document.createElement("div");
  linha.className = `sessao${feito ? " feito" : ""}`;
  linha.innerHTML = `
    ${feito ? ICONE_CHECK : ""}
    <div class="sessao-icone ${bucket}">${ICONE_POR_GRUPO[bucket]}</div>
    <div class="meio"><b></b><span></span></div>
    <div class="direita">${pesoKg > 0 && kcal > 0 ? `<b>${kcal}</b><span>kcal</span>` : ""}</div>
  `;
  linha.querySelector(".meio b").textContent = titulo;
  linha.querySelector(".meio span").textContent = subtitulo;
  linha.addEventListener("click", () => abrirDetalheDia(db, data, { aoFechar: recarregarTudo }));

  return linha;
}

export function montarFormCardio(db, data, diaParaAviso, aoSalvar) {
  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Modalidade
        <select name="modalidade">
          ${MODALIDADES_CARDIO.map((m) => `<option value="${m}">${NOME_MODALIDADE[m]}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="set-field">
      <label>Duração (min)<input type="number" name="duracaoMinutos" placeholder="30" /></label>
    </div>
    <div class="set-field">
      <label>Intensidade (1-5)
        <select name="intensidadePercebida">
          <option value="1">1 — muito leve</option>
          <option value="2">2 — leve</option>
          <option value="3" selected>3 — moderada</option>
          <option value="4">4 — forte</option>
          <option value="5">5 — muito forte</option>
        </select>
      </label>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1; background:var(--accent); color:var(--accent-ink);">Registrar</button>
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
