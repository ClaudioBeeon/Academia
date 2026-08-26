// js/screens/execucao.js
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDaUltimaSessaoAnterior } from "../data/historico.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { calcularAnilhas } from "../engine/anilhas.js";
import { gerarEscadaAquecimento } from "../engine/aquecimento.js";
import { detectarPRs } from "../engine/recordes.js";
import { criarCronometro } from "./timer.js";
import { montarTelaSerieCheia } from "./telaSerieCheia.js";
import { abrirEditorCadencia } from "./editorCadencia.js";
import { cadenciaDoExercicio, textoDaCadencia } from "../engine/cadencia.js";
import { getAjusteCadencia, salvarAjusteCadencia, limparAjusteCadencia } from "../data/ajustesCadencia.js";
import { animarDetails } from "../lib/detailsAnimado.js";
import { abrirSubstituirExercicio } from "./substituirExercicio.js";
import { montarTelaHistorico } from "./historico.js";
import { montarCaixaPerguntaIA } from "./caixaPerguntaIA.js";
import { responderPerguntaExercicio } from "../ai/gemini.js";

const CONFIG_PADRAO = { repsMin: 8, repsMax: 12, rirAlvo: 2, descansoSegundos: 90 };
const TOTAL_SERIES_ALVO_PADRAO = 3;
const INCREMENTO_CARGA_PADRAO_KG = 1;
const CARGA_PRIMEIRA_VEZ_PADRAO_KG = 5;

