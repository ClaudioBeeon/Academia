// js/app.js
import { openDatabase, get, put } from "./data/db.js";
import { seedIfNeeded } from "./data/seed.js";
import { initAutoSync } from "./data/sync.js";
import { isConfigured as supabaseConfigurado } from "./data/supabaseClient.js";
import { getHabito } from "./data/habitos.js";
import { getCheckin } from "./data/checkin.js";
import { montarPopupPerguntasDiarias } from "./screens/perguntasDiarias.js";
import { getMedidas } from "./data/medidas.js";
import { deveLembrarCreatina, deveLembrarFotosMedidas, devePedirReavaliacaoFase, calcularDataReavaliacaoSugerida } from "./engine/lembretes.js";
import { permissaoConcedida, mostrarNotificacao } from "./lib/notificacoes.js";
import { montarTelaTreino } from "./screens/treino.js";
import { montarFluxoSessao } from "./screens/sessao.js";
import { montarTelaBiblioteca } from "./screens/biblioteca.js";
import { montarTelaConfig } from "./screens/config.js";
import { montarTelaEvolucao } from "./screens/evolucao.js";
import { montarTelaHistoricoSessoes } from "./screens/historicoSessoes.js";
import { montarTelaDivisao } from "./screens/divisao.js";
import { montarTelaDieta } from "./screens/dieta.js";
import { montarTelaCardio } from "./screens/cardioTimer.js";
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

  // Sem credenciais salvas isso é praticamente um no-op — o gancho fica
  // registrado, mas isConfigured() barra tudo antes de tocar rede. Nunca
  // atrasa a abertura do app: initAutoSync() não é awaited.
  if (supabaseConfigurado()) initAutoSync(db);

  renderShell(db);
  verificarEEnviarLembretes(db).catch((err) => console.error("Falha ao verificar lembretes:", err));

  // Dispara uma vez por abertura do app (não por troca de aba), com o que
  // ainda não foi respondido hoje. Reaparece na próxima abertura enquanto
  // sobrar pergunta, e recomeça sozinho quando o registro do dia muda à
  // meia-noite — não precisa de nenhum agendamento, só de ler a data local.
  const hoje = obterDataLocal();
  const [habitoHoje, checkinHoje] = await Promise.all([getHabito(db, hoje), getCheckin(db, hoje)]);
  montarPopupPerguntasDiarias(db, hoje, habitoHoje, checkinHoje).catch((err) =>
    console.error("Falha ao montar o popup de perguntas diárias:", err)
  );
}

function obterDataLocal() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

// Limitação real de PWA sem servidor de push: isso só dispara enquanto o
// app está aberto (ou é reaberto), nunca com o app fechado em background —
// documentado em js/lib/notificacoes.js. Verifica no máximo 1x/dia (marcador
// em config) pra não repetir notificação a cada troca de aba.
async function verificarEEnviarLembretes(db) {
  if (!permissaoConcedida()) return;

  const hoje = obterDataLocal();
  const marcador = await get(db, "config", "lembretesEnviadosEm");
  if (marcador?.valor === hoje) return;

  const [habitoHoje, medidas, perfil] = await Promise.all([
    getHabito(db, hoje),
    getMedidas(db),
    get(db, "perfil", "1.0"),
  ]);

  if (deveLembrarCreatina(habitoHoje)) {
    await mostrarNotificacao("Creatina hoje?", { body: "Ainda não marcada — um toque em Início pra registrar.", tag: "lembrete-creatina" });
  }

  const ultimaMedida = medidas.length > 0 ? [...medidas].sort((a, b) => b.data.localeCompare(a.data))[0].data : undefined;
  if (deveLembrarFotosMedidas(ultimaMedida, hoje)) {
    await mostrarNotificacao("Hora da foto/medida de cintura", { body: "Já fazem 2 semanas ou mais desde o último registro.", tag: "lembrete-medidas" });
  }

  if (perfil?.fase) {
    const dataInicioFase = perfil.fase.historico?.at(-1)?.data ?? perfil.dataAtualizacao;
    const dataReavaliacao = perfil.fase.dataReavaliacao ?? calcularDataReavaliacaoSugerida(dataInicioFase);
    if (devePedirReavaliacaoFase(dataReavaliacao, hoje)) {
      await mostrarNotificacao("Hora de reavaliar a fase", { body: `Confira a tendência das últimas semanas antes de decidir sobre a fase "${perfil.fase.atual}".`, tag: "lembrete-fase" });
    }
  }

  await put(db, "config", { chave: "lembretesEnviadosEm", valor: hoje });
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
          onAbrirDia: (numero) => trocarConteudo(content, () => montarFluxoSessao(db, {
            diaForcado: numero,
            onVoltarParaHoje: () => renderTab("hoje", "voltar"),
          }), { direcao: "avancar" }),
          onAtividadeAdicionada: () => renderTab("hoje"),
          onIniciarCardio: (cardio) => trocarConteudo(content, () => montarTelaCardio(db, {
            hoje: obterDataLocal(),
            modalidade: cardio.modalidade,
            duracaoMin: cardio.duracaoMin,
            aoVoltar: () => renderTab("hoje", "voltar"),
            aoConcluir: () => renderTab("hoje", "voltar"),
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
        await trocarConteudo(content, () => montarTelaEvolucao(db, {
          onAbrirHistoricoTreinos: () => trocarConteudo(content, () => montarTelaHistoricoSessoes(db, {
            aoVoltar: () => renderTab("evolucao", "voltar"),
          }), { direcao: "avancar" }),
        }), { direcao });
        return;
      }
      if (tabName === "divisao") {
        await trocarConteudo(content, () => montarTelaDivisao(db, {
          onAbrirHistoricoTreinos: () => trocarConteudo(content, () => montarTelaHistoricoSessoes(db, {
            aoVoltar: () => renderTab("divisao", "voltar"),
          }), { direcao: "avancar" }),
        }), { direcao });
        return;
      }
      if (tabName === "dieta") {
        await trocarConteudo(content, () => montarTelaDieta(db), { direcao });
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
