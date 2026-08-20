// js/app.js
import { openDatabase } from "./data/db.js";
import { seedIfNeeded } from "./data/seed.js";
import { montarTelaTreino } from "./screens/treino.js";

async function bootstrap() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Falha ao registrar service worker:", err);
    });
  }

  const db = await openDatabase();
  await seedIfNeeded(db);

  renderShell(db);
}

function renderShell(db) {
  const content = document.getElementById("tab-content");
  const tabs = document.querySelectorAll("#tab-bar button");

  const renderTab = async (tabName) => {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));

    try {
      if (tabName === "treino") {
        content.textContent = "";
        content.appendChild(await montarTelaTreino(db));
        return;
      }
      content.textContent = `Tela "${tabName}" ainda não implementada (vem no Nível 1b ou depois).`;
    } catch (err) {
      console.error(`Falha ao renderizar a aba "${tabName}":`, err);
      content.textContent = "Não foi possível carregar esta tela. Tente novamente ou importe seu último backup nas Configurações.";
    }
  };

  tabs.forEach((button) => {
    button.addEventListener("click", () => { renderTab(button.dataset.tab); });
  });

  renderTab("treino");
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar o app:", err);
  const content = document.getElementById("tab-content");
  content.textContent = "Não foi possível carregar seus dados. Tente importar seu último backup JSON nas Configurações.";
});
