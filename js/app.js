// js/app.js
import { openDatabase } from "./data/db.js";
import { seedIfNeeded } from "./data/seed.js";

async function bootstrap() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Falha ao registrar service worker:", err);
    });
  }

  const db = await openDatabase();
  await seedIfNeeded(db);

  renderPlaceholderShell();
}

function renderPlaceholderShell() {
  const content = document.getElementById("tab-content");
  const tabs = document.querySelectorAll("#tab-bar button");

  const renderTab = (tabName) => {
    content.textContent = `Tela "${tabName}" ainda não implementada (vem no plano do Nível 1).`;
  };

  tabs.forEach((button) => {
    button.addEventListener("click", () => renderTab(button.dataset.tab));
  });

  renderTab("treino");
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar o app:", err);
  const content = document.getElementById("tab-content");
  content.textContent = "Não foi possível carregar seus dados. Tente importar seu último backup JSON nas Configurações.";
});
