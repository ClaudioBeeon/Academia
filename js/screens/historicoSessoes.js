// js/screens/historicoSessoes.js
//
// Histórico geral de treinos — lista compacta por dia; tocar num dia abre
// uma tela cheia com tudo daquele dia editável: carga/reps/RIR e número de
// qualquer série já registrada, mover uma série pra outro exercício
// (corrige quando registrou no exercício errado), adicionar uma série
// esquecida, adicionar cardio retroativo, e a observação livre do dia
// (js/data/observacoesTreino.js — a mesma que aparece no fim da sessão, só
// que aqui dá pra adicionar/editar depois, não só no dia do treino).
// Diferente de js/screens/historico.js, que mostra o histórico de UM
// exercício dentro do fluxo de execução; esta tela é a visão "o que
// aconteceu em cada treino", acessada de fora da sessão do dia.
//
// Toda gravação aqui passa por put()/del() (js/data/db.js), que já dispara
// o gancho de sincronização — não precisa de nenhum "botão salvar" extra
// pro Supabase, sobe sozinho assim que a edição é confirmada.
import { getAll } from "../data/db.js";
import { getSessoesAgrupadasPorDia, atualizarSerie, excluirSerie, registrarSerie } from "../data/historico.js";
import { getCardioDoDia, excluirCardio } from "../data/cardio.js";
import { getObservacaoTreino, salvarObservacaoTreino } from "../data/observacoesTreino.js";
import { confirmarAcao } from "./confirmarAcao.js";
import { montarFormCardio } from "./divisao.js";

const NOME_MODALIDADE_CARDIO = {
  bicicleta: "Bicicleta", eliptico: "Elíptico", escada: "Escada", caminhada: "Caminhada", corrida: "Corrida",
};

function formatarDataLonga(dataIso) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  const texto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatarDataCurta(dataIso) {
  const [, mes, dia] = dataIso.split("-");
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return { dia, mes: MESES[Number(mes) - 1] };
}

function opcoesDeExercicio(exerciciosOrdenados, selecionadoId) {
  return exerciciosOrdenados
    .map((e) => `<option value="${e.id}"${e.id === selecionadoId ? " selected" : ""}>${e.nome}</option>`)
    .join("");
}

export async function montarTelaHistoricoSessoes(db, { aoVoltar } = {}) {
  const root = document.createElement("div");
  root.className = "tela-historico-sessoes";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Evolução</div><div class="day-title">Histórico de treinos</div></div>`;
  root.appendChild(header);

  if (aoVoltar) {
    const voltar = document.createElement("button");
    voltar.type = "button";
    voltar.className = "swap-pill";
    voltar.style.margin = "12px 0 0";
    voltar.textContent = "← Voltar";
    voltar.addEventListener("click", aoVoltar);
    root.appendChild(voltar);
  }

  const main = document.createElement("main");
  root.appendChild(main);

  const [exercicios, sessoes] = await Promise.all([
    getAll(db, "exercicios"),
    getSessoesAgrupadasPorDia(db),
  ]);

  if (sessoes.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = "Nenhum treino registrado ainda.";
    main.appendChild(vazio);
    return root;
  }

  const exerciciosOrdenados = [...exercicios].sort((a, b) => a.nome.localeCompare(b.nome));
  const nomePorExercicio = new Map(exercicios.map((e) => [e.id, e.nome]));
  const exercicioPorId = new Map(exercicios.map((e) => [e.id, e]));

  const listaEl = document.createElement("div");
  main.appendChild(listaEl);

  function renderizarLista(sessoesAtuais) {
    listaEl.innerHTML = "";
    for (const sessao of sessoesAtuais) {
      listaEl.appendChild(montarLinhaDia(db, sessao, exerciciosOrdenados, nomePorExercicio, exercicioPorId, recarregarLista));
    }
  }

  async function recarregarLista() {
    renderizarLista(await getSessoesAgrupadasPorDia(db));
  }

  renderizarLista(sessoes);

  return root;
}

function montarLinhaDia(db, sessao, exerciciosOrdenados, nomePorExercicio, exercicioPorId, recarregarLista) {
  const { data, series } = sessao;
  const { dia, mes } = formatarDataCurta(data);
  const exerciciosNoDia = new Set(series.map((s) => s.exercicioId)).size;

  const linha = document.createElement("div");
  linha.className = "sessao-linha";
  linha.innerHTML = `
    <div class="quando"><b>${dia}</b><span>${mes}</span></div>
    <div class="oque">
      <b>${formatarDataLonga(data)}</b>
      <span>${exerciciosNoDia} exercício${exerciciosNoDia === 1 ? "" : "s"} · ${series.length} série${series.length === 1 ? "" : "s"}</span>
    </div>
  `;
  linha.addEventListener("click", async () => {
    const overlay = document.createElement("div");
    overlay.className = "historico-overlay";
    const fechar = async () => {
      overlay.remove();
      await recarregarLista();
    };
    const conteudo = await montarTelaDetalheDia(db, data, exerciciosOrdenados, nomePorExercicio, exercicioPorId, fechar);
    overlay.appendChild(conteudo);
    document.body.appendChild(overlay);
  });

  return linha;
}

async function montarTelaDetalheDia(db, data, exerciciosOrdenados, nomePorExercicio, exercicioPorId, aoVoltar) {
  const root = document.createElement("div");
  root.className = "tela-historico";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Histórico</div><div class="day-title"></div></div>`;
  header.querySelector(".day-title").textContent = formatarDataLonga(data);
  root.appendChild(header);

  const voltar = document.createElement("button");
  voltar.type = "button";
  voltar.className = "swap-pill";
  voltar.style.margin = "12px 0 0";
  voltar.textContent = "← Voltar ao histórico";
  voltar.addEventListener("click", aoVoltar);
  root.appendChild(voltar);

  const main = document.createElement("main");
  root.appendChild(main);

  await renderizarDetalheDia(db, data, exerciciosOrdenados, nomePorExercicio, exercicioPorId, main);

  return root;
}

