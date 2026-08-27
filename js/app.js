// js/app.js
import { openDatabase, get, put } from "./data/db.js";
import { seedIfNeeded } from "./data/seed.js";
import { initAutoSync } from "./data/sync.js";
import { isConfigured as supabaseConfigurado } from "./data/supabaseClient.js";
import { getHabito } from "./data/habitos.js";
import { getCheckin } from "./data/checkin.js";
import { getSeriesDoDia } from "./data/historico.js";
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
import { montarWidgetFlutuante } from "./screens/widgetFlutuante.js";
import { definirCronometroFlutuante, limparCronometroFlutuante } from "./lib/timerFlutuante.js";
import { getCardioEmAndamento, limparCardioEmAndamento } from "./data/cardioEmAndamento.js";

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
  const [habitoHoje, checkinHoje, seriesDeHoje] = await Promise.all([getHabito(db, hoje), getCheckin(db, hoje), getSeriesDoDia(db, hoje)]);
  const treinouHoje = seriesDeHoje.length > 0;
  montarPopupPerguntasDiarias(db, hoje, habitoHoje, checkinHoje, treinouHoje).catch((err) =>
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

  if (!document.querySelector(".widget-flutuante")) {
    document.body.appendChild(montarWidgetFlutuante());
  }

  // Abre a tela de cardio já preparada pra minimizar: se a pessoa fechar
  // com o cronômetro rodando, ele não para — vira a bolha flutuante
  // (js/lib/timerFlutuante.js), que sobrevive a qualquer troca de aba
  // porque mora fora de #tab-content. Tocar na bolha reabre esta mesma
  // tela de onde parou, contando pelo relógio de parede (não perde tempo
  // por causa do quanto demorou pra tocar de volta).
  function abrirTelaCardio(opcoes) {
    return trocarConteudo(content, () => montarTelaCardio(db, {
      ...opcoes,
      aoMinimizar: ({ rotulo, alvoTimestamp, duracaoTotalSegundos }) => {
        definirCronometroFlutuante({
          rotulo,
          alvoTimestamp,
          duracaoTotalSegundos,
          aoExpandir: () => {
            limparCronometroFlutuante();
            const restanteInicialSegundos = Math.max(0, Math.round((alvoTimestamp - Date.now()) / 1000));
            abrirTelaCardio({ ...opcoes, restanteInicialSegundos });
          },
        });
      },
    }), { direcao: "avancar" });
  }

  // Minimizar uma sessão de treino não reconstrói nada — só desanexa a raiz
  // dela do #tab-content (o timer/cronômetro dentro continua rodando
  // normalmente, presos ao closure de sessao.js/execucao.js, que nunca é
  // desmontado) e guarda a referência. Reanexar é literalmente devolver o
  // mesmo elemento pro lugar, exatamente como estava. Diferente do cardio,
  // isso não sobrevive o app fechar de verdade — só troca de aba dentro
  // dele, que já é o pedido original ("não consigo sair da tela").
  function abrirSessao(opcoes) {
    // Guarda a referência exata do nó devolvido por trocarConteudo — nunca
    // `content.firstElementChild`, que durante a animação de saída de uma
    // troca anterior pode ainda apontar pra tela velha (ela só sai do DOM
    // quando a spring termina).
    let rootSessaoRef = null;
    const promessa = trocarConteudo(content, () => montarFluxoSessao(db, {
      ...opcoes,
      onMinimizar: (infoTempo) => {
        if (!rootSessaoRef) return;
        rootSessaoRef.remove();
        // Se a bolha for tocada de volta antes da Home terminar de montar
        // (a leitura do banco dela é assíncrona), a Home não pode "vencer"
        // a corrida e aparecer por cima da sessão recém-reaberta — sem essa
        // flag, era exatamente isso que acontecia: a bolha reabria a
        // execução, e um instante depois a Home surgia por cima sozinha,
        // parecendo que o toque na bolha não tinha feito nada.
        let reaberta = false;
        definirCronometroFlutuante({
          rotulo: infoTempo.rotulo,
          alvoTimestamp: infoTempo.alvoTimestamp,
          inicioTimestamp: infoTempo.inicioTimestamp,
          duracaoTotalSegundos: infoTempo.duracaoTotalSegundos,
          aoExpandir: () => {
            reaberta = true;
            limparCronometroFlutuante();
            content.replaceChildren(rootSessaoRef);
            tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === "hoje"));
          },
        });
        // Sem isso #tab-content ficava vazio atrás da bolha — minimizar
        // devolve pra Início, que é o pedido original (poder mexer no
        // resto do app com o cronômetro rodando).
        renderTab("hoje").then(() => {
          if (reaberta) content.replaceChildren(rootSessaoRef);
        });
      },
    }), { direcao: "avancar" });
    promessa.then((elemento) => { rootSessaoRef = elemento; });
    return promessa;
  }

  const renderTab = async (tabName, direcao = "trocarAba") => {
    tabs.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));

    try {
      if (tabName === "hoje") {
        await trocarConteudo(content, () => montarTelaTreino(db, {
          // "Ver mais" num cardio já registrado hoje: mostra o que foi
          // feito (tela de cardio em modo concluído), não a aba de treinos
          // — ir pra "divisao" era um resquício de quando essa tela ainda
          // não existia.
          onIrParaCardio: (cardioLogado) => trocarConteudo(content, () => montarTelaCardio(db, {
            hoje: obterDataLocal(),
            modalidade: cardioLogado.modalidade,
            registroExistente: cardioLogado,
            aoVoltar: () => renderTab("hoje", "voltar"),
          }), { direcao: "avancar" }),
          onComecarTreino: () => abrirSessao({
            onVoltarParaHoje: () => renderTab("hoje", "voltar"),
          }),
          onAbrirDia: (numero) => abrirSessao({
            diaForcado: numero,
            onVoltarParaHoje: () => renderTab("hoje", "voltar"),
          }),
          onAtividadeAdicionada: () => renderTab("hoje"),
          onIniciarCardio: (cardio) => abrirTelaCardio({
            hoje: obterDataLocal(),
            modalidade: cardio.modalidade,
            duracaoMin: cardio.duracaoMin,
            aoVoltar: () => renderTab("hoje", "voltar"),
            aoConcluir: () => renderTab("hoje", "voltar"),
          }),
          // "Começar agora" na folha de nova atividade — mesma tela de
          // cronômetro do cardio prescrito, só que com mesmoDiaDeTreino:
          // false (é uma atividade avulsa, não o cardio do dia de treino).
          onIniciarAtividadeAgora: (atividade) => abrirTelaCardio({
            hoje: obterDataLocal(),
            modalidade: atividade.modalidade,
            duracaoMin: atividade.duracaoMinutos,
            mesmoDiaDeTreino: false,
            aoVoltar: () => renderTab("hoje", "voltar"),
            aoConcluir: () => renderTab("hoje", "voltar"),
          }),
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

  // Recupera um cardio que ficou rodando quando o app fechou de verdade
  // (não só trocou de tela) — sem isso, o progresso salvo em
  // js/data/cardioEmAndamento.js nunca voltava a virar bolha flutuante, e
  // o minuto já feito ficava preso no banco sem ninguém saber que existia.
  (async () => {
    const emAndamento = await getCardioEmAndamento(db).catch(() => null);
    if (!emAndamento) return;
    if (emAndamento.hoje !== obterDataLocal()) {
      await limparCardioEmAndamento(db).catch(() => {});
      return;
    }
    const restanteInicialSegundos = Math.round((emAndamento.alvoTimestamp - Date.now()) / 1000);
    // Cronômetro já tinha zerado enquanto o app estava fechado — não é mais
    // "rodando", não faz sentido a bolha reaparecer travada em 00:00 toda
    // vez que o app abre. Limpa o registro em vez de ressuscitar a bolha.
    // `!(x > 0)` em vez de `x <= 0` também cobre alvoTimestamp inválido/NaN
    // (um registro corrompido não pode deixar a bolha travada pra sempre).
    if (!(restanteInicialSegundos > 0)) {
      await limparCardioEmAndamento(db).catch(() => {});
      return;
    }
    definirCronometroFlutuante({
      rotulo: emAndamento.rotulo,
      alvoTimestamp: emAndamento.alvoTimestamp,
      duracaoTotalSegundos: emAndamento.duracaoTotalSegundos,
      aoExpandir: () => {
        limparCronometroFlutuante();
        abrirTelaCardio({
          hoje: emAndamento.hoje,
          modalidade: emAndamento.modalidade,
          duracaoMin: emAndamento.duracaoMin,
          mesmoDiaDeTreino: emAndamento.mesmoDiaDeTreino,
          restanteInicialSegundos,
          aoVoltar: () => renderTab("hoje", "voltar"),
          aoConcluir: () => renderTab("hoje", "voltar"),
        });
      },
    });
  })();

  renderTab("hoje");
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar o app:", err);
  const content = document.getElementById("tab-content");
  content.textContent = "Não foi possível carregar seus dados. Tente importar seu último backup JSON nas Configurações.";
});