const ICONE_RELOGIO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>`;

// A prescrição da ficha vence o padrão por tipo de exercício: é o que permite
// a cadeira extensora pedir RIR 0 e o stiff pedir RIR 3, sendo os dois
// exercícios de perna. Sem ficha, cai no padrão do protocolo como antes.
function obterConfigExercicio(protocolo, exercicio) {
  const prescricao = exercicio.prescricao;
  if (prescricao?.repeticoes) {
    return {
      repsMin: prescricao.repeticoes.min,
      repsMax: prescricao.repeticoes.max,
      rirAlvo: prescricao.rirAlvo ?? 2,
      descansoSegundos: prescricao.descansoSegundos ?? 90,
    };
  }
  const config = protocolo?.tiposDeExercicio?.[exercicio.tipo];
  if (!config) return CONFIG_PADRAO;
  return {
    repsMin: config.faixaRepeticoes.min,
    repsMax: config.faixaRepeticoes.max,
    rirAlvo: (config.rirAlvo.min + config.rirAlvo.max) / 2,
    descansoSegundos: config.descansoSegundos.min,
  };
}

function formatarNumero(valor) {
  if (valor == null) return "—";
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(/\.0$/, "");
}

function arredondarIncremento(valor, passo) {
  if (!(passo > 0)) return Math.round(valor * 2) / 2;
  return Math.round(valor / passo) * passo;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function montarTelaExecucao(db, contexto, callbacks) {
  const { exercicio, indice, total, todosExercicios, idsExerciciosHoje = [], protocolo, equipamento, hoje, mostrarExplicacaoAberta } = contexto;
  const { onFechar, onProximoExercicio, onSerieRegistrada, onPrsDetectados, onExercicioSubstituido, onExercicioAdiado, onMinimizarSessao } = callbacks;

  const cfg = obterConfigExercicio(protocolo, exercicio);
  const totalSeriesAlvo = exercicio.seriesAlvo ?? TOTAL_SERIES_ALVO_PADRAO;
  const incrementoCarga = exercicio.incrementoMinimo_kg ?? INCREMENTO_CARGA_PADRAO_KG;
  let cronometroAtivo = null;
  let wakeLockAtivo = null;
  let numeroEmAndamento = null;
  let inicioTrabalhoTs = null;
  let intervalTrabalho = null;
  const seriesHoje = await getSeriesDoExercicioNaData(db, exercicio.id, hoje);
  const ultimaAnterior = await getUltimaSerieAnterior(db, exercicio.id, hoje);
  const amostras = await getAmostrasRecentesDoExercicio(db, exercicio.id);
  const sugestao = sugerirCarga(amostras, cfg.rirAlvo);
  const sessaoAnteriorCompleta = await getSeriesDaUltimaSessaoAnterior(db, exercicio.id, hoje);

  const cargaPadrao = sugestao.cargaSugerida
    ?? ultimaAnterior?.carga
    ?? (exercicio.equipamento === "barra" ? equipamento.pesoBarra : CARGA_PRIMEIRA_VEZ_PADRAO_KG);
  let cargaSelecionada = Math.max(incrementoCarga, arredondarIncremento(cargaPadrao, incrementoCarga));

  // Reps e RIR não têm mais um valor fixo gravado sem perguntar: cada série
  // pendente começa pré-preenchida com a mesma série da sessão anterior (é o
  // dado mais parecido com o que vai acontecer agora), e só cai no padrão da
  // prescrição quando não existe sessão anterior pra comparar.
  function valoresIniciaisParaSerie(numero) {
    const equivalente = sessaoAnteriorCompleta.find((s) => s.serieNumero === numero);
    return {
      reps: equivalente?.reps ?? cfg.repsMax,
      rir: equivalente?.rir ?? cfg.rirAlvo,
    };
  }

  let repsAtual = cfg.repsMax;
  let rirAtual = cfg.rirAlvo;
  let campoAtivo = "carga";

  const root = document.createElement("div");
  root.className = "tela-execucao";

  const header = document.createElement("header");
  header.className = "top";
  header.style.alignItems = "center";
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <button type="button" class="icon-btn voltar-btn" aria-label="Voltar">←</button>
      <div>
        <div class="date-label">Exercício ${indice} de ${total}</div>
        <div class="day-title exec-titulo"></div>
      </div>
    </div>
  `;
  header.querySelector(".exec-titulo").textContent = exercicio.nome;
  header.querySelector(".voltar-btn").addEventListener("click", () => { if (onFechar) onFechar(); });
  const acoesHeader = document.createElement("div");
  acoesHeader.className = "exec-acoes-header";
  const trocarBtn = document.createElement("button");
  trocarBtn.type = "button";
  trocarBtn.className = "swap-pill trocar-pill";
  trocarBtn.textContent = "Trocar";
  acoesHeader.appendChild(trocarBtn);
  if (onExercicioAdiado && total > 1) {
    const adiarBtn = document.createElement("button");
    adiarBtn.type = "button";
    adiarBtn.className = "swap-pill adiar-pill";
    adiarBtn.textContent = "Deixar pra depois";
    adiarBtn.addEventListener("click", () => onExercicioAdiado(exercicio.id));
    acoesHeader.appendChild(adiarBtn);
  }
  header.appendChild(acoesHeader);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  if (exercicio.equipamento === "barra") {
    const ferramentasPill = document.createElement("button");
    ferramentasPill.type = "button";
    ferramentasPill.className = "swap-pill";
    ferramentasPill.textContent = "Ferramentas";
    ferramentasPill.style.margin = "0 0 16px";
    main.appendChild(ferramentasPill);

    const painelFerramentas = document.createElement("div");
    painelFerramentas.className = "sets ferramentas-painel";
    painelFerramentas.style.padding = "0 0 12px";
    main.appendChild(painelFerramentas);

    ferramentasPill.addEventListener("click", () => {
      const abrindo = !painelFerramentas.classList.contains("aberto");
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
      painelFerramentas.classList.toggle("aberto", abrindo);
    });
  }

  // Linha do tempo: uma marca por série-alvo, com o resultado embaixo assim
  // que a série é registrada — substitui a antiga lista vertical + os dois
  // tiles do topo, que repetiam o mesmo número de carga de três jeitos.
  const linhaTempoEl = document.createElement("div");
  linhaTempoEl.className = "exec-linha-tempo";
  linhaTempoEl.style.setProperty("--exec-series", totalSeriesAlvo);
  linhaTempoEl.innerHTML = `<div class="exec-lt-barra"></div><div class="exec-lt-marcas"></div>`;
  main.appendChild(linhaTempoEl);

  // O trio carga/reps/RIR: só um fica "aceso" por vez (o que a tela está
  // perguntando agora), e o controle −/+ embaixo serve o campo aceso. Tocar
  // num campo apagado (quando permitido) passa o controle pra ele.
  const trioEl = document.createElement("div");
  trioEl.className = "exec-trio";
  trioEl.innerHTML = `
    <button type="button" class="exec-campo" data-campo="carga"><div class="rot">Carga</div><span class="val"></span></button>
    <button type="button" class="exec-campo" data-campo="reps"><div class="rot">Reps</div><span class="val"></span></button>
    <button type="button" class="exec-campo" data-campo="rir"><div class="rot">RIR</div><span class="val"></span></button>
  `;
  main.appendChild(trioEl);

  const controleEl = document.createElement("div");
  controleEl.className = "exec-controle";
  controleEl.innerHTML = `
    <button type="button" class="menos" aria-label="Diminuir">−</button>
    <span class="qual">Ajustando<b></b></span>
    <button type="button" class="mais" aria-label="Aumentar">+</button>
  `;
  main.appendChild(controleEl);

  const notaEl = document.createElement("p");
  notaEl.className = "exec-nota";
  main.appendChild(notaEl);

  // Guia de cadência: mora no telão de tela cheia, que só existe enquanto a
  // série está em andamento — construído sob demanda em iniciarTrabalho().
  const ajusteSalvo = await getAjusteCadencia(db, exercicio.id);
  const cadenciaDaFicha = cadenciaDoExercicio(exercicio);
  let cadenciaAtual = cadenciaDoExercicio(exercicio, ajusteSalvo);
  let temAjuste = Boolean(ajusteSalvo);
  let telaCheiaAtual = null;

  const ritmoEl = document.createElement("button");
  ritmoEl.type = "button";
  ritmoEl.className = "exec-ritmo";
  main.appendChild(ritmoEl);

  function renderizarRitmo() {
    ritmoEl.innerHTML = `<span class="rot">Ritmo</span><span class="txt"></span><span class="editar">Ajustar</span>`;
    ritmoEl.querySelector(".txt").textContent = textoDaCadencia(cadenciaAtual);
    ritmoEl.classList.toggle("ajustado", temAjuste);
  }
  renderizarRitmo();

  ritmoEl.addEventListener("click", async () => {
    const resultado = await abrirEditorCadencia({
      nomeExercicio: exercicio.nome,
      cadenciaAtual,
      cadenciaDaFicha,
      temAjuste,
    });
    if (!resultado) return;

    if (resultado.restaurar) {
      await limparAjusteCadencia(db, exercicio.id);
      cadenciaAtual = cadenciaDaFicha;
      temAjuste = false;
    } else {
      await salvarAjusteCadencia(db, exercicio.id, resultado.cadencia);
      cadenciaAtual = cadenciaDoExercicio(exercicio, resultado.cadencia);
      temAjuste = true;
    }
    renderizarRitmo();
  });

  // Uma única caixa flutuante pro cronômetro, compartilhada entre trabalho
  // (contando pra cima, preta) e descanso (contando pra baixo, lima). Trocar
  // de estado recolore a MESMA caixa e faz a leitura de dentro girar como um
  // carrossel vertical — a de agora sobe e sai por cima, a nova entra
  // subindo de baixo —, sempre dentro do mesmo tamanho de caixa.
  const cronometroPillEl = document.createElement("div");
  cronometroPillEl.className = "exec-cronometro exec-cronometro-oculto";
  cronometroPillEl.innerHTML = `
    <div class="carrossel">
      <div class="leitura">
        <div class="txt"></div>
        <div class="t">00:00</div>
      </div>
    </div>
    <div class="ctl" hidden>
      <button type="button" data-action="menos" aria-label="Menos 30 segundos">−30</button>
      <button type="button" data-action="mais" aria-label="Mais 30 segundos">+30</button>
    </div>
  `;
  root.appendChild(cronometroPillEl);
  const carrosselEl = cronometroPillEl.querySelector(".carrossel");
  const cronoCtlEl = cronometroPillEl.querySelector(".ctl");
  let leituraAtualEl = carrosselEl.querySelector(".leitura");
  let cronoTxtEl = leituraAtualEl.querySelector(".txt");
  let cronoTEl = leituraAtualEl.querySelector(".t");
  let transicaoTimeoutId = null;

  function concluirTransicaoCarrossel(leituraFinal) {
    if (transicaoTimeoutId) { clearTimeout(transicaoTimeoutId); transicaoTimeoutId = null; }
    carrosselEl.querySelectorAll(".leitura").forEach((el) => { if (el !== leituraFinal) el.remove(); });
    leituraFinal.classList.remove("carrossel-entrando", "carrossel-saindo");
    carrosselEl.style.height = "";
    leituraAtualEl = leituraFinal;
    cronoTxtEl = leituraFinal.querySelector(".txt");
    cronoTEl = leituraFinal.querySelector(".t");
  }

  function mostrarCronometro(estado, rotulo, valorTexto, { comTransicao = false } = {}) {
    const jaVisivel = !cronometroPillEl.classList.contains("exec-cronometro-oculto");
    cronometroPillEl.dataset.estado = estado;
    cronometroPillEl.classList.remove("exec-cronometro-oculto");

    if (!comTransicao || !jaVisivel) {
      concluirTransicaoCarrossel(leituraAtualEl);
      cronoTxtEl.textContent = rotulo;
      cronoTEl.textContent = valorTexto;
      cronoCtlEl.hidden = estado !== "descanso";
      return;
    }

    // Descanso some na hora (não faz sentido os botões ±30 ficarem visíveis
    // enquanto o carrossel ainda mostra o cronômetro de trabalho saindo).
    if (estado !== "descanso") cronoCtlEl.hidden = true;

    const alturaAtual = leituraAtualEl.getBoundingClientRect().height;
    carrosselEl.style.height = `${alturaAtual}px`;

    const saindo = leituraAtualEl;
    const entrando = saindo.cloneNode(true);
    entrando.querySelector(".txt").textContent = rotulo;
    entrando.querySelector(".t").textContent = valorTexto;
    entrando.classList.add("carrossel-entrando");
    carrosselEl.appendChild(entrando);

    // Força o navegador a pintar o estado inicial (embaixo, fora de vista)
    // antes de disparar a transição — sem isso o browser costuma juntar as
    // duas mudanças de estilo num único frame e a animação não roda.
    entrando.getBoundingClientRect();
    requestAnimationFrame(() => {
      saindo.classList.add("carrossel-saindo");
      entrando.classList.remove("carrossel-entrando");
    });

    transicaoTimeoutId = setTimeout(() => {
      concluirTransicaoCarrossel(entrando);
      cronoCtlEl.hidden = estado !== "descanso";
    }, 340);
  }

  const prescricao = exercicio.prescricao;

  const blocos = [];
  if (prescricao?.comoExecutar) blocos.push(["Como executar", prescricao.comoExecutar]);
  if (prescricao?.quandoSubirCarga) blocos.push(["Quando subir a carga", prescricao.quandoSubirCarga]);
  if (prescricao?.atencao) blocos.push(["Atenção", prescricao.atencao]);
  if (prescricao?.porqueEstaAqui) blocos.push(["Por que este exercício está aqui", prescricao.porqueEstaAqui]);
  if (blocos.length === 0 && exercicio.observacoesExecucao) {
    blocos.push(["Como executar", exercicio.observacoesExecucao]);
  }

  if (blocos.length > 0) {
    const explicacao = document.createElement("details");
    explicacao.className = "explicacao-execucao";
    explicacao.open = Boolean(mostrarExplicacaoAberta);
    const summary = document.createElement("summary");
    summary.textContent = prescricao ? "Guia do exercício" : "Como executar";
    explicacao.appendChild(summary);
    const corpoExplicacao = document.createElement("div");
    corpoExplicacao.className = "explicacao-execucao-corpo";
    for (const [titulo, texto] of blocos) {
      const h = document.createElement("h5");
      h.textContent = titulo;
      const p = document.createElement("p");
      p.textContent = texto;
      corpoExplicacao.append(h, p);
    }
    explicacao.appendChild(corpoExplicacao);
    animarDetails(explicacao, corpoExplicacao);
    main.appendChild(explicacao);
  }

  // Dúvida livre sobre este exercício específico — a IA já sabe qual é, o
  // usuário só pergunta ("sinto isso na lombar, é normal?").
  main.appendChild(montarCaixaPerguntaIA({
    titulo: "Dúvidas sobre este exercício?",
    placeholder: "ex: sinto isso mais no ombro que no peito, é normal?",
    perguntar: (pergunta) => responderPerguntaExercicio(exercicio, pergunta),
  }));

  function numeroPendenteAtual() {
    for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
      if (!seriesHoje.find((s) => s.serieNumero === numero)) return numero;
    }
    return null;
  }

  // Mesma barra segmentada da fila do dia, aqui com um traço por série em vez
  // de por exercício: a posição na série é lida pelo traço aceso, então a
  // marca de baixo não precisa mais repetir "série N" em texto.
  function renderizarLinhaTempo() {
    const pendente = numeroPendenteAtual();

    const barraEl = linhaTempoEl.querySelector(".exec-lt-barra");
    barraEl.innerHTML = "";
    for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
      const traco = document.createElement("i");
      if (seriesHoje.some((s) => s.serieNumero === numero)) traco.className = "on";
      else if (numero === pendente) traco.className = "agora";
      barraEl.appendChild(traco);
    }

    const marcasEl = linhaTempoEl.querySelector(".exec-lt-marcas");
    marcasEl.innerHTML = "";
    for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
      const feita = seriesHoje.find((s) => s.serieNumero === numero);
      const marca = document.createElement("div");
      marca.className = "exec-lt-marca";
      if (feita) {
        marca.innerHTML = `<div class="kg">${formatarNumero(feita.carga)}×${feita.reps}</div><div class="rir">RIR ${feita.rir}</div>`;
      } else if (numero === pendente) {
        marca.classList.add("agora");
        marca.innerHTML = `<div class="kg">agora</div><div class="rir">&nbsp;</div>`;
      } else {
        marca.classList.add("vazia");
        marca.innerHTML = `<div class="kg">—</div><div class="rir">&nbsp;</div>`;
      }
      marcasEl.appendChild(marca);
    }
  }

  function renderizarTrioEControle() {
    const pendente = numeroPendenteAtual();
    const emSerie = numeroEmAndamento != null;

    const btnCarga = trioEl.querySelector('[data-campo="carga"]');
    const btnReps = trioEl.querySelector('[data-campo="reps"]');
    const btnRir = trioEl.querySelector('[data-campo="rir"]');

    btnCarga.querySelector(".val").textContent = `${formatarNumero(cargaSelecionada)} kg`;
    btnReps.querySelector(".val").textContent = formatarNumero(repsAtual);
    btnRir.querySelector(".val").textContent = formatarNumero(rirAtual);

    // Carga trava assim que a série começa — é o único momento em que
    // "trava" faz sentido, porque reps e RIR só existem depois de terminar.
    btnCarga.disabled = emSerie;
    [btnCarga, btnReps, btnRir].forEach((btn) => {
      btn.classList.toggle("ativo", btn.dataset.campo === campoAtivo);
    });

    const rotulos = { carga: "carga · kg", reps: "repetições", rir: "RIR" };
    controleEl.querySelector(".qual b").textContent = rotulos[campoAtivo];

    if (pendente == null) {
      trioEl.style.display = "none";
      controleEl.style.display = "none";
      notaEl.style.display = "none";
      return;
    }
    trioEl.style.display = "";
    controleEl.style.display = "flex";

    if (!emSerie) {
      notaEl.style.display = "";
      notaEl.innerHTML = `Alvo <b>${cfg.repsMin}–${cfg.repsMax}</b> reps, parando com <b>${cfg.rirAlvo}</b> sobrando. Anda de ${formatarNumero(incrementoCarga)} em ${formatarNumero(incrementoCarga)} kg.`;
    } else {
      notaEl.style.display = "none";
    }
  }

  function renderizarFooter() {
    const pendente = numeroPendenteAtual();
    if (numeroEmAndamento != null) {
      primarioBtn.textContent = "Terminei — registrar";
    } else if (pendente == null) {
      primarioBtn.textContent = "Concluir exercício";
    } else {
      primarioBtn.textContent = `Comecei a série ${pendente}`;
    }
  }

  function renderizarTudo() {
    renderizarLinhaTempo();
    renderizarTrioEControle();
    renderizarFooter();
  }

  const AJUSTES = {
    carga: (delta) => { cargaSelecionada = Math.max(incrementoCarga, cargaSelecionada + delta * incrementoCarga); },
    reps: (delta) => { repsAtual = Math.max(0, repsAtual + delta); },
    rir: (delta) => { rirAtual = Math.max(0, rirAtual + delta); },
  };

  // O telão (se estiver aberto) espelha qualquer ajuste feito por aqui —
  // os dois controles editam as mesmas variáveis, só a exibição é dupla.
  function sincronizarTelaCheia() {
    if (telaCheiaAtual) telaCheiaAtual.atualizarValores({ carga: cargaSelecionada, reps: repsAtual, rir: rirAtual });
  }

  controleEl.querySelector(".menos").addEventListener("click", () => { AJUSTES[campoAtivo](-1); renderizarTrioEControle(); sincronizarTelaCheia(); });
  controleEl.querySelector(".mais").addEventListener("click", () => { AJUSTES[campoAtivo](1); renderizarTrioEControle(); sincronizarTelaCheia(); });

  trioEl.querySelectorAll(".exec-campo").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      campoAtivo = btn.dataset.campo;
      renderizarTrioEControle();
    });
  });

  // Só para a animação de trabalho (onda + cronômetro subindo) — usada na
  // transição pro descanso, que continua no MESMO telão em vez de fechar e
  // reabrir. Quem precisa fechar o telão de vez chama fecharTelaCheia().
  function pararAnimacaoTrabalho() {
    if (intervalTrabalho) {
      clearInterval(intervalTrabalho);
      intervalTrabalho = null;
    }
    inicioTrabalhoTs = null;
    if (telaCheiaAtual) telaCheiaAtual.pararTrabalho();
  }

  function fecharTelaCheia() {
    pararAnimacaoTrabalho();
    if (telaCheiaAtual) {
      telaCheiaAtual.elemento.remove();
      telaCheiaAtual = null;
    }
  }

  function pararDescanso({ ocultar = true } = {}) {
    if (cronometroAtivo) {
      cronometroAtivo.parar();
      cronometroAtivo = null;
    }
    if (ocultar) cronometroPillEl.classList.add("exec-cronometro-oculto");
  }

  // O navegador solta o Wake Lock sozinho assim que a aba sai de foco e não
  // devolve na volta — por isso isto é chamado tanto ao iniciar série/descanso
  // quanto ao reabrir o app, senão a tela só ficava acesa até o primeiro
  // minimizar.
  function pedirWakeLock() {
    if (!("wakeLock" in navigator)) return;
    if (wakeLockAtivo && !wakeLockAtivo.released) return;
    navigator.wakeLock.request("screen").then((lock) => { wakeLockAtivo = lock; }).catch(() => {});
  }

  function pararTudo() {
    pararDescanso();
    fecharTelaCheia();
    if (wakeLockAtivo) {
      wakeLockAtivo.release().catch(() => {});
      wakeLockAtivo = null;
    }
    document.removeEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
    window.removeEventListener("focus", aoVoltarAoPrimeiroPlano);
    window.removeEventListener("online", aoVoltarAoPrimeiroPlano);
  }

  function atualizarCronoTrabalho() {
    if (inicioTrabalhoTs == null) return;
    const segundos = Math.max(0, Math.floor((Date.now() - inicioTrabalhoTs) / 1000));
    const min = String(Math.floor(segundos / 60)).padStart(2, "0");
    const seg = String(segundos % 60).padStart(2, "0");
    cronoTEl.textContent = `${min}:${seg}`;
  }

  // A onda só começa a rodar de verdade depois da contagem regressiva do
  // telão — dá tempo de largar o celular na posição antes do cronômetro
  // subir.
  function comecarTrabalhoAgora(comTransicaoNoCronometro) {
    inicioTrabalhoTs = Date.now();
    mostrarCronometro("trabalho", "Em andamento", "00:00", { comTransicao: Boolean(comTransicaoNoCronometro) });
    intervalTrabalho = setInterval(atualizarCronoTrabalho, 1000);
    telaCheiaAtual.iniciarTrabalho();
  }

  // A primeira série do exercício ganha 5s ("posicione o celular" — é a
  // primeira vez chegando nesse aparelho); a partir da segunda, o celular
  // já está no lugar e bastam 3s de aviso antes de retomar.
  function duracaoContagem(numero) {
    return numero === 1
      ? { segundos: 5, rotulo: "Posicione o celular" }
      : { segundos: 3, rotulo: "Prepare-se" };
  }

  function iniciarTrabalho(numero) {
    // Começar uma nova série tem que encerrar o descanso de verdade — antes
    // disso o relógio de descanso continuava contando por baixo mesmo depois
    // de "Comecei a série" ser tocado, porque só o timer de trabalho era
    // iniciado e o de descanso nunca era parado. Se o descanso ainda estava
    // na tela, o carrossel gira pra trabalho em vez de sumir e reaparecer —
    // o ciclo trabalho→descanso→trabalho fica sempre na mesma caixa.
    const descansoVisivel = !cronometroPillEl.classList.contains("exec-cronometro-oculto");
    pararDescanso({ ocultar: !descansoVisivel });

    numeroEmAndamento = numero;
    const iniciais = valoresIniciaisParaSerie(numero);
    repsAtual = iniciais.reps;
    rirAtual = iniciais.rir;
    campoAtivo = "reps";

    telaCheiaAtual = montarTelaSerieCheia({
      exercicio,
      cadencia: cadenciaAtual,
      cargaSelecionada,
      repsMax: cfg.repsMax,
      rirAlvo: cfg.rirAlvo,
      repsAtual,
      rirAtual,
      incrementoCarga,
      totalSeriesAlvo,
      numeroAtual: numero,
      aoFechar: fecharTelaCheia,
      aoTerminar: () => finalizarTrabalhoERegistrar(),
      aoAjustarDescanso: (delta) => { if (cronometroAtivo) cronometroAtivo.ajustar(delta); },
      // "Pular descanso": zera o restante na hora — mesma via do botão
      // "−30" levado até o fim, que já dispara aoFinalizar corretamente e
      // (com o telão aberto) já emenda direto na próxima série.
      aoPularDescanso: () => { if (cronometroAtivo) cronometroAtivo.ajustar(-cronometroAtivo.obterRestante()); },
      // Carga/reps/RIR continuam editáveis com o telão aberto — mesma
      // lógica de ajuste (AJUSTES) do trio da tela normal, só disparada
      // daqui. Reaproveitar a mesma função é o que garante que os dois
      // nunca desincronizam.
      aoAjustar: (campo, delta) => {
        AJUSTES[campo](delta);
        renderizarTrioEControle();
      },
      aoMinimizar: (infoTempo) => { if (onMinimizarSessao) onMinimizarSessao(infoTempo); },
    });
    root.appendChild(telaCheiaAtual.elemento);
    pedirWakeLock();

    const { segundos, rotulo } = duracaoContagem(numero);
    telaCheiaAtual.mostrarContagem(segundos, rotulo, () => comecarTrabalhoAgora(descansoVisivel));

    renderizarTudo();
  }

  async function finalizarTrabalhoERegistrar() {
    const numero = numeroEmAndamento;
    pararAnimacaoTrabalho();
    numeroEmAndamento = null;
    campoAtivo = "carga";
    await registrarSerieAtual(numero);
  }

  function formatarRelogio(segundos) {
    const min = String(Math.floor(segundos / 60)).padStart(2, "0");
    const seg = String(segundos % 60).padStart(2, "0");
    return `${min}:${seg}`;
  }

  function iniciarDescanso(descansoSegundos) {
    if (cronometroAtivo) cronometroAtivo.parar();

    // A mesma caixa que mostrava o trabalho vira descanso: recolore de preto
    // pra lima e a leitura de dentro gira em carrossel — sobe e sai por
    // cima, a nova entra subindo de baixo.
    mostrarCronometro("descanso", "Descanso", formatarRelogio(descansoSegundos), { comTransicao: true });

    // O telão não fecha ao terminar a série — o corpo vira o anel
    // regressivo, no mesmo lugar da onda, sem trocar de tela.
    if (telaCheiaAtual) telaCheiaAtual.mostrarDescanso(descansoSegundos);

    const cronometro = criarCronometro({
      duracaoInicialSegundos: descansoSegundos,
      aoAtualizar: (restante) => {
        cronoTEl.textContent = formatarRelogio(restante);
        if (telaCheiaAtual) telaCheiaAtual.atualizarDescanso(restante, descansoSegundos);
      },
      aoFinalizar: () => {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        cronometroPillEl.classList.add("exec-cronometro-oculto");

        // Com o telão ainda aberto (não foi fechado na seta de voltar) e
        // ainda existindo série pendente, o descanso — zerou sozinho ou foi
        // pulado em "Pular descanso", os dois caem aqui — emenda direto
        // numa contagem de 3s pro próximo trabalho e já entra na onda
        // sozinho, sem voltar pra tela de início do exercício. Se o telão
        // foi fechado ou não sobrou série, cai no comportamento de sempre:
        // só fecha.
        const proximaSerie = numeroPendenteAtual();
        if (telaCheiaAtual && proximaSerie != null) {
          numeroEmAndamento = proximaSerie;
          const iniciais = valoresIniciaisParaSerie(proximaSerie);
          repsAtual = iniciais.reps;
          rirAtual = iniciais.rir;
          campoAtivo = "reps";
          telaCheiaAtual.atualizarSerieAtual(proximaSerie);
          renderizarTudo();

          const { segundos, rotulo } = duracaoContagem(proximaSerie);
          telaCheiaAtual.mostrarContagem(segundos, rotulo, () => comecarTrabalhoAgora(false));
        } else {
          fecharTelaCheia();
        }
      },
    });

    cronometroAtivo = cronometro;

    pedirWakeLock();

    cronometro.iniciar();
  }

  // Volta a sincronizar os cronômetros com o relógio de verdade quando o app
  // volta a ficar em primeiro plano — cobre tanto o app sendo reaberto depois
  // de minimizado quanto a conexão voltando depois de instável, os dois
  // momentos em que o navegador atrasa ou pausa o setInterval e o relógio na
  // tela ficava parecendo travado ou "ainda contando" por conta própria.
  function aoVoltarAoPrimeiroPlano() {
    if (document.visibilityState === "hidden") return;
    if (cronometroAtivo) cronometroAtivo.resincronizar();
    if (inicioTrabalhoTs != null) atualizarCronoTrabalho();
    if (cronometroAtivo || inicioTrabalhoTs != null) pedirWakeLock();
  }
  document.addEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
  window.addEventListener("focus", aoVoltarAoPrimeiroPlano);
  window.addEventListener("online", aoVoltarAoPrimeiroPlano);

  cronoCtlEl.querySelector('[data-action="menos"]').addEventListener("click", () => cronometroAtivo && cronometroAtivo.ajustar(-30));
  cronoCtlEl.querySelector('[data-action="mais"]').addEventListener("click", () => cronometroAtivo && cronometroAtivo.ajustar(30));

  async function registrarSerieAtual(numero) {
    const carga = cargaSelecionada;
    const reps = repsAtual;
    const rir = rirAtual;

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

  trocarBtn.addEventListener("click", async () => {
    // Nunca sugere um exercício que já está na fila de hoje — senão trocar
    // pra ele criava duas caixas iguais na mesma sessão.
    const outrosDeHoje = new Set(idsExerciciosHoje.filter((id) => id !== exercicio.id));
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios, 8).filter((e) => !outrosDeHoje.has(e.id)).slice(0, 4);
    const escolhido = await abrirSubstituirExercicio({ nomeAtual: exercicio.nome, sugestoes });
    if (!escolhido) return;
    if (onExercicioSubstituido) await onExercicioSubstituido(exercicio.id, escolhido.id);
  });

  const rodape = document.createElement("div");
  rodape.className = "exec-footer";
  rodape.innerHTML = `
    <button type="button" class="exec-footer-sq historico-btn" aria-label="Histórico">${ICONE_RELOGIO}</button>
    <button type="button" class="exec-footer-primary primario-btn"></button>
  `;
  // Abre por cima, sem trocar de tela — histórico é informativo, não pode
  // derrubar a série/descanso em andamento por baixo (a execução inteira
  // era desmontada nessa troca antes, matando o cronômetro sem chance de
  // voltar pra ele depois).
  rodape.querySelector(".historico-btn").addEventListener("click", async () => {
    const overlayHistorico = document.createElement("div");
    overlayHistorico.className = "historico-overlay";
    const conteudo = await montarTelaHistorico(db, exercicio, () => overlayHistorico.remove());
    overlayHistorico.appendChild(conteudo);
    document.body.appendChild(overlayHistorico);
  });
  const primarioBtn = rodape.querySelector(".primario-btn");
  primarioBtn.addEventListener("click", async () => {
    if (numeroEmAndamento != null) {
      await finalizarTrabalhoERegistrar();
      return;
    }
    const pendente = numeroPendenteAtual();
    if (pendente == null) {
      if (onProximoExercicio) onProximoExercicio();
      return;
    }
    iniciarTrabalho(pendente);
  });
  root.appendChild(rodape);

  renderizarTudo();

  root._dispose = pararTudo;

  return root;
}

function mostrarToastPR(prs) {
  const toast = document.createElement("div");
  toast.className = "rest-bar toast-flutuante";
  toast.setAttribute("role", "status");
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = `${proximoOffsetToast()}px`;
  toast.style.width = "calc(100% - 44px)";
  toast.style.maxWidth = "398px";
  toast.style.zIndex = "10";
  toast.innerHTML = `<div><div class="label">🏆 Recorde pessoal</div><div class="time" style="font-size:1rem;">${prs.map((p) => p.mensagem).join(" ")}</div></div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("mostrado"));
  setTimeout(() => {
    toast.classList.remove("mostrado");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function proximoOffsetToast() {
  const existentes = document.querySelectorAll(".toast-flutuante").length;
  return 108 + existentes * 64;
}