// Recarrega e redesenha só o conteúdo (`main`) da tela de detalhe — usada
// depois de qualquer edição que muda a composição do dia (mover série de
// exercício, adicionar série, adicionar/excluir cardio), pra sempre refletir
// o estado real em vez de tentar remendar o DOM na mão.
async function renderizarDetalheDia(db, data, exerciciosOrdenados, nomePorExercicio, exercicioPorId, main) {
  main.innerHTML = "";

  const [sessoes, cardioDoDia] = await Promise.all([
    getSessoesAgrupadasPorDia(db),
    getCardioDoDia(db, data),
  ]);
  const sessao = sessoes.find((s) => s.data === data) ?? { data, series: [] };
  const recarregar = () => renderizarDetalheDia(db, data, exerciciosOrdenados, nomePorExercicio, exercicioPorId, main);

  const porExercicio = new Map();
  for (const serie of sessao.series) {
    if (!porExercicio.has(serie.exercicioId)) porExercicio.set(serie.exercicioId, []);
    porExercicio.get(serie.exercicioId).push(serie);
  }

  if (porExercicio.size === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = "Nenhuma série de musculação neste dia.";
    main.appendChild(vazio);
  }

  for (const [exercicioId, seriesDoExercicio] of porExercicio) {
    seriesDoExercicio.sort((a, b) => (a.serieNumero ?? 0) - (b.serieNumero ?? 0));
    const card = document.createElement("section");
    card.className = "exercise-card";
    const head = document.createElement("div");
    head.className = "exercise-head";
    head.innerHTML = `<div class="exercise-name"></div>`;
    head.querySelector(".exercise-name").textContent = nomePorExercicio.get(exercicioId) ?? exercicioId;
    card.appendChild(head);

    const corpo = document.createElement("div");
    corpo.className = "historico-dia-corpo";
    corpo.appendChild(montarBlocoExercicio(db, exercicioId, seriesDoExercicio, data, exerciciosOrdenados, exercicioPorId, recarregar));
    card.appendChild(corpo);
    main.appendChild(card);
  }

  main.appendChild(montarBlocoCardio(db, data, cardioDoDia, recarregar));
  main.appendChild(montarBlocoObservacao(db, data));
}

function montarBlocoExercicio(db, exercicioId, seriesDoExercicio, data, exerciciosOrdenados, exercicioPorId, recarregar) {
  const bloco = document.createElement("div");
  bloco.className = "historico-exercicio";

  const listaEl = document.createElement("div");
  bloco.appendChild(listaEl);
  for (const serie of seriesDoExercicio) {
    listaEl.appendChild(montarLinhaSerie(db, serie, exerciciosOrdenados, recarregar));
  }

  const proximoNumero = Math.max(0, ...seriesDoExercicio.map((s) => s.serieNumero ?? 0)) + 1;
  const adicionarBtn = document.createElement("button");
  adicionarBtn.type = "button";
  adicionarBtn.className = "historico-adicionar-serie";
  adicionarBtn.textContent = "+ Adicionar série esquecida";
  adicionarBtn.addEventListener("click", () => {
    if (bloco.querySelector(".historico-serie-form")) return;
    adicionarBtn.hidden = true;
    const form = montarFormularioSerie(db, {
      modo: "criar",
      data,
      exercicioIdInicial: exercicioId,
      serieNumeroInicial: proximoNumero,
      exerciciosOrdenados,
      exercicioPorId,
      aoFechar: () => { adicionarBtn.hidden = false; form.remove(); },
      aoSalvar: recarregar,
    });
    bloco.insertBefore(form, adicionarBtn);
  });
  bloco.appendChild(adicionarBtn);

  return bloco;
}

