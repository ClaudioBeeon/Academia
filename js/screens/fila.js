// js/screens/fila.js
import { getSeriesDoExercicioNaData } from "../data/historico.js";
import { descreverSemana, ordemDeCorte } from "../engine/fichaFixa.js";
import { ehSerieDeTrabalho } from "../engine/volume.js";
import { getTestesSalto, diasAteProximoTeste } from "../data/testesSalto.js";
import { animarSpring } from "../lib/spring.js";
import { criarIconeExercicio } from "./iconeExercicio.js";
import { getHabito, registrarHabito } from "../data/habitos.js";
import { animarDetails } from "../lib/detailsAnimado.js";
import { confirmarAcao } from "./confirmarAcao.js";

// Um traço por exercício do dia. Substitui o anel de 156px que ocupava um
// terço da primeira tela pra dizer exatamente a mesma coisa que a lista.
function montarBarraProgresso(concluidos, total) {
  const wrap = document.createElement("div");
  wrap.className = "fila-barra";
  const trilho = document.createElement("div");
  trilho.className = "trilho";
  for (let i = 0; i < total; i++) {
    const traco = document.createElement("i");
    if (i < concluidos) traco.className = "on";
    trilho.appendChild(traco);
  }
  const contador = document.createElement("span");
  contador.className = "n";
  contador.textContent = `${concluidos}/${total}`;
  wrap.append(trilho, contador);
  return wrap;
}

const ICONE_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

// Linha compacta no topo — o aquecimento acontece uma vez, antes de tudo, e
// não precisa do tamanho de um bloco principal pelo resto da sessão. Abre
// num toque com os movimentos e seus checks.
function montarChecklistAquecimento(db, hoje, aquecimento, habito) {
  const total = aquecimento?.exercicios?.length ?? 0;
  const movimentosFeitos = new Set(habito.aquecimentoMovimentos ?? []);

  const card = document.createElement("details");
  card.className = "fila-aquecimento";

  const resumo = document.createElement("summary");
  resumo.innerHTML = `
    <span class="ic">${ICONE_CHECK}</span>
    <span class="t"><b></b><s></s></span>
    <span class="c"></span>
  `;
  resumo.querySelector("b").textContent = aquecimento?.nome ?? "Aquecimento";
  resumo.querySelector("s").textContent = aquecimento
    ? `${aquecimento.duracaoMin} min · antes de tudo`
    : "1-2 séries leves antes do primeiro composto";
  card.appendChild(resumo);

  const contador = resumo.querySelector(".c");
  const atualizarProgresso = () => {
    if (total === 0) { contador.textContent = ""; return; }
    contador.textContent = `${movimentosFeitos.size}/${total}`;
    card.classList.toggle("feito", movimentosFeitos.size === total);
  };
  atualizarProgresso();

  if (total === 0) return card;

  const corpo = document.createElement("div");
  corpo.className = "fila-aquecimento-corpo";
  card.appendChild(corpo);
  animarDetails(card, corpo);

  // Cada movimento é uma caixa fechada por padrão (nome + prescrição) — o
  // texto de execução só aparece se o usuário tocar pra abrir. O "porque"
  // do aquecimento inteiro (parágrafo sobre postura) não entra mais aqui:
  // é contexto de programa, não algo que se lê no meio do treino.
  aquecimento.exercicios.forEach((item, indice) => {
    const li = document.createElement("details");
    li.className = "fila-aquec-item";
    li.innerHTML = `
      <summary>
        <button type="button" class="bloco-apoio-check" aria-label="Marcar ${item.nome} como feito"></button>
        <div class="mid"><span class="nm"></span><span class="presc"></span></div>
      </summary>
      <p></p>
    `;
    li.querySelector(".nm").textContent = item.nome;
    li.querySelector(".presc").textContent = item.prescricao;
    li.querySelector("p").textContent = item.como;

    const botaoCheck = li.querySelector(".bloco-apoio-check");
    const aplicarEstado = () => {
      const feito = movimentosFeitos.has(indice);
      botaoCheck.innerHTML = feito ? ICONE_CHECK : "";
      botaoCheck.classList.toggle("feito", feito);
      li.classList.toggle("feito", feito);
    };
    aplicarEstado();

    botaoCheck.addEventListener("click", async (event) => {
      // Sem isto, o clique no check também dispara o toggle nativo do
      // <details> — o box abriria/fecharia toda vez que se marca feito.
      event.preventDefault();
      event.stopPropagation();

      if (movimentosFeitos.has(indice)) movimentosFeitos.delete(indice);
      else movimentosFeitos.add(indice);
      aplicarEstado();
      atualizarProgresso();
      habito.aquecimentoMovimentos = [...movimentosFeitos];
      habito.aquecimentoFeito = movimentosFeitos.size === total;
      await registrarHabito(db, hoje, {
        aquecimentoMovimentos: habito.aquecimentoMovimentos,
        aquecimentoFeito: habito.aquecimentoFeito,
      });
    });

    animarDetails(li, li.querySelector("p"));
    corpo.appendChild(li);
  });

  return card;
}

