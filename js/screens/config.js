// js/screens/config.js
import { exportarTudo, importarTudo, historicoParaCsv } from "../data/exportImport.js";
import { getAll } from "../data/db.js";
import { getEquipamento, salvarEquipamento } from "../data/equipamento.js";

export async function montarTelaConfig(db, { onAbrirBiblioteca } = {}) {
  const root = document.createElement("div");
  root.className = "tela-config";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Configurações</div><div class="day-title">Config</div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  main.appendChild(criarLinkAcao("Biblioteca de exercícios", () => {
    if (onAbrirBiblioteca) onAbrirBiblioteca();
  }));

  main.appendChild(criarLinkAcao("Exportar backup (JSON)", async () => {
    const backup = await exportarTudo(db);
    baixarArquivo(`backup-app-treino-${dataDeHoje()}.json`, JSON.stringify(backup, null, 2), "application/json");
  }));

  main.appendChild(criarLinkAcao("Exportar histórico (CSV)", async () => {
    const historicoSeries = await getAll(db, "historicoSeries");
    baixarArquivo(`historico-${dataDeHoje()}.csv`, historicoParaCsv(historicoSeries), "text/csv");
  }));

  main.appendChild(await criarSecaoEquipamento(db));

  const importCard = document.createElement("section");
  importCard.className = "exercise-card";
  importCard.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Importar backup (JSON)</div></div>
    <div class="sets" style="padding: 0 18px 18px;">
      <input type="file" accept="application/json" class="import-input" style="width:100%; color:var(--ink);" />
      <div class="prev-hint import-status"></div>
    </div>
  `;
  const input = importCard.querySelector(".import-input");
  const status = importCard.querySelector(".import-status");
  input.addEventListener("change", async () => {
    const arquivo = input.files[0];
    if (!arquivo) return;
    try {
      const texto = await arquivo.text();
      const backup = JSON.parse(texto);
      await importarTudo(db, backup);
      status.textContent = "Backup importado com sucesso. Recarregue o app para ver os dados.";
    } catch (err) {
      console.error("Falha ao importar backup:", err);
      status.textContent = "Não foi possível importar este arquivo — confirme que é um backup exportado por este app.";
    }
  });
  main.appendChild(importCard);

  return root;
}

function criarLinkAcao(texto, aoClicar) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `<div class="exercise-name"></div><button class="swap-pill" type="button">Abrir</button>`;
  head.querySelector(".exercise-name").textContent = texto;
  head.querySelector(".swap-pill").addEventListener("click", aoClicar);
  card.appendChild(head);
  return card;
}

function baixarArquivo(nomeArquivo, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

function dataDeHoje() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

async function criarSecaoEquipamento(db) {
  const equipamento = await getEquipamento(db);

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Equipamento (barra e anilhas)</div></div>`;

  const form = document.createElement("form");
  form.className = "sets";
  form.style.padding = "0 18px 18px";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Peso da barra (kg)</label>
      <input name="pesoBarra" type="number" step="0.5" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label>Anilhas disponíveis (kg, separadas por vírgula)</label>
      <input name="anilhas" type="text" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
    <div class="prev-hint equipamento-status" style="grid-column:1/-1;"></div>
  `;
  form.pesoBarra.value = equipamento.pesoBarra;
  form.anilhas.value = equipamento.anilhasDisponiveis.join(", ");
  card.appendChild(form);

  const status = form.querySelector(".equipamento-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pesoBarra = Number(form.pesoBarra.value);
    const anilhasDisponiveis = form.anilhas.value
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (!(pesoBarra > 0) || anilhasDisponiveis.length === 0) {
      status.textContent = "Preencha o peso da barra e ao menos uma anilha válida.";
      return;
    }
    await salvarEquipamento(db, { pesoBarra, anilhasDisponiveis });
    status.textContent = "Salvo.";
  });

  return card;
}
