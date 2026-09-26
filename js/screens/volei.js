// js/screens/volei.js
//
// Treino de levantamento em casa (toque e direção). Mostra a sessão da
// semana do programa (js/data/programaVolei.js), com contador de acertos
// por exercício, sorteio do alvo, testes com pontuação e a evolução do
// teste T1 em gráfico. Salva enquanto a pessoa usa (sem botão obrigatório)
// — "Concluir sessão" só grava a duração e volta.
import { getSessaoVolei, salvarSessaoVolei, getSessoesVolei, getInicioVolei, definirInicioVolei } from "../data/volei.js";
import { EXERCICIOS_VOLEI, TESTES_VOLEI, SEMANAS_VOLEI, PRINCIPIOS_VOLEI, MONTAGEM_VOLEI } from "../data/programaVolei.js";
import { GUIA_TOQUE_VOLEI } from "../data/guiaToqueVolei.js";
import { calcularSemanaVolei, sortearAlvo, taxaDeAcerto, serieDoTeste } from "../engine/volei.js";
import { criarSvgLinha } from "../lib/graficoLinha.js";
import { confirmarAcao } from "./confirmarAcao.js";
import { ativarAutoResize } from "../lib/autoResizeTextarea.js";

function obterDataLocal() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function criarContador(rotulo, valorInicial, { minimo = 0, maximo = Infinity, passo = 1 } = {}, aoMudar) {
  let valor = valorInicial;
  const linha = document.createElement("div");
  linha.className = "rs-linha volei-contador";
  linha.innerHTML = `<span class="rs-rot"></span><div class="rs-ctl"><button type="button" class="rs-menos">−</button><b class="rs-reps" aria-live="polite"></b><button type="button" class="rs-mais">+</button></div>`;
  linha.querySelector(".rs-rot").textContent = rotulo;
  linha.querySelector(".rs-menos").setAttribute("aria-label", `Diminuir ${rotulo.toLowerCase()}`);
  linha.querySelector(".rs-mais").setAttribute("aria-label", `Aumentar ${rotulo.toLowerCase()}`);
  const valorEl = linha.querySelector(".rs-reps");
  const desenhar = () => { valorEl.textContent = String(valor); };
  desenhar();
  const ajustar = (delta) => {
    valor = Math.max(minimo, Math.min(maximo, valor + delta * passo));
    desenhar();
    aoMudar(valor);
  };
  linha.querySelector(".rs-menos").addEventListener("click", () => ajustar(-1));
  linha.querySelector(".rs-mais").addEventListener("click", () => ajustar(1));
  return linha;
}