// Botão "Marcar feito" no cabeçalho do card — mesma ideia do check por
// movimento do aquecimento, só que num item único. Sem isso não existia
// nenhum jeito de registrar que o alongamento/cardio final aconteceu, e
// "Finalizar sessão" fechava o dia como concluído sem checar nada disso.
function montarBotaoFeito(habito, campo, db, hoje) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "fila-status bloco-apoio-progresso bloco-apoio-progresso-btn";
  const aplicar = (feito) => {
    botao.textContent = feito ? "✓ Feito" : "Marcar feito";
    botao.classList.toggle("feito", feito);
    botao.setAttribute("aria-pressed", String(feito));
  };
  aplicar(habito[campo] === true);
  botao.addEventListener("click", async () => {
    const novoEstado = botao.getAttribute("aria-pressed") !== "true";
    aplicar(novoEstado);
    habito[campo] = novoEstado;
    await registrarHabito(db, hoje, { [campo]: novoEstado });
  });
  return botao;
}

function montarBlocoAlongamento(db, hoje, alongamento, habito) {
  if (!alongamento) return null;
  const card = document.createElement("section");
  card.className = "exercise-card bloco-apoio";

  const head = document.createElement("div");
  head.className = "bloco-apoio-head sem-check";
  head.innerHTML = `<div><div class="bloco-apoio-titulo"></div><div class="bloco-apoio-sub"></div></div>`;
  head.querySelector(".bloco-apoio-titulo").textContent = alongamento.nome;
  head.querySelector(".bloco-apoio-sub").textContent = alongamento.quando;
  head.appendChild(montarBotaoFeito(habito, "alongamentoFinalFeito", db, hoje));
  card.appendChild(head);

  const det = document.createElement("details");
  det.className = "bloco-apoio-lista";
  const sum = document.createElement("summary");
  sum.textContent = `Ver os ${alongamento.exercicios.length} alongamentos`;
  det.appendChild(sum);

  const corpo = document.createElement("div");
  corpo.className = "bloco-apoio-lista-corpo";
  det.appendChild(corpo);
  animarDetails(det, corpo);

  if (alongamento.porque) {
    const porque = document.createElement("p");
    porque.className = "bloco-apoio-porque";
    porque.textContent = alongamento.porque;
    corpo.appendChild(porque);
  }

  for (const item of alongamento.exercicios) {
    const li = document.createElement("div");
    li.className = "bloco-apoio-item";
    const nome = document.createElement("h5");
    nome.textContent = item.nome;
    const presc = document.createElement("span");
    presc.className = "bloco-apoio-presc";
    presc.textContent = item.prescricao;
    const como = document.createElement("p");
    como.textContent = item.como;
    li.append(nome, presc, como);
    corpo.appendChild(li);
  }
  card.appendChild(det);
  return card;
}

const NOME_MUSCULO = {
  peito: "Peito", costas: "Costas", biceps: "Bíceps", triceps: "Tríceps",
  ombro: "Ombro (lateral)", deltoide_posterior: "Deltoide posterior",
  quadriceps: "Quadríceps", posterior_coxa: "Posterior de coxa",
  gluteo: "Glúteo", panturrilha: "Panturrilha", abdomen: "Abdômen",
  antebraco: "Antebraço", ombro_anterior: "Ombro (anterior)",
};