function montarLinhaSerie(db, serie, exerciciosOrdenados, recarregar) {
  const linha = document.createElement("div");
  linha.className = "historico-serie";

  const info = document.createElement("div");
  info.className = "historico-serie-info";
  linha.appendChild(info);

  const acoes = document.createElement("div");
  acoes.className = "historico-serie-acoes";
  const editarBtn = document.createElement("button");
  editarBtn.type = "button";
  editarBtn.className = "historico-serie-btn";
  editarBtn.setAttribute("aria-label", "Editar esta série");
  editarBtn.textContent = "✎";
  const excluirBtn = document.createElement("button");
  excluirBtn.type = "button";
  excluirBtn.className = "historico-serie-btn";
  excluirBtn.setAttribute("aria-label", "Excluir esta série");
  excluirBtn.textContent = "✕";
  acoes.append(editarBtn, excluirBtn);
  linha.appendChild(acoes);

  info.innerHTML = `<b>${serie.carga} kg × ${serie.reps}</b><span>RIR ${serie.rir}${serie.serieNumero ? ` · série ${serie.serieNumero}` : ""}</span>`;

  editarBtn.addEventListener("click", () => {
    if (linha.querySelector(".historico-serie-form")) return;
    linha.classList.add("editando");
    info.style.display = "none";
    acoes.style.display = "none";

    const form = montarFormularioSerie(db, {
      modo: "editar",
      serie,
      exerciciosOrdenados,
      aoFechar: () => {
        form.remove();
        linha.classList.remove("editando");
        info.style.display = "";
        acoes.style.display = "";
      },
      aoSalvar: recarregar,
    });
    linha.appendChild(form);
  });

  excluirBtn.addEventListener("click", async () => {
    const confirmou = await confirmarAcao({ titulo: "Excluir esta série?", mensagem: `${serie.carga} kg × ${serie.reps} sai do histórico.`, textoConfirmar: "Excluir", destrutivo: true });
    if (!confirmou) return;
    await excluirSerie(db, serie.id);
    await recarregar();
  });

  return linha;
}

// Formulário compartilhado entre "editar série existente" e "adicionar
// série esquecida" — os campos são os mesmos, só muda o que acontece ao
// salvar (atualizarSerie vs. registrarSerie). Sempre recarrega a tela
// inteira ao salvar: mudar o exercício de uma série (ou adicionar uma nova)
// muda quais blocos existem, então remendar só a linha não basta.
function montarFormularioSerie(db, { modo, serie, data, exercicioIdInicial, serieNumeroInicial, exerciciosOrdenados, exercicioPorId, aoFechar, aoSalvar }) {
  const form = document.createElement("div");
  form.className = "historico-serie-form";
  const exercicioIdAtual = modo === "editar" ? serie.exercicioId : exercicioIdInicial;
  form.innerHTML = `
    <div class="campo campo-exercicio"><label>Exercício<select class="in-exercicio">${opcoesDeExercicio(exerciciosOrdenados, exercicioIdAtual)}</select></label></div>
    <div class="campo"><label>Série nº<input type="number" step="1" min="1" class="in-serie-numero" /></label></div>
    <div class="campo"><label>Carga<input type="number" step="0.5" class="in-carga" /></label></div>
    <div class="campo"><label>Reps<input type="number" step="1" class="in-reps" /></label></div>
    <div class="campo"><label>RIR<input type="number" step="1" class="in-rir" /></label></div>
    <div class="historico-serie-form-acoes">
      <button type="button" class="salvar">${modo === "criar" ? "Adicionar" : "Salvar"}</button>
      <button type="button" class="cancelar">Cancelar</button>
    </div>
  `;
  form.querySelector(".in-serie-numero").value = modo === "editar" ? (serie.serieNumero ?? 1) : serieNumeroInicial;
  form.querySelector(".in-carga").value = modo === "editar" ? serie.carga : "";
  form.querySelector(".in-reps").value = modo === "editar" ? serie.reps : "";
  form.querySelector(".in-rir").value = modo === "editar" ? serie.rir : "";

  form.querySelector(".cancelar").addEventListener("click", aoFechar);
  form.querySelector(".salvar").addEventListener("click", async () => {
    const exercicioId = form.querySelector(".in-exercicio").value;
    const serieNumero = Number(form.querySelector(".in-serie-numero").value);
    const carga = Number(form.querySelector(".in-carga").value);
    const reps = Number(form.querySelector(".in-reps").value);
    const rir = Number(form.querySelector(".in-rir").value);
    if (!(carga >= 0) || !(reps >= 0) || !(rir >= 0) || !(serieNumero >= 1)) return;

    if (modo === "criar") {
      const exercicio = exercicioPorId.get(exercicioId);
      await registrarSerie(db, {
        exercicioId,
        data,
        musculo: exercicio?.musculoPrimario ?? "",
        contribuicao: 1.0,
        tipoSerie: "normal",
        carga, reps, rir,
        serieNumero,
      });
    } else {
      await atualizarSerie(db, serie.id, { exercicioId, serieNumero, carga, reps, rir });
    }
    await aoSalvar();
  });

  return form;
}

