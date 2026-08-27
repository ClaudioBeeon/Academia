// js/screens/historicoSessoes.js
//
// Histórico geral de treinos — agrupado por dia, com edição e exclusão de
// séries individuais. Diferente de js/screens/historico.js, que mostra o
// histórico de UM exercício dentro do fluxo de execução; esta tela é a visão
// "o que aconteceu em cada treino", acessada de fora da sessão do dia.
import { getAll } from "../data/db.js";
import { getSessoesAgrupadasPorDia, atualizarSerie, excluirSerie } from "../data/historico.js";
import { confirmarAcao } from "./confirmarAcao.js";

function formatarDataLonga(dataIso) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  const texto = data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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
  const nomePorExercicio = new Map(exercicios.map((e) => [e.id, e.nome]));

  if (sessoes.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio";
    vazio.textContent = "Nenhum treino registrado ainda.";
    main.appendChild(vazio);
    return root;
  }

  for (const sessao of sessoes) {
    main.appendChild(montarCardDoDia(db, sessao, nomePorExercicio));
  }

  return root;
}

function montarCardDoDia(db, sessao, nomePorExercicio) {
  const { data, series } = sessao;

  const porExercicio = new Map();
  for (const serie of series) {
    if (!porExercicio.has(serie.exercicioId)) porExercicio.set(serie.exercicioId, []);
    porExercicio.get(serie.exercicioId).push(serie);
  }

  const card = document.createElement("section");
  card.className = "exercise-card historico-dia";

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `<div><div class="exercise-name"></div><div class="exercise-meta"></div></div>`;
  head.querySelector(".exercise-name").textContent = formatarDataLonga(data);
  head.querySelector(".exercise-meta").textContent = `${porExercicio.size} exercício${porExercicio.size === 1 ? "" : "s"} · ${series.length} série${series.length === 1 ? "" : "s"}`;
  card.appendChild(head);

  const corpo = document.createElement("div");
  corpo.className = "historico-dia-corpo";
  card.appendChild(corpo);

  for (const [exercicioId, seriesDoExercicio] of porExercicio) {
    seriesDoExercicio.sort((a, b) => (a.serieNumero ?? 0) - (b.serieNumero ?? 0));
    const bloco = document.createElement("div");
    bloco.className = "historico-exercicio";

    const titulo = document.createElement("h5");
    titulo.textContent = nomePorExercicio.get(exercicioId) ?? exercicioId;
    bloco.appendChild(titulo);

    for (const serie of seriesDoExercicio) {
      bloco.appendChild(montarLinhaSerie(db, serie, card, sessao));
    }
    corpo.appendChild(bloco);
  }

  return card;
}

function montarLinhaSerie(db, serie, cardDoDia, sessao) {
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

  const renderizarVisual = () => {
    info.innerHTML = `<b>${serie.carga} kg × ${serie.reps}</b><span>RIR ${serie.rir}${serie.serieNumero ? ` · série ${serie.serieNumero}` : ""}</span>`;
  };
  renderizarVisual();

  editarBtn.addEventListener("click", () => {
    const formAtivo = linha.querySelector(".historico-serie-form");
    if (formAtivo) return;
    linha.classList.add("editando");
    info.style.display = "none";
    acoes.style.display = "none";

    const form = document.createElement("div");
    form.className = "historico-serie-form";
    form.innerHTML = `
      <div class="campo"><label>Carga<input type="number" step="0.5" class="in-carga" /></label></div>
      <div class="campo"><label>Reps<input type="number" step="1" class="in-reps" /></label></div>
      <div class="campo"><label>RIR<input type="number" step="1" class="in-rir" /></label></div>
      <div class="historico-serie-form-acoes">
        <button type="button" class="salvar">Salvar</button>
        <button type="button" class="cancelar">Cancelar</button>
      </div>
    `;
    form.querySelector(".in-carga").value = serie.carga;
    form.querySelector(".in-reps").value = serie.reps;
    form.querySelector(".in-rir").value = serie.rir;
    linha.appendChild(form);

    const fecharForm = () => {
      form.remove();
      linha.classList.remove("editando");
      info.style.display = "";
      acoes.style.display = "";
    };

    form.querySelector(".cancelar").addEventListener("click", fecharForm);
    form.querySelector(".salvar").addEventListener("click", async () => {
      const carga = Number(form.querySelector(".in-carga").value);
      const reps = Number(form.querySelector(".in-reps").value);
      const rir = Number(form.querySelector(".in-rir").value);
      if (!(carga >= 0) || !(reps >= 0) || !(rir >= 0)) return;
      await atualizarSerie(db, serie.id, { carga, reps, rir });
      serie.carga = carga;
      serie.reps = reps;
      serie.rir = rir;
      renderizarVisual();
      fecharForm();
    });
  });

  excluirBtn.addEventListener("click", async () => {
    const confirmou = await confirmarAcao({ titulo: "Excluir esta série?", mensagem: `${serie.carga} kg × ${serie.reps} sai do histórico.`, textoConfirmar: "Excluir", destrutivo: true });
    if (!confirmou) return;
    await excluirSerie(db, serie.id);
    linha.remove();
    sessao.series = sessao.series.filter((s) => s.id !== serie.id);
    if (sessao.series.length === 0) cardDoDia.remove();
  });

  return linha;
}
