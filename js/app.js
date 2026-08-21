// js/app.js
import { openDatabase } from "./data/db.js";
import { seedIfNeeded } from "./data/seed.js";
import { montarTelaTreino } from "./screens/treino.js";
import { montarFluxoSessao } from "./screens/sessao.js";
import { montarTelaBiblioteca } from "./screens/biblioteca.js";
import { montarTelaConfig } from "./screens/config.js";
import { montarTelaEvolucao } from "./screens/evolucao.js";
import { montarTelaDivisao } from "./screens/divisao.js";
import { trocarConteudo } from "./screens/transicaoTela.js";

function criarMensagem(texto) {
  const div = document.createElement("div");
  div.className = "vazio";
  div.textContent = texto;
  return div;
}

async function bootstrap() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.error("Falha ao registrar service worker:", err);
    });
  }

  // iOS Safari só aplica :active em elementos sem handler de toque nativo
  // (divs/sections com onclick, não <button>) se existir algum listener de
  // touchstart no documento — sem isso, o feedback de toque via CSS não
  // aparece no iPhone.
  document.addEventListener("touchstart", () => {}, { passive: true });

  const db = await openDatabase();
  await seedIfNeeded(db);

  renderShell(db);
}

function renderShell(db) {
  const content = document.getElementById("tab-content");
  const tabs = document.querySelectorAll("#tab-bar button");

  const renderTab = async (tabName, direcao = "trocarAba") => {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));

    try {
      if (tabName === "hoje") {
        await trocarConteudo(content, () => montarTelaTreino(db, {
          onIrParaCardio: () => renderTab("divisao"),
          onComecarTreino: () => trocarConteudo(content, () => montarFluxoSessao(db, {
            onVoltarParaHoje: () => renderTab("hoje", "voltar"),
          }), { direcao: "avancar" }),
        }), { direcao });
        return;
      }
      if (tabName === "config") {
        await trocarConteudo(content, () => montarTelaConfig(db, {
          onAbrirBiblioteca: () => trocarConteudo(content, () => montarTelaBiblioteca(db, { aoVoltar: () => renderTab("config", "voltar") }), { direcao: "avancar" }),
        }), { direcao });
        return;
      }
      if (tabName === "evolucao") {
        await trocarConteudo(content, () => montarTelaEvolucao(db), { direcao });
        return;
      }
      if (tabName === "divisao") {
        await trocarConteudo(content, () => montarTelaDivisao(db), { direcao });
        return;
      }
      await trocarConteudo(content, () => criarMensagem(`Tela "${tabName}" ainda não implementada (vem depois).`), { direcao });
    } catch (err) {
      console.error(`Falha ao renderizar a aba "${tabName}":`, err);
      await trocarConteudo(content, () => criarMensagem("Não foi possível carregar esta tela. Tente novamente ou importe seu último backup nas Configurações."), { direcao });
    }
  };

  tabs.forEach((button) => {
    button.addEventListener("click", () => { renderTab(button.dataset.tab); });
  });

  renderTab("hoje");
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar o app:", err);
  const content = document.getElementById("tab-content");
  content.textContent = "Não foi possível carregar seus dados. Tente importar seu último backup JSON nas Configurações.";
});
