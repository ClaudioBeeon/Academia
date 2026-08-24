// js/screens/fila.js
import { getSeriesDoExercicioNaData } from "../data/historico.js";
import { criarIconeExercicio } from "./iconeExercicio.js";
import { getHabito, registrarHabito } from "../data/habitos.js";

function montarAnelProgresso(concluidos, total, size = 156, espessura = 12) {
  const raio = (size - espessura) / 2;
  const perimetro = 2 * Math.PI * raio;
  const fracao = total > 0 ? concluidos / total : 0;
  const offset = perimetro * (1 - fracao);
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${raio}" fill="none" stroke="var(--card-2)" stroke-width="${espessura}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${raio}" fill="none" stroke="var(--accent)" stroke-width="${espessura}"
        stroke-linecap="round" stroke-dasharray="${perimetro.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})" />
    </svg>`;
  const wrap = document.createElement("div");
  wrap.className = "fila-progresso-ring";
  wrap.innerHTML = `
    <div class="ring-inner">
      ${svg}
      <div class="ring-ctr"><u>Hoje</u><b>${concluidos}/${total}</b><s>exercícios</s></div>
    </div>
  `;
  return wrap;
}

const ICONE_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

async function montarChecklistAquecimento(db, hoje, aquecimento) {
  const habito = (await getHabito(db, hoje)) ?? {};
  const total = aquecimento?.exercicios?.length ?? 0;
  const movimentosFeitos = new Set(habito.aquecimentoMovimentos ?? []);

  const card = document.createElement("section");
  card.className = "exercise-card bloco-apoio";

  const head = document.createElement("div");
  head.className = "bloco-apoio-head sem-check";
  head.innerHTML = `
    <div>
      <div class="bloco-apoio-titulo"></div>
      <div class="bloco-apoio-sub"></div>
    </div>
  `;
  head.querySelector(".bloco-apoio-titulo").textContent = aquecimento?.nome ?? "Aquecimento";
  head.querySelector(".bloco-apoio-sub").textContent = aquecimento
    ? `${aquecimento.duracaoMin} min · antes de tudo`
    : "1-2 séries leves antes do primeiro composto";

  if (total > 0) {
    const progresso = document.createElement("div");
    progresso.className = "fila-status bloco-apoio-progresso";
    head.appendChild(progresso);
    const atualizarProgresso = () => {
      progresso.textContent = `${movimentosFeitos.size}/${total}`;
      progresso.classList.toggle("feito", movimentosFeitos.size === total);
    };
    atualizarProgresso();
    card.appendChild(head);

    const det = document.createElement("details");
    det.className = "bloco-apoio-lista";
    const sum = document.createElement("summary");
    sum.textContent = `Ver os ${total} movimentos`;
    det.appendChild(sum);

    if (aquecimento.porque) {
      const porque = document.createElement("p");
      porque.className = "bloco-apoio-porque";
      porque.textContent = aquecimento.porque;
      det.appendChild(porque);
    }

    aquecimento.exercicios.forEach((item, indice) => {
      const li = document.createElement("div");
      li.className = "bloco-apoio-item bloco-apoio-item-check";
      li.innerHTML = `
        <button type="button" class="bloco-apoio-check" aria-label="Marcar ${item.nome} como feito"></button>
        <div class="bloco-apoio-item-corpo">
          <h5></h5>
          <span class="bloco-apoio-presc"></span>
          <p></p>
        </div>
      `;
      li.querySelector("h5").textContent = item.nome;
      li.querySelector(".bloco-apoio-presc").textContent = item.prescricao;
      li.querySelector("p").textContent = item.como;

      const botaoCheck = li.querySelector(".bloco-apoio-check");
      const aplicarEstado = () => {
        const feito = movimentosFeitos.has(indice);
        botaoCheck.innerHTML = feito ? ICONE_CHECK : "";
        botaoCheck.classList.toggle("feito", feito);
        li.classList.toggle("feito", feito);
      };
      aplicarEstado();

      botaoCheck.addEventListener("click", async () => {
        if (movimentosFeitos.has(indice)) movimentosFeitos.delete(indice);
        else movimentosFeitos.add(indice);
        aplicarEstado();
        atualizarProgresso();
        await registrarHabito(db, hoje, {
          aquecimentoMovimentos: [...movimentosFeitos],
          aquecimentoFeito: movimentosFeitos.size === total,
        });
      });

      det.appendChild(li);
    });
    card.appendChild(det);
  } else {
    card.appendChild(head);
  }

  return card;
}

function montarBlocoAlongamento(alongamento) {
  if (!alongamento) return null;
  const card = document.createElement("section");
  card.className = "exercise-card bloco-apoio";

  const head = document.createElement("div");
  head.className = "bloco-apoio-head sem-check";
  head.innerHTML = `<div><div class="bloco-apoio-titulo"></div><div class="bloco-apoio-sub"></div></div>`;
  head.querySelector(".bloco-apoio-titulo").textContent = alongamento.nome;
  head.querySelector(".bloco-apoio-sub").textContent = alongamento.quando;
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

const NOME_MODALIDADE_CARDIO = {
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

function nomeDoMusculo(chave) {
  return NOME_MUSCULO[chave] ?? chave.replace(/_/g, " ");
}

function montarBlocoCardio(cardio, regras) {
  if (!cardio) return null;
  const card = document.createElement("section");
  card.className = "exercise-card bloco-apoio";

  const head = document.createElement("div");
  head.className = "bloco-apoio-head sem-check";
  head.innerHTML = `<div><div class="bloco-apoio-titulo"></div><div class="bloco-apoio-sub"></div></div>`;
  head.querySelector(".bloco-apoio-titulo").textContent =
    `Cardio — ${NOME_MODALIDADE_CARDIO[cardio.modalidade] ?? cardio.modalidade}`;
  head.querySelector(".bloco-apoio-sub").textContent =
    `${cardio.duracaoMin} min · intensidade ${cardio.intensidade} · depois do treino`;
  card.appendChild(head);

  if (regras) {
    const det = document.createElement("details");
    det.className = "bloco-apoio-lista";
    const sum = document.createElement("summary");
    sum.textContent = "Como fazer";
    det.appendChild(sum);
    for (const chave of ["ordem", "intensidade", "modalidade", "caminhada"]) {
      if (!regras[chave]) continue;
      const p = document.createElement("p");
      p.textContent = regras[chave];
      det.appendChild(p);
    }
    card.appendChild(det);
  }
  return card;
}

export async function montarTelaFila(db, contexto, callbacks) {
  const { diaInfo, exerciciosHoje, hoje, diaDaFicha = null, ficha = null, semanaDoBloco = 1 } = contexto;
  const { onExecutar, onFinalizarSessao, onVoltar, onPular, onReiniciar } = callbacks;

  const seriesPorExercicio = await Promise.all(
    exerciciosHoje.map((e) => getSeriesDoExercicioNaData(db, e.id, hoje))
  );

  let totalSeriesFeitas = 0;
  let totalSeriesPrevistas = 0;
  let exerciciosConcluidos = 0;
  const estados = seriesPorExercicio.map((series, indice) => {
    const seriesAlvo = exerciciosHoje[indice].seriesAlvo ?? 3;
    totalSeriesFeitas += series.length;
    totalSeriesPrevistas += seriesAlvo;
    if (series.length >= seriesAlvo) {
      exerciciosConcluidos++;
      return "concluido";
    }
    return series.length > 0 ? "andamento" : "pendente";
  });

  const root = document.createElement("div");
  root.className = "tela-fila";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `
    <div>
      <div class="date-label">${diaInfo.titulo}</div>
      <div class="day-title">Fila do dia</div>
    </div>
  `;
  const voltarBtn = document.createElement("button");
  voltarBtn.type = "button";
  voltarBtn.className = "icon-btn";
  voltarBtn.setAttribute("aria-label", "Fechar");
  voltarBtn.textContent = "✕";
  voltarBtn.addEventListener("click", () => { if (onVoltar) onVoltar(); });
  header.appendChild(voltarBtn);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  main.appendChild(await montarChecklistAquecimento(db, hoje, ficha?.aquecimento));

  const anel = montarAnelProgresso(exerciciosConcluidos, exerciciosHoje.length);
  const legenda = document.createElement("p");
  legenda.textContent = `${totalSeriesPrevistas} séries no total · ${totalSeriesFeitas}/${totalSeriesPrevistas} feitas`;
  anel.appendChild(legenda);
  main.appendChild(anel);

  // Semana do mesociclo: o volume da ficha muda a partir da semana 3, então
  // dizer em que semana o usuário está evita ele achar que o app se perdeu.
  if (ficha?.mesociclo?.semanas) {
    const info = ficha.mesociclo.semanas.find((s) => s.semana === semanaDoBloco);
    if (info) {
      const faixa = document.createElement("div");
      faixa.className = "faixa-semana";
      const titulo = document.createElement("b");
      titulo.textContent = `Semana ${info.semana} de 5 · RIR ${info.rirAlvo} · ${info.volume}`;
      const obj = document.createElement("span");
      obj.textContent = info.objetivo;
      faixa.append(titulo, obj);
      main.appendChild(faixa);
    }
  }

  exerciciosHoje.forEach((exercicio, indice) => {
    const item = document.createElement("section");
    item.className = "exercise-card fila-item fila-item-" + estados[indice];
    item.innerHTML = `
      <div class="exercise-head">
        <div class="fila-item-info">
          <div>
            <div class="exercise-name"></div>
            <div class="exercise-meta"></div>
          </div>
        </div>
        <div class="fila-status"></div>
      </div>
    `;
    item.querySelector(".fila-item-info").prepend(criarIconeExercicio(exercicio.id, 52, exercicio.imagemUrl));
    item.querySelector(".exercise-name").textContent = exercicio.nome;
    item.querySelector(".exercise-meta").textContent = nomeDoMusculo(exercicio.musculoPrimario);
    const statusEl = item.querySelector(".fila-status");
    statusEl.textContent = estados[indice] === "concluido" ? "✓" : estados[indice] === "andamento" ? `${seriesPorExercicio[indice].length}/${exercicio.seriesAlvo ?? 3}` : "";
    item.addEventListener("click", () => { if (onExecutar) onExecutar(indice); });
    main.appendChild(item);
  });

  // Cardio e alongamento vêm DEPOIS dos exercícios na tela porque é essa a
  // ordem da sessão: musculação primeiro (cardio antes rouba a qualidade das
  // séries), alongamento da frente por último, quando o peitoral está quente.
  const blocoCardio = montarBlocoCardio(diaDaFicha?.cardio, ficha?.cardioRegras);
  if (blocoCardio) main.appendChild(blocoCardio);

  const chaveAlongamento = diaDaFicha?.alongamentoFinal;
  const blocoAlongamento = chaveAlongamento
    ? montarBlocoAlongamento(ficha?.alongamentos?.[chaveAlongamento])
    : null;
  if (blocoAlongamento) main.appendChild(blocoAlongamento);

  const rodape = document.createElement("div");
  rodape.className = "foot";
  rodape.style.cssText = "padding:14px 18px 24px; text-align:center;";
  rodape.innerHTML = `<button type="button" class="swap-pill finalizar-btn" style="width:100%; background:var(--accent); color:var(--accent-ink);">Finalizar sessão</button>`;
  rodape.querySelector(".finalizar-btn").addEventListener("click", () => { if (onFinalizarSessao) onFinalizarSessao(); });

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
