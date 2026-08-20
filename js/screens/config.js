// js/screens/config.js
import { exportarTudo, importarTudo, historicoParaCsv } from "../data/exportImport.js";
import { getAll } from "../data/db.js";

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