export async function montarTelaVolei(db, { aoVoltar } = {}) {
  const hoje = obterDataLocal();
  const inicioSessaoTs = Date.now();
  const [inicio, sessaoSalva, todas] = await Promise.all([getInicioVolei(db), getSessaoVolei(db, hoje), getSessoesVolei(db)]);
  const { semana, concluido } = calcularSemanaVolei(inicio ?? hoje, hoje);
  const planoSemana = SEMANAS_VOLEI.find((s) => s.semana === semana);
  const sessao = sessaoSalva ?? { data: hoje, exercicios: {}, testes: {} };

  const root = document.createElement("div");
  root.className = "tela-volei";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <button type="button" class="icon-btn voltar-btn" aria-label="Voltar">←</button>
      <div>
        <div class="date-label"></div>
        <div class="day-title">Levantamento</div>
        <div class="fila-cronometro-sessao"><span class="rot">Sessão</span><span class="t">00:00</span></div>
      </div>
    </div>
  `;
  header.querySelector(".date-label").textContent = `Vôlei · Semana ${semana} de 6 · ${planoSemana.foco}`;
  root.appendChild(header);

  const cronoEl = header.querySelector(".fila-cronometro-sessao .t");
  const atualizarCrono = () => {
    const s = Math.floor((Date.now() - inicioSessaoTs) / 1000);
    cronoEl.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  const intervalo = setInterval(atualizarCrono, 1000);
  root._dispose = () => clearInterval(intervalo);

  header.querySelector(".voltar-btn").addEventListener("click", () => { if (aoVoltar) aoVoltar(); });

  const main = document.createElement("main");
  root.appendChild(main);

  // Salva aos poucos: cada toque num contador grava o exercício inteiro.
  async function salvarExercicio(id, dados) {
    sessao.exercicios[id] = { ...(sessao.exercicios[id] ?? {}), ...dados };
    await salvarSessaoVolei(db, hoje, { semana, exercicios: { [id]: sessao.exercicios[id] } });
  }

  const nota = document.createElement("p");
  nota.className = "prev-hint";
  nota.style.padding = "0 0 12px";
  nota.textContent = concluido
    ? `Programa de 6 semanas concluído — siga na semana 6 ou recomece lá embaixo. ${planoSemana.nota}`
    : planoSemana.nota;
  main.appendChild(nota);

  // Princípios e montagem, recolhidos — são pra consultar, não pra ler toda vez.
  const guia = document.createElement("details");
  guia.className = "exercise-card volei-guia";
  guia.innerHTML = `<summary class="exercise-head"><div class="exercise-name">O que dá precisão · montagem</div></summary><div class="volei-guia-corpo"></div>`;
  const guiaCorpo = guia.querySelector(".volei-guia-corpo");
  for (const [titulo, itens] of [["Técnica", PRINCIPIOS_VOLEI], ["Montagem em casa", MONTAGEM_VOLEI]]) {
    const h = document.createElement("h5");
    h.textContent = titulo;
    const ul = document.createElement("ul");
    for (const item of itens) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    }
    guiaCorpo.append(h, ul);
  }
  main.appendChild(guia);

  // Guia desenhado do toque: dedos, punho, corpo, giro e praia.
  const desenhos = document.createElement("details");
  desenhos.className = "exercise-card volei-guia volei-desenhos";
  desenhos.innerHTML = `<summary class="exercise-head"><div class="exercise-name">Como tocar na bola (desenhos)</div></summary><div class="volei-guia-corpo"></div>`;
  const desenhosCorpo = desenhos.querySelector(".volei-guia-corpo");
  for (const painel of GUIA_TOQUE_VOLEI) {
    const h = document.createElement("h5");
    h.textContent = painel.titulo;
    const figura = document.createElement("div");
    figura.style.margin = "6px 0 8px";
    figura.innerHTML = painel.svg;
    const ul = document.createElement("ul");
    for (const item of painel.pontos) {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    }
    desenhosCorpo.append(h, figura, ul);
  }
  main.appendChild(desenhos);

  for (const id of planoSemana.blocos) {
    const ex = EXERCICIOS_VOLEI[id];
    const salvo = sessao.exercicios[id] ?? {};
    const card = document.createElement("section");
    card.className = "exercise-card volei-exercicio";
    card.innerHTML = `
      <div class="exercise-head"><div><div class="exercise-name"></div><div class="exercise-meta"></div></div></div>
      <div class="volei-corpo">
        <p class="prev-hint volei-como"></p>
        <p class="prev-hint volei-meta"></p>
      </div>
    `;
    card.querySelector(".exercise-name").textContent = ex.nome;
    card.querySelector(".exercise-meta").textContent = ex.dose;
    card.querySelector(".volei-como").textContent = ex.como;
    const metaEl = card.querySelector(".volei-meta");
    const corpo = card.querySelector(".volei-corpo");

    if (ex.semContagem) {
      metaEl.remove();
      const feito = document.createElement("label");
      feito.className = "lembrete-treino-ativo volei-feito";
      feito.innerHTML = `<input type="checkbox" /> Feito`;
      const caixa = feito.querySelector("input");
      caixa.checked = Boolean(salvo.feito);
      caixa.addEventListener("change", () => salvarExercicio(id, { feito: caixa.checked }));
      corpo.appendChild(feito);
    } else {
      if (ex.sorteio) {
        const sorteio = document.createElement("div");
        sorteio.className = "volei-sorteio";
        sorteio.innerHTML = `<button type="button" class="swap-pill">Sortear o próximo toque</button><b aria-live="polite"></b>`;
        const resultado = sorteio.querySelector("b");
        sorteio.querySelector("button").addEventListener("click", () => {
          const alvo = sortearAlvo(semana);
          resultado.textContent = `${alvo.altura} · ${alvo.distancia} · ${alvo.tipo}`;
        });
        corpo.appendChild(sorteio);
      }

      let acertos = salvo.acertos ?? 0;
      let tentativas = salvo.tentativas ?? ex.tentativas ?? 0;
      let sequencia = salvo.sequencia ?? 0;
      const desenharMeta = () => {
        const taxa = taxaDeAcerto(acertos, tentativas);
        const partes = [`Meta: ${ex.meta}.`];
        // Exercício de sequência: o que conta é a maior sequência, não a %.
        if (ex.contaSequencia) {
          if (sequencia > 0) partes.push(`Hoje: ${sequencia} seguidos.`);
        } else if (taxa != null && acertos > 0) {
          const bateu = ex.taxaMeta != null && taxa / 100 >= ex.taxaMeta;
          partes.push(`Hoje: ${taxa}%${bateu ? " — meta batida" : ""}.`);
        }
        metaEl.textContent = partes.join(" ");
      };
      desenharMeta();

      if (ex.contaSequencia) {
        corpo.appendChild(criarContador("Maior sequência", sequencia, {}, (v) => { sequencia = v; desenharMeta(); salvarExercicio(id, { sequencia: v }); }));
      } else if (ex.tentativas > 0) {
        corpo.appendChild(criarContador("Acertos", acertos, {}, (v) => { acertos = v; desenharMeta(); salvarExercicio(id, { acertos, tentativas }); }));
        corpo.appendChild(criarContador("Tentativas", tentativas, {}, (v) => { tentativas = v; desenharMeta(); salvarExercicio(id, { acertos, tentativas }); }));
      }
    }
    main.appendChild(card);
  }

  // Testes: os da semana ficam abertos; os outros dá pra registrar se quiser.
  const cardTestes = document.createElement("details");
  cardTestes.className = "exercise-card volei-testes";
  cardTestes.open = planoSemana.testes.length > 0;
  cardTestes.innerHTML = `<summary class="exercise-head"><div><div class="exercise-name">Testes</div><div class="exercise-meta"></div></div></summary><div class="volei-corpo"></div>`;
  cardTestes.querySelector(".exercise-meta").textContent = planoSemana.testes.length > 0
    ? `Desta semana: ${planoSemana.testes.join(", ")} — mesmo aquecimento, lugar e bola de sempre`
    : "Nenhum programado nesta semana";
  const corpoTestes = cardTestes.querySelector(".volei-corpo");
  for (const [idTeste, teste] of Object.entries(TESTES_VOLEI)) {
    const bloco = document.createElement("div");
    bloco.className = "volei-teste";
    const titulo = document.createElement("b");
    titulo.textContent = `${teste.nome}${planoSemana.testes.includes(idTeste) ? " ⭐" : ""}`;
    const como = document.createElement("p");
    como.className = "prev-hint";
    como.style.padding = "0";
    como.textContent = teste.como;
    bloco.append(titulo, como);
    bloco.appendChild(criarContador(`Resultado (${teste.unidade}, máx. ${teste.maximo})`, sessao.testes[idTeste] ?? 0, { maximo: teste.maximo }, async (v) => {
      sessao.testes[idTeste] = v;
      desenharEvolucao();
      await salvarSessaoVolei(db, hoje, { semana, testes: { [idTeste]: v } });
    }));
    corpoTestes.appendChild(bloco);
  }
  main.appendChild(cardTestes);

  // Desconforto nos dedos e anotação.
  const cardFim = document.createElement("section");
  cardFim.className = "exercise-card";
  cardFim.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Como foi</div></div>
    <div class="volei-corpo">
      <label class="exec-anotacao-rot">Desconforto nos dedos (0 = nenhum, 10 = forte): <b class="volei-dedos-valor"></b>
        <input type="range" min="0" max="10" step="1" class="volei-dedos" />
      </label>
      <p class="prev-hint volei-dedos-aviso" hidden>Desconforto alto: pare hoje e, se continuar nos próximos dias, procure um fisioterapeuta.</p>
      <label class="exec-anotacao-rot">Anotação
        <textarea rows="1" maxlength="400" placeholder="ex.: costas saindo curto, bola girando pra direita"></textarea>
      </label>
      <button type="button" class="swap-pill volei-concluir" style="width:100%; background:var(--accent); color:var(--accent-ink);">Concluir sessão</button>
    </div>
  `;
  const dedos = cardFim.querySelector(".volei-dedos");
  const dedosValor = cardFim.querySelector(".volei-dedos-valor");
  const dedosAviso = cardFim.querySelector(".volei-dedos-aviso");
  dedos.value = String(sessao.desconfortoDedos ?? 0);
  const desenharDedos = () => {
    dedosValor.textContent = dedos.value;
    dedosAviso.hidden = Number(dedos.value) < 6;
  };
  desenharDedos();
  dedos.addEventListener("input", desenharDedos);
  dedos.addEventListener("change", () => salvarSessaoVolei(db, hoje, { semana, desconfortoDedos: Number(dedos.value) }));
  const anotacao = cardFim.querySelector("textarea");
  anotacao.value = sessao.anotacao ?? "";
  ativarAutoResize(anotacao);
  anotacao.addEventListener("change", () => salvarSessaoVolei(db, hoje, { semana, anotacao: anotacao.value.trim() }));
  cardFim.querySelector(".volei-concluir").addEventListener("click", async () => {
    const minutos = Math.max(1, Math.round((Date.now() - inicioSessaoTs) / 60000));
    await salvarSessaoVolei(db, hoje, {
      semana,
      anotacao: anotacao.value.trim(),
      desconfortoDedos: Number(dedos.value),
      duracaoMin: (sessao.duracaoMin ?? 0) + minutos,
      concluida: true,
    });
    if (!inicio) await definirInicioVolei(db, hoje);
    if (aoVoltar) aoVoltar();
  });
  main.appendChild(cardFim);

  // Evolução dos testes.
  const cardEvolucao = document.createElement("section");
  cardEvolucao.className = "exercise-card";
  cardEvolucao.innerHTML = `<div class="exercise-head"><div class="exercise-name">Evolução — T1 precisão</div><div class="exercise-meta"></div></div><div class="volei-corpo volei-grafico"></div>`;
  const grafico = cardEvolucao.querySelector(".volei-grafico");
  cardEvolucao.querySelector(".exercise-meta").textContent = `${todas.length} sessões registradas`;
  // Redesenha a cada teste registrado — o valor de hoje entra na hora.
  function desenharEvolucao() {
    const sessoesComHoje = [...todas.filter((s) => s.data !== hoje), sessao];
    const pontosT1 = serieDoTeste(sessoesComHoje, "T1").filter((p) => p.valor > 0);
    grafico.innerHTML = "";
    if (pontosT1.length === 0) {
      grafico.innerHTML = `<p class="prev-hint" style="padding:0;">Faça o T1 na primeira semana pra ter a linha de base.</p>`;
    } else {
      grafico.appendChild(criarSvgLinha(pontosT1));
    }
    const ultimos = document.createElement("p");
    ultimos.className = "prev-hint";
    ultimos.style.padding = "8px 0 0";
    ultimos.textContent = ["T2", "T3", "T4"]
      .map((id) => { const serie = serieDoTeste(sessoesComHoje, id).filter((p) => p.valor > 0); return serie.length ? `${id}: ${serie.at(-1).valor}` : null; })
      .filter(Boolean)
      .join(" · ") || "T2, T3 e T4 aparecem aqui depois de registrados.";
    grafico.appendChild(ultimos);
  }
  desenharEvolucao();
  main.appendChild(cardEvolucao);

  const recomecar = document.createElement("button");
  recomecar.type = "button";
  recomecar.className = "pular-treino-btn";
  recomecar.style.cssText = "margin:4px auto 24px; display:block; color:var(--ink-faint);";
  recomecar.textContent = "Recomeçar o programa (semana 1)";
  recomecar.addEventListener("click", async () => {
    const confirmou = await confirmarAcao({
      titulo: "Recomeçar o programa?",
      mensagem: "Hoje vira a semana 1. O histórico e os testes continuam salvos.",
      textoConfirmar: "Recomeçar",
    });
    if (!confirmou) return;
    await definirInicioVolei(db, hoje);
    if (aoVoltar) aoVoltar();
  });
  main.appendChild(recomecar);

  return root;
}
