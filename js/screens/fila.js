// js/screens/fila.js
import { getSeriesDoExercicioNaData } from "../data/historico.js";
import { criarIconeExercicio } from "./iconeExercicio.js";
import { getHabito, registrarHabito } from "../data/habitos.js";

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

  if (alongamento.porque) {
    const porque = document.createElement("p");
    porque.className = "bloco-apoio-porque";
    porque.textContent = alongamento.porque;
    det.appendChild(porque);
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
    det.appendChild(li);
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

function montarRotuloSecao(texto) {
  const rotulo = document.createElement("div");
  rotulo.className = "fila-sec";
  rotulo.textContent = texto;
  return rotulo;
}

export async function montarTelaFila(db, contexto, callbacks) {
  const { diaInfo, exerciciosHoje, hoje, diaDaFicha = null, ficha = null, semanaDoBloco = 1, inicioSessaoTs = null } = contexto;
  const { onExecutar, onFinalizarSessao, onVoltar, onPular, onReiniciar } = callbacks;

  const seriesPorExercicio = await Promise.all(
    exerciciosHoje.map((e) => getSeriesDoExercicioNaData(db, e.id, hoje))
  );
  const habitoHoje = (await getHabito(db, hoje)) ?? {};

  let totalSeriesFeitas = 0;
  let exerciciosConcluidos = 0;
  const estados = seriesPorExercicio.map((series, indice) => {
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
  if (infoSemana && semanas) contexto1.push(`Semana ${infoSemana.semana} de ${semanas.length}`);

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

  const aquecimentoTemMovimentos = (ficha?.aquecimento?.exercicios?.length ?? 0) > 0;
  main.appendChild(montarChecklistAquecimento(db, hoje, ficha?.aquecimento, habitoHoje));

  // O exercício da vez é o primeiro que ainda não fechou as séries previstas.
  // A partição é por estado, não por posição: quem foi concluído desce pro
  // fim mesmo que o usuário tenha pulado a ordem da ficha.
  const indiceAtual = estados.findIndex((e) => e !== "concluido");
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
  exerciciosHoje.forEach((exercicio, indice) => {
    if (indice === indiceAtual) return;
    (estados[indice] === "concluido" ? concluidos : adiantar).push({ exercicio, indice });
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
  rodape.querySelector(".finalizar-btn").addEventListener("click", () => {
    const pendentes = itensPendentesDaSessao();
    if (pendentes.length > 0) {
      const lista = pendentes.length === 1
        ? pendentes[0]
        : `${pendentes.slice(0, -1).join(", ")} e ${pendentes.at(-1)}`;
      const confirmou = confirm(`Você ainda não marcou ${lista} de hoje. Finalizar a sessão mesmo assim?`);
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
    reiniciarBtn.addEventListener("click", () => {
      if (confirm("Apagar todas as séries de hoje deste treino e começar do zero?")) {
        onReiniciar();
      }
    });
    rodape.appendChild(reiniciarBtn);
  }

  root.appendChild(rodape);

  return root;
}