function nomeDoMusculo(chave) {
  return NOME_MUSCULO[chave] ?? chave.replace(/_/g, " ");
}

// Séries, faixa de reps, RIR e descanso já vêm da ficha em `prescricao` —
// antes só apareciam depois de entrar no exercício, sendo o dado mais
// consultado durante a sessão.
function partesDaPrescricao(exercicio) {
  const alvo = exercicio.seriesAlvo ?? 3;
  const p = exercicio.prescricao;
  const partes = [p?.repeticoes ? `${alvo} × ${p.repeticoes.min}-${p.repeticoes.max}` : `${alvo} séries`];
  if (p?.rirAlvo != null) partes.push(`RIR ${p.rirAlvo}`);
  if (p?.descansoSegundos) partes.push(`${p.descansoSegundos}s`);
  if (p?.opcional) partes.push("opcional");
  if (exercicio.extraDoDia) partes.push("extra de hoje");
  if (exercicio.supersetCom) partes.push(`superset c/ ${exercicio.supersetCom.nome}`);
  return partes;
}

function montarBlocoAgora(exercicio, indice, seriesFeitas, aoComecar) {
  const alvo = exercicio.seriesAlvo ?? 3;
  const bloco = document.createElement("section");
  bloco.className = "fila-agora";
  bloco.innerHTML = `
    <div class="topo">
      <div class="corpo">
        <div class="up"></div>
        <h2></h2>
      </div>
    </div>
    <div class="chips"></div>
    <button type="button"></button>
  `;
  bloco.querySelector(".topo").prepend(criarIconeExercicio(exercicio.id, 62, exercicio.imagemUrl));
  bloco.querySelector(".up").textContent = `Exercício ${indice + 1} · ${nomeDoMusculo(exercicio.musculoPrimario)}`;
  bloco.querySelector("h2").textContent = exercicio.nome;

  const chips = bloco.querySelector(".chips");
  for (const parte of partesDaPrescricao(exercicio)) {
    const chip = document.createElement("span");
    chip.textContent = parte;
    chips.appendChild(chip);
  }

  const botao = bloco.querySelector("button");
  botao.textContent = seriesFeitas > 0
    ? `Continuar — série ${Math.min(alvo, seriesFeitas + 1)} de ${alvo}`
    : "Começar série 1";
  botao.addEventListener("click", aoComecar);
  return bloco;
}

// O número é a posição do exercício na ficha, não na lista: como os feitos
// descem pro fim, é ele que preserva a ordem original do treino.
function montarLinhaExercicio(exercicio, indice, seriesFeitas, feito, aoAbrir) {
  const alvo = exercicio.seriesAlvo ?? 3;
  const linha = document.createElement("section");
  linha.className = feito ? "fila-linha feito" : "fila-linha";
  linha.innerHTML = `
    <div class="mid"><div class="nm"></div><div class="pr"></div></div>
    <div class="num"></div>
  `;
  linha.prepend(criarIconeExercicio(exercicio.id, 46, exercicio.imagemUrl));
  linha.querySelector(".nm").textContent = exercicio.nome;
  linha.querySelector(".pr").textContent = !feito && seriesFeitas > 0
    ? `${seriesFeitas}/${alvo} séries feitas`
    : partesDaPrescricao(exercicio).join(" · ");
  linha.querySelector(".num").textContent = String(indice + 1);
  linha.addEventListener("click", aoAbrir);
  return linha;
}