// Cardio do dia — lista o que já foi registrado e reaproveita o mesmo
// formulário de lançamento retroativo da aba Treinos (js/screens/divisao.js),
// só sem o aviso de "evite cardio pesado após dia de perna" (esse aviso é
// pra decisão na hora, não faz sentido revisando um dia já passado).
function montarBlocoCardio(db, data, cardioDoDia, recarregar) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Cardio</div></div>`;

  const corpo = document.createElement("div");
  corpo.className = "sets";
  corpo.style.padding = "0 18px 18px";

  if (cardioDoDia.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "prev-hint";
    vazio.style.padding = "0";
    vazio.textContent = "Nenhum cardio registrado neste dia.";
    corpo.appendChild(vazio);
  }
  for (const registro of cardioDoDia) {
    const linha = document.createElement("div");
    linha.className = "historico-serie";
    linha.innerHTML = `
      <div class="historico-serie-info">
        <b>${NOME_MODALIDADE_CARDIO[registro.modalidade] ?? registro.modalidade}</b>
        <span>${registro.duracaoMinutos ?? "?"} min · intensidade ${registro.intensidadePercebida ?? "?"}/5</span>
      </div>
    `;
    const excluirBtn = document.createElement("button");
    excluirBtn.type = "button";
    excluirBtn.className = "historico-serie-btn";
    excluirBtn.setAttribute("aria-label", "Excluir este cardio");
    excluirBtn.textContent = "✕";
    excluirBtn.addEventListener("click", async () => {
      const confirmou = await confirmarAcao({ titulo: "Excluir este cardio?", mensagem: `${NOME_MODALIDADE_CARDIO[registro.modalidade] ?? registro.modalidade}, ${registro.duracaoMinutos ?? "?"} min.`, textoConfirmar: "Excluir", destrutivo: true });
      if (!confirmou) return;
      await excluirCardio(db, registro.id);
      await recarregar();
    });
    const acoes = document.createElement("div");
    acoes.className = "historico-serie-acoes";
    acoes.appendChild(excluirBtn);
    linha.appendChild(acoes);
    corpo.appendChild(linha);
  }

  const adicionarBtn = document.createElement("button");
  adicionarBtn.type = "button";
  adicionarBtn.className = "swap-pill";
  adicionarBtn.style.marginTop = "10px";
  adicionarBtn.textContent = "+ Adicionar cardio";
  corpo.appendChild(adicionarBtn);

  adicionarBtn.addEventListener("click", () => {
    if (corpo.querySelector("form")) return;
    adicionarBtn.hidden = true;
    const form = montarFormCardio(db, data, null, async () => {
      await recarregar();
    });
    corpo.insertBefore(form, adicionarBtn);
  });

  card.appendChild(corpo);
  return card;
}

// Mesma observação livre do fim da sessão (js/screens/relatorio.js) — aqui
// também dá pra adicionar ou corrigir depois, revisando um dia já passado.
function montarBlocoObservacao(db, data) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Observação do dia</div></div>
    <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:8px;">
      <textarea class="historico-obs-input" rows="3" placeholder="ex: senti dor no ombro direito no supino, na descida" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;"></textarea>
      <button type="button" class="swap-pill historico-obs-salvar" style="width:100%;">Salvar observação</button>
      <div class="prev-hint historico-obs-status"></div>
    </div>
  `;
  const input = card.querySelector(".historico-obs-input");
  const status = card.querySelector(".historico-obs-status");
  getObservacaoTreino(db, data).then((texto) => { input.value = texto; });
  card.querySelector(".historico-obs-salvar").addEventListener("click", async () => {
    await salvarObservacaoTreino(db, data, input.value);
    status.textContent = input.value.trim() ? "Salva." : "Removida.";
  });
  return card;
}
