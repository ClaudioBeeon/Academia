// js/screens/execucao.js
import { registrarSerie, getSeriesDoExercicioNaData, getUltimaSerieAnterior, getAmostrasRecentesDoExercicio, getHistoricoCompletoDoExercicio, getSeriesDaUltimaSessaoAnterior } from "../data/historico.js";
import { sugerirSubstitutos } from "../engine/substituicao.js";
import { sugerirCarga } from "../engine/cargas.js";
import { avaliarProgressao } from "../engine/progressao.js";
import { calcularAnilhas } from "../engine/anilhas.js";
import { gerarEscadaAquecimento } from "../engine/aquecimento.js";
import { detectarPRs } from "../engine/recordes.js";
import { criarCronometro } from "./timer.js";

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

export async function montarTelaExecucao(db, contexto, callbacks) {
  const { exercicio, indice, total, todosExercicios, protocolo, equipamento, hoje, mostrarExplicacaoAberta } = contexto;
  const { onFechar, onProximoExercicio, onAbrirHistorico, onSerieRegistrada, onPrsDetectados } = callbacks;

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
  const trocarBtn = document.createElement("button");
  trocarBtn.type = "button";
  trocarBtn.className = "swap-pill trocar-pill";
  trocarBtn.textContent = "Trocar";
  header.appendChild(trocarBtn);
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
    painelFerramentas.className = "sets";
    painelFerramentas.style.display = "none";
    painelFerramentas.style.padding = "0 0 12px";
    main.appendChild(painelFerramentas);

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

  // Linha do tempo: uma marca por série-alvo, com o resultado embaixo assim
  // que a série é registrada — substitui a antiga lista vertical + os dois
  // tiles do topo, que repetiam o mesmo número de carga de três jeitos.
  const linhaTempoEl = document.createElement("div");
  linhaTempoEl.className = "exec-linha-tempo";
  linhaTempoEl.style.setProperty("--exec-series", totalSeriesAlvo);
  linhaTempoEl.innerHTML = `<div class="exec-lt-barra"><i></i></div><div class="exec-lt-marcas"></div>`;
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

  const cronoTrabalhoEl = document.createElement("div");
  cronoTrabalhoEl.className = "exec-crono-trabalho";
  cronoTrabalhoEl.innerHTML = `<div class="t">00:00</div><div class="l">A tela fica acesa até você terminar</div>`;
  cronoTrabalhoEl.style.display = "none";
  main.appendChild(cronoTrabalhoEl);

  const progressaoHint = document.createElement("div");
  progressaoHint.className = "prev-hint";
  progressaoHint.style.cssText = "padding:16px 0 0; display:none;";
  main.appendChild(progressaoHint);

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
    for (const [titulo, texto] of blocos) {
      const h = document.createElement("h5");
      h.textContent = titulo;
      const p = document.createElement("p");
      p.textContent = texto;
      explicacao.append(h, p);
    }
    main.appendChild(explicacao);
  }

  // Descanso: barra fixa presa acima do rodapé (não rola com o resto da
  // tela — era o motivo de o relógio sumir de vista com 5 séries acima
  // dele), com controle de tempo e saída explícita.
  const descansoEl = document.createElement("div");
  descansoEl.className = "exec-descanso exec-descanso-oculto";
  descansoEl.innerHTML = `
    <div class="txt">Descanso</div>
    <div class="rel">00:00</div>
    <div class="ctl">
      <button type="button" data-action="menos" aria-label="Menos 30 segundos">−30</button>
      <button type="button" data-action="mais" aria-label="Mais 30 segundos">+30</button>
    </div>
  `;
  root.appendChild(descansoEl);

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
    for (let numero = 1; numero <= totalSeriesAlvo; numero++) {
      if (!seriesHoje.find((s) => s.serieNumero === numero)) return numero;
    }
    return null;
  }

  function renderizarLinhaTempo() {
    const pendente = numeroPendenteAtual();
    const feitas = seriesHoje.length;
    const fracao = totalSeriesAlvo > 0 ? Math.min(1, feitas / totalSeriesAlvo) : 0;
    linhaTempoEl.querySelector(".exec-lt-barra i").style.width = `${(fracao * 100).toFixed(0)}%`;

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
        marca.innerHTML = `<div class="kg">agora</div><div class="rir">série ${numero}</div>`;
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
      notaEl.style.display = "";
      notaEl.textContent = "Ajuste reps e RIR enquanto respira — o botão de terminar grava o que estiver na tela.";
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
    atualizarProgressao();
    renderizarFooter();
  }

  const AJUSTES = {
    carga: (delta) => { cargaSelecionada = Math.max(incrementoCarga, cargaSelecionada + delta * incrementoCarga); },
    reps: (delta) => { repsAtual = Math.max(0, repsAtual + delta); },
    rir: (delta) => { rirAtual = Math.max(0, rirAtual + delta); },
  };

  controleEl.querySelector(".menos").addEventListener("click", () => { AJUSTES[campoAtivo](-1); renderizarTrioEControle(); });
  controleEl.querySelector(".mais").addEventListener("click", () => { AJUSTES[campoAtivo](1); renderizarTrioEControle(); });

  trioEl.querySelectorAll(".exec-campo").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      campoAtivo = btn.dataset.campo;
      renderizarTrioEControle();
    });
  });

  function pararTrabalho() {
    if (intervalTrabalho) {
      clearInterval(intervalTrabalho);
      intervalTrabalho = null;
    }
    inicioTrabalhoTs = null;
  }

  function pararDescanso() {
    if (cronometroAtivo) {
      cronometroAtivo.parar();
      cronometroAtivo = null;
    }
    descansoEl.classList.add("exec-descanso-oculto");
  }

  function pararTudo() {
    pararDescanso();
    pararTrabalho();
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
    cronoTrabalhoEl.querySelector(".t").textContent = `${min}:${seg}`;
  }

  function iniciarTrabalho(numero) {
    // Começar uma nova série tem que encerrar o descanso de verdade — antes
    // disso o relógio de descanso continuava contando por baixo mesmo depois
    // de "Comecei a série" ser tocado, porque só o timer de trabalho era
    // iniciado e o de descanso nunca era parado.
    pararDescanso();

    numeroEmAndamento = numero;
    const iniciais = valoresIniciaisParaSerie(numero);
    repsAtual = iniciais.reps;
    rirAtual = iniciais.rir;
    campoAtivo = "reps";

    inicioTrabalhoTs = Date.now();
    cronoTrabalhoEl.style.display = "";
    atualizarCronoTrabalho();
    intervalTrabalho = setInterval(atualizarCronoTrabalho, 1000);

    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((lock) => { wakeLockAtivo = lock; }).catch(() => {});
    }

    renderizarTudo();
  }

  async function finalizarTrabalhoERegistrar() {
    const numero = numeroEmAndamento;
    pararTrabalho();
    cronoTrabalhoEl.style.display = "none";
    numeroEmAndamento = null;
    campoAtivo = "carga";
    await registrarSerieAtual(numero);
  }

  function iniciarDescanso(descansoSegundos) {
    pararDescanso();
    descansoEl.classList.remove("exec-descanso-oculto");
    const relEl = descansoEl.querySelector(".rel");

    const cronometro = criarCronometro({
      duracaoInicialSegundos: descansoSegundos,
      aoAtualizar: (restante) => {
        const min = String(Math.floor(restante / 60)).padStart(2, "0");
        const seg = String(restante % 60).padStart(2, "0");
        relEl.textContent = `${min}:${seg}`;
      },
      aoFinalizar: () => {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        descansoEl.classList.add("exec-descanso-oculto");
      },
    });

    cronometroAtivo = cronometro;

    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((lock) => { wakeLockAtivo = lock; }).catch(() => {});
    }

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
  }
  document.addEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
  window.addEventListener("focus", aoVoltarAoPrimeiroPlano);
  window.addEventListener("online", aoVoltarAoPrimeiroPlano);

  descansoEl.querySelector('[data-action="menos"]').addEventListener("click", () => cronometroAtivo && cronometroAtivo.ajustar(-30));
  descansoEl.querySelector('[data-action="mais"]').addEventListener("click", () => cronometroAtivo && cronometroAtivo.ajustar(30));

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

  trocarBtn.addEventListener("click", () => {
    const sugestoes = sugerirSubstitutos(exercicio.id, todosExercicios);
    const nomes = sugestoes.map((e) => e.nome).join(", ") || "nenhuma alternativa encontrada";
    alert(`Alternativas: ${nomes}`);
  });

  const rodape = document.createElement("div");
  rodape.className = "exec-footer";
  rodape.innerHTML = `
    <button type="button" class="exec-footer-sq historico-btn" aria-label="Histórico">${ICONE_RELOGIO}</button>
    <button type="button" class="exec-footer-primary primario-btn"></button>
  `;
  rodape.querySelector(".historico-btn").addEventListener("click", () => {
    if (onAbrirHistorico) onAbrirHistorico(exercicio);
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