// Folha com o catálogo inteiro, agrupado por músculo, pra acrescentar um
// exercício só hoje. Mesmo esqueleto das outras folhas.
function escolherExercicioExtra(exercicios) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet substituir-sheet">
        <div class="carga-sheet-handle"></div>
        <h3>Exercício extra (só hoje)</h3>
        <p class="substituir-nota">Entra no fim da fila, com 3 séries e a faixa padrão do tipo de exercício. A ficha não muda.</p>
        <div class="substituir-lista"></div>
        <div class="carga-sheet-acoes"><button type="button" class="carga-sheet-cancelar">Cancelar</button></div>
      </div>
    `;
    const lista = overlay.querySelector(".substituir-lista");
    const porMusculo = new Map();
    for (const e of exercicios) {
      if (!porMusculo.has(e.musculoPrimario)) porMusculo.set(e.musculoPrimario, []);
      porMusculo.get(e.musculoPrimario).push(e);
    }
    const musculos = [...porMusculo.keys()].sort((a, b) => nomeDoMusculo(a).localeCompare(nomeDoMusculo(b)));
    for (const musculo of musculos) {
      const rotulo = document.createElement("div");
      rotulo.className = "fila-sec";
      rotulo.textContent = nomeDoMusculo(musculo);
      lista.appendChild(rotulo);
      for (const exercicio of porMusculo.get(musculo).sort((a, b) => a.nome.localeCompare(b.nome))) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "substituir-item";
        botao.innerHTML = `<span class="nm"></span>`;
        botao.querySelector(".nm").textContent = exercicio.nome;
        botao.addEventListener("click", () => fechar(exercicio));
        lista.appendChild(botao);
      }
    }
    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 420 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));
    let fechada = false;
    function fechar(resultado) {
      if (fechada) return;
      fechada = true;
      overlay.classList.remove("aberta");
      const altura = sheetEl.getBoundingClientRect().height || 420;
      animarSpring(sheetEl, { y: 0 }, { y: altura }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => overlay.remove());
      resolve(resultado);
    }
    overlay.querySelector(".carga-sheet-cancelar").addEventListener("click", () => fechar(null));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
  });
}

function montarRotuloSecao(texto) {
  const rotulo = document.createElement("div");
  rotulo.className = "fila-sec";
  rotulo.textContent = texto;
  return rotulo;
}

export async function montarTelaFila(db, contexto, callbacks) {
  const { diaInfo, exerciciosHoje, hoje, diaDaFicha = null, ficha = null, semanaDoBloco = 1, inicioSessaoTs = null, musculosTreinadosHaPouco = [], todosExercicios = [] } = contexto;
  const { onExecutar, onFinalizarSessao, onVoltar, onPular, onReiniciar, onDesfazerPulo, onTreinoRapido, onAdicionarExtra } = callbacks;

  // Só séries de trabalho fecham um exercício (aquecimento e mini-séries de
  // drop-set/rest-pause não contam).
  const seriesPorExercicio = (await Promise.all(
    exerciciosHoje.map((e) => getSeriesDoExercicioNaData(db, e.id, hoje))
  )).map((series) => series.filter(ehSerieDeTrabalho));
  const habitoHoje = (await getHabito(db, hoje)) ?? {};

  let totalSeriesFeitas = 0;
  let exerciciosConcluidos = 0;
  const estados = seriesPorExercicio.map((series, indice) => {
    // "Não vou fazer hoje" conta como resolvido: sai dos pendentes e não
    // trava o próximo exercício nem a barra de progresso.
    if (exerciciosHoje[indice].puladoHoje) {
      exerciciosConcluidos++;
      return "pulado";
    }
    const seriesAlvo = exerciciosHoje[indice].seriesAlvo ?? 3;
    totalSeriesFeitas += series.length;
    if (series.length >= seriesAlvo) {
      exerciciosConcluidos++;
      return "concluido";
    }
    return series.length > 0 ? "andamento" : "pendente";
  });

  const root = document.createElement("div");
  root.className = "tela-fila";

  // A semana do mesociclo cabe numa linha de sobrescrito — antes era um
  // parágrafo de cinco linhas entre o progresso e o primeiro exercício.
  const semanas = ficha?.mesociclo?.semanas;
  const infoSemana = semanas?.find((s) => s.semana === semanaDoBloco);
  const contexto1 = [`Dia ${diaInfo.numero}`];
  if (infoSemana && semanas) contexto1.push(`Semana ${infoSemana.semana} de ${semanas.length} (${descreverSemana(semanaDoBloco)})`);

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div>
      <div class="date-label"></div>
      <div class="day-title"></div>
    </div>
  `;
  header.querySelector(".date-label").textContent = contexto1.join(" · ");
  header.querySelector(".day-title").textContent = diaInfo.titulo;
  const voltarBtn = document.createElement("button");
  voltarBtn.type = "button";
  voltarBtn.className = "icon-btn";
  voltarBtn.setAttribute("aria-label", "Fechar");
  voltarBtn.textContent = "✕";
  voltarBtn.addEventListener("click", () => { if (onVoltar) onVoltar(); });
  header.appendChild(voltarBtn);
  root.appendChild(header);

  // Cronômetro da sessão inteira — começa quando "Começar treino" é tocado
  // na Início e conta até o relatório final, atravessando cardio e tudo.
  // Não existe no modo preview (abrir o card de um dia futuro só pra olhar).
  // Fica dentro do bloco do título (não do header inteiro) pra não quebrar
  // o space-between de duas colunas que o header já usa com o botão fechar.
  let intervalSessao = null;
  if (inicioSessaoTs != null) {
    const cronoEl = document.createElement("div");
    cronoEl.className = "fila-cronometro-sessao";
    cronoEl.innerHTML = `<span class="rot">Sessão</span><span class="t">00:00</span>`;
    header.firstElementChild.appendChild(cronoEl);
    const tEl = cronoEl.querySelector(".t");

    const atualizar = () => {
      const segundos = Math.max(0, Math.floor((Date.now() - inicioSessaoTs) / 1000));
      const min = String(Math.floor(segundos / 60)).padStart(2, "0");
      const seg = String(segundos % 60).padStart(2, "0");
      tEl.textContent = `${min}:${seg}`;
    };
    atualizar();
    intervalSessao = setInterval(atualizar, 1000);

    // setInterval atrasa/pausa com o app em segundo plano — como o relógio
    // é derivado de Date.now() a cada tick (não acumula), só precisa forçar
    // uma atualização na volta pro primeiro plano pra não parecer travado.
    const aoVoltarAoPrimeiroPlano = () => { if (document.visibilityState !== "hidden") atualizar(); };
    document.addEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
    window.addEventListener("focus", aoVoltarAoPrimeiroPlano);
    root._dispose = () => {
      clearInterval(intervalSessao);
      document.removeEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
      window.removeEventListener("focus", aoVoltarAoPrimeiroPlano);
    };
  }

  const main = document.createElement("main");
  root.appendChild(main);

  main.appendChild(montarBarraProgresso(exerciciosConcluidos, exerciciosHoje.length));

  // Dia de Pernas + Impulsão: lembra do teste de salto a cada 3 semanas.
  if (diaDaFicha?.regrasImpulsao) {
    const faltam = diasAteProximoTeste(await getTestesSalto(db), hoje);
    if (faltam === 0) {
      const avisoTeste = document.createElement("p");
      avisoTeste.className = "prev-hint";
      avisoTeste.textContent = "Hoje é dia de teste de salto: depois do aquecimento, 3 saltos no app My Jump (mãos na cintura, 1 min de pausa) e registre o melhor em Evolução → Salto vertical.";
      main.appendChild(avisoTeste);
    }
  }

  if (musculosTreinadosHaPouco.length > 0) {
    const aviso = document.createElement("p");
    aviso.className = "prev-hint fila-aviso-recuperacao";
    const nomes = musculosTreinadosHaPouco.map((m) => `${nomeDoMusculo(m.musculo).toLowerCase()} (${m.series} séries)`).join(", ");
    aviso.textContent = `Treinado há menos de ~36 h: ${nomes}. Dá pra treinar — o desempenho só pode vir um pouco abaixo. Se puder escolher, descanse um dia antes deste treino.`;
    main.appendChild(aviso);
  }

  // Se faltar tempo: a ordem de corte vem da ficha (opcionais primeiro) e
  // nunca inclui peito ou bíceps — substitui o antigo "de baixo pra cima",
  // que cortava justamente o bíceps no fim do dia 2.
  const corte = ordemDeCorte(exerciciosHoje);
  if (corte.length > 0) {
    const notaCorte = document.createElement("p");
    notaCorte.className = "prev-hint fila-ordem-corte";
    notaCorte.textContent = `Pouco tempo? Corte nesta ordem: ${corte.map((e) => e.nome).join(" → ")}. Peito e bíceps ficam sempre.`;
    main.appendChild(notaCorte);
  }

  // "Treino rápido": pula de uma vez os opcionais e os 2 primeiros da ordem
  // de corte que ainda não foram começados. Cada um pode ser desfeito na
  // seção "Pulados hoje".
  const ainda = (e) => !e.puladoHoje && (seriesPorExercicio[exerciciosHoje.indexOf(e)]?.length ?? 0) === 0;
  const opcionais = corte.filter((e) => e.prescricao?.opcional && ainda(e));
  const obrigatoriosCortaveis = corte.filter((e) => !e.prescricao?.opcional && ainda(e)).slice(0, 2);
  const paraTreinoRapido = [...opcionais, ...obrigatoriosCortaveis];
  const barraAcoes = document.createElement("div");
  barraAcoes.className = "fila-acoes";
  if (onTreinoRapido && paraTreinoRapido.length > 0) {
    const rapidoBtn = document.createElement("button");
    rapidoBtn.type = "button";
    rapidoBtn.className = "swap-pill";
    rapidoBtn.textContent = "Treino rápido";
    rapidoBtn.addEventListener("click", async () => {
      const confirmou = await confirmarAcao({
        titulo: "Fazer o treino rápido?",
        mensagem: `Sai da lista de hoje: ${paraTreinoRapido.map((e) => e.nome).join(", ")}. Peito e bíceps ficam. Dá pra desfazer cada um em "Pulados hoje".`,
        textoConfirmar: "Treino rápido",
      });
      if (confirmou) await onTreinoRapido(paraTreinoRapido.map((e) => e.id));
    });
    barraAcoes.appendChild(rapidoBtn);
  }
  if (onAdicionarExtra && todosExercicios.length > 0) {
    const extraBtn = document.createElement("button");
    extraBtn.type = "button";
    extraBtn.className = "swap-pill";
    extraBtn.textContent = "+ Exercício extra";
    extraBtn.addEventListener("click", async () => {
      const idsHoje = new Set(exerciciosHoje.map((e) => e.id));
      const escolhido = await escolherExercicioExtra(todosExercicios.filter((e) => !idsHoje.has(e.id)));
      if (escolhido) await onAdicionarExtra(escolhido.id);
    });
    barraAcoes.appendChild(extraBtn);
  }
  if (barraAcoes.childElementCount > 0) main.appendChild(barraAcoes);

  const aquecimentoTemMovimentos = (ficha?.aquecimento?.exercicios?.length ?? 0) > 0;
  main.appendChild(montarChecklistAquecimento(db, hoje, ficha?.aquecimento, habitoHoje));

  // O exercício da vez é o primeiro que ainda não fechou as séries previstas.
  // A partição é por estado, não por posição: quem foi concluído desce pro
  // fim mesmo que o usuário tenha pulado a ordem da ficha.
  const indiceAtual = estados.findIndex((e) => e !== "concluido" && e !== "pulado");
  const abrir = (indice) => () => { if (onExecutar) onExecutar(indice); };

  if (indiceAtual !== -1) {
    main.appendChild(montarRotuloSecao("Agora"));
    main.appendChild(montarBlocoAgora(
      exerciciosHoje[indiceAtual], indiceAtual,
      seriesPorExercicio[indiceAtual].length, abrir(indiceAtual)
    ));
  }

  const adiantar = [];
  const concluidos = [];
  const pulados = [];
  exerciciosHoje.forEach((exercicio, indice) => {
    if (indice === indiceAtual) return;
    if (estados[indice] === "pulado") pulados.push({ exercicio, indice });
    else (estados[indice] === "concluido" ? concluidos : adiantar).push({ exercicio, indice });
  });

  if (adiantar.length > 0) {
    main.appendChild(montarRotuloSecao("A seguir"));
    for (const { exercicio, indice } of adiantar) {
      main.appendChild(montarLinhaExercicio(
        exercicio, indice, seriesPorExercicio[indice].length, false, abrir(indice)
      ));
    }
  }

  if (concluidos.length > 0) {
    main.appendChild(montarRotuloSecao("Feitos"));
    for (const { exercicio, indice } of concluidos) {
      main.appendChild(montarLinhaExercicio(
        exercicio, indice, seriesPorExercicio[indice].length, true, abrir(indice)
      ));
    }
  }

  if (pulados.length > 0) {
    main.appendChild(montarRotuloSecao("Pulados hoje"));
    for (const { exercicio, indice } of pulados) {
      const linha = montarLinhaExercicio(exercicio, indice, 0, true, async () => {
        if (!onDesfazerPulo) return;
        const confirmou = await confirmarAcao({
          titulo: "Voltar com este exercício?",
          mensagem: `${exercicio.nome} volta pra lista de hoje.`,
          textoConfirmar: "Voltar pra lista",
        });
        if (confirmou) await onDesfazerPulo(exercicio.id);
      });
      linha.classList.add("pulado");
      linha.querySelector(".pr").textContent = "Não vai fazer hoje — toque pra desfazer";
      main.appendChild(linha);
    }
  }

  // Alongamento vem DEPOIS dos exercícios — frente do corpo por último,
  // quando o peitoral já está quente. Cardio não entra mais na fila: é a
  // tela Início que mostra e registra o cardio prescrito do dia.
  const chaveAlongamento = diaDaFicha?.alongamentoFinal;
  const alongamentoDoDia = chaveAlongamento ? ficha?.alongamentos?.[chaveAlongamento] : null;
  const blocoAlongamento = alongamentoDoDia
    ? montarBlocoAlongamento(db, hoje, alongamentoDoDia, habitoHoje)
    : null;
  if (blocoAlongamento) main.appendChild(blocoAlongamento);

  // "Finalizar sessão" fechava o dia inteiro como concluído mesmo quando o
  // aquecimento ou o alongamento final da ficha ainda não tinham sido
  // marcados — são partes prescritas da sessão, não um detalhe opcional que
  // a musculação sozinha substitui.
  function itensPendentesDaSessao() {
    const pendentes = [];
    if (aquecimentoTemMovimentos && habitoHoje.aquecimentoFeito !== true) pendentes.push("o aquecimento");
    if (alongamentoDoDia && habitoHoje.alongamentoFinalFeito !== true) pendentes.push("o alongamento final");
    return pendentes;
  }

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px; text-align:center;";
  rodape.innerHTML = `<button type="button" class="swap-pill finalizar-btn" style="width:100%; background:var(--accent); color:var(--accent-ink);">Finalizar sessão</button>`;
  rodape.querySelector(".finalizar-btn").addEventListener("click", async () => {
    const pendentes = itensPendentesDaSessao();
    if (pendentes.length > 0) {
      const lista = pendentes.length === 1
        ? pendentes[0]
        : `${pendentes.slice(0, -1).join(", ")} e ${pendentes.at(-1)}`;
      const confirmou = await confirmarAcao({
        titulo: "Finalizar mesmo assim?",
        mensagem: `Você ainda não marcou ${lista} de hoje.`,
        textoConfirmar: "Finalizar sessão",
      });
      if (!confirmou) return;
    }
    if (onFinalizarSessao) onFinalizarSessao();
  });

  if (onPular) {
    const pularBtn = document.createElement("button");
    pularBtn.type = "button";
    pularBtn.className = "pular-treino-btn";
    pularBtn.style.margin = "12px auto 0";
    pularBtn.textContent = "Já treinei — pular →";
    pularBtn.addEventListener("click", () => onPular());
    rodape.appendChild(pularBtn);
  }

  if (onReiniciar && totalSeriesFeitas > 0) {
    const reiniciarBtn = document.createElement("button");
    reiniciarBtn.type = "button";
    reiniciarBtn.className = "pular-treino-btn";
    reiniciarBtn.style.cssText = "margin:12px auto 0; display:block; color:var(--ink-faint);";
    reiniciarBtn.textContent = "Reiniciar este treino";
    reiniciarBtn.addEventListener("click", async () => {
      const confirmou = await confirmarAcao({
        titulo: "Reiniciar este treino?",
        mensagem: "Apaga todas as séries de hoje deste treino e começa do zero.",
        textoConfirmar: "Apagar e reiniciar",
        destrutivo: true,
      });
      if (confirmou) onReiniciar();
    });
    rodape.appendChild(reiniciarBtn);
  }

  root.appendChild(rodape);

  return root;
}
