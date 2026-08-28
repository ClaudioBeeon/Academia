// js/screens/config.js
import { exportarTudo, importarTudo, historicoParaCsv, observacoesTreinoParaMarkdown } from "../data/exportImport.js";
import { getObservacoesTreino } from "../data/observacoesTreino.js";
import { getAll, get, put } from "../data/db.js";
import { getEquipamento, salvarEquipamento } from "../data/equipamento.js";
import { getApiKey, getModelo } from "../ai/gemini.js";
import { salvarGeminiApiKey, salvarGeminiModelo } from "../data/chavesApi.js";
import {
  getUrl, getAnonKey, salvarCredenciais, isConfigured,
  cadastrar, entrar, entrarComGoogle, sair, getUsuario,
} from "../data/supabaseClient.js";
import { flushSyncQueue, pullFromSupabase, pendentesNaFila, initAutoSync } from "../data/sync.js";
import { listarPerfisDisponiveis, semearPerfilNomeado } from "../data/seed.js";
import { getMedidas } from "../data/medidas.js";
import { calcularDataReavaliacaoSugerida, devePedirReavaliacaoFase, deveLembrarFotosMedidas } from "../engine/lembretes.js";
import { statusPermissao, pedirPermissaoNotificacao } from "../lib/notificacoes.js";
import { limparCronometroFlutuante } from "../lib/timerFlutuante.js";
import { limparCardioEmAndamento } from "../data/cardioEmAndamento.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { DIAS_SEQUENCIA, obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";

export async function montarTelaConfig(db, { onAbrirBiblioteca } = {}) {
  const root = document.createElement("div");
  root.className = "tela-config";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Configurações</div><div class="day-title">Config</div></div>`;
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

  main.appendChild(criarLinkAcao("Exportar observações de treino (.md)", async () => {
    // Sem data no nome de propósito — é um log corrido (todas as
    // observações, não só as de hoje), então cada exportação deve
    // sobrescrever o mesmo arquivo ao salvar na mesma pasta, não acumular.
    const observacoes = await getObservacoesTreino(db);
    baixarArquivo("observacoes-treino.md", observacoesTreinoParaMarkdown(observacoes), "text/markdown");
  }));

  main.appendChild(criarSecaoBolhaFlutuante(db));
  main.appendChild(await criarSecaoDiaDoCiclo(db));
  main.appendChild(await criarSecaoEquipamento(db));
  main.appendChild(await criarSecaoSupabase(db));
  main.appendChild(criarSecaoGemini(db));
  main.appendChild(criarSecaoLembretes());
  main.appendChild(await criarSecaoSugestoes(db));

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

// Botão de emergência: limpa a bolha do cronômetro flutuante (o estado em
// memória e o registro de cardio persistido) na hora, independente de
// qual seja a causa dela estar travada. Existe pra dar um jeito imediato
// de sair do problema sem depender de reinstalar o app ou esperar uma
// correção — ver commit "Corrige bolha travada em 00:00".
function criarSecaoBolhaFlutuante(db) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Bolha do cronômetro travada?</div></div>
    <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:8px;">
      <button type="button" class="swap-pill limpar-bolha-btn" style="width:100%;">Limpar bolha flutuante</button>
      <div class="prev-hint limpar-bolha-status"></div>
    </div>
  `;
  const status = card.querySelector(".limpar-bolha-status");
  card.querySelector(".limpar-bolha-btn").addEventListener("click", async () => {
    limparCronometroFlutuante();
    await limparCardioEmAndamento(db).catch(() => {});
    status.textContent = "Limpo — a bolha deve sumir agora.";
  });
  return card;
}

// "Qual dia do ciclo estou" fica só localmente (js/data/sequenciaSemanal.js
// → store "config") — de propósito nunca sincroniza (mesmo lugar guarda a
// chave da IA). Isso significa que reinstalar o app (ex.: pra forçar uma
// atualização no iOS) apaga esse ponteiro específico mesmo com o resto do
// progresso voltando certinho do Supabase — sem um jeito manual de corrigir,
// a pessoa fica presa no dia 1 até destravar sozinha treinando de novo.
async function criarSecaoDiaDoCiclo(db) {
  const hoje = dataDeHoje();
  const ultimoRegistro = await getUltimoDiaRegistrado(db);
  const diaAtual = determinarDiaDaSessao(ultimoRegistro, hoje);

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Dia do ciclo</div></div>
    <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:8px;">
      <div class="prev-hint" style="padding:0;">O app está te mostrando como "hoje" o <b>dia ${diaAtual}</b> — ${obterDiaPorNumero(diaAtual).titulo}. Se estiver errado (ex.: depois de reinstalar o app), corrija abaixo.</div>
      <div class="set-field">
        <label>Dia correto do ciclo
          <select class="dia-ciclo-select">
            ${DIAS_SEQUENCIA.map((d) => `<option value="${d.numero}"${d.numero === diaAtual ? " selected" : ""}>Dia ${d.numero} — ${d.titulo}</option>`).join("")}
          </select>
        </label>
      </div>
      <button type="button" class="swap-pill dia-ciclo-salvar" style="width:100%;">Corrigir</button>
      <div class="prev-hint dia-ciclo-status" style="padding:0;"></div>
    </div>
  `;
  const status = card.querySelector(".dia-ciclo-status");
  card.querySelector(".dia-ciclo-salvar").addEventListener("click", async () => {
    const novoDia = Number(card.querySelector(".dia-ciclo-select").value);
    // concluido:false — corrige só qual dia é "hoje", não finge que a
    // sessão de hoje já foi feita.
    await registrarDiaDaSessao(db, novoDia, hoje, false);
    status.textContent = `Corrigido — "hoje" agora é o dia ${novoDia}.`;
  });
  return card;
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

// Sincronização automática com o Supabase — o app funciona 100% sem isso
// configurado (regra permanente do projeto: sem sinal não pode travar o
// registro de treino). Esta seção só existe pra quem quiser backup na nuvem
// e uso em mais de um aparelho.
async function criarSecaoSupabase(db) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Sincronização (Supabase)</div></div>
    <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:14px;">
      <div class="prev-hint">
        Guarda uma cópia de tudo na nuvem e mantém o app igual em mais de um aparelho.
        O app continua funcionando 100% sem isso — o banco local é sempre a fonte principal,
        isto aqui só replica.
      </div>

      <details class="creds-avancado">
        <summary>Usar outro projeto Supabase (avançado)</summary>
        <form class="creds-form" style="display:grid; gap:10px; margin-top:10px;">
          <div class="set-field">
            <label>URL do projeto Supabase<input name="url" type="text" placeholder="https://xxxx.supabase.co" /></label>
          </div>
          <div class="set-field">
            <label>Chave anon (pública) do projeto<input name="anonKey" type="password" /></label>
          </div>
          <button type="submit" class="swap-pill">Salvar credenciais</button>
        </form>
      </details>

      <div class="auth-secao"></div>
      <div class="escolha-perfil-secao"></div>

      <div class="prev-hint sync-status"></div>
      <button type="button" class="swap-pill sync-agora-btn">Sincronizar agora</button>
    </div>
  `;

  const formCreds = card.querySelector(".creds-form");
  formCreds.url.value = getUrl();
  formCreds.anonKey.value = getAnonKey();

  const authSecao = card.querySelector(".auth-secao");
  const escolhaPerfilSecao = card.querySelector(".escolha-perfil-secao");
  const status = card.querySelector(".sync-status");
  const botaoSync = card.querySelector(".sync-agora-btn");

  // Seletor de perfil "estilo Netflix": aparece só quando a conta que acabou
  // de logar não trouxe nada do servidor (recebidos === 0) — sinal de que é
  // a primeira vez que essa conta é usada. Escolher troca perfil/protocolo/
  // ficha/dietaBase pelos arquivos do perfil escolhido (data/perfis.json) e
  // sobe isso pra nuvem, sem precisar exportar/importar backup manualmente.
  async function montarEscolhaDePerfil() {
    let perfis;
    try {
      perfis = await listarPerfisDisponiveis();
    } catch (err) {
      console.error("Falha ao listar perfis disponíveis:", err);
      return;
    }
    escolhaPerfilSecao.innerHTML = `
      <div class="prev-hint">Conta nova — qual perfil de treino é este aparelho?</div>
      <div class="escolha-perfil-botoes" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
    `;
    const botoesEl = escolhaPerfilSecao.querySelector(".escolha-perfil-botoes");
    perfis.forEach((perfil) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "swap-pill";
      botao.textContent = perfil.nome;
      botao.addEventListener("click", async () => {
        botao.disabled = true;
        status.textContent = `Aplicando o perfil de ${perfil.nome}...`;
        try {
          await semearPerfilNomeado(db, perfil.id);
          await flushSyncQueue(db);
          escolhaPerfilSecao.innerHTML = "";
        } catch (err) {
          console.error("Falha ao aplicar o perfil escolhido:", err);
          status.textContent = "Não foi possível aplicar este perfil. Tente novamente.";
          botao.disabled = false;
          return;
        }
        await atualizarStatus();
      });
      botoesEl.appendChild(botao);
    });
  }

  async function atualizarStatus() {
    if (!isConfigured()) {
      status.textContent = "Configure a URL e a chave acima pra ativar.";
      botaoSync.style.display = "none";
      return;
    }
    const usuario = await getUsuario();
    const pendentes = await pendentesNaFila(db);
    botaoSync.style.display = usuario ? "" : "none";
    if (!usuario) {
      status.textContent = "Configurado, mas sem login — entre abaixo pra começar a sincronizar.";
    } else if (pendentes > 0) {
      status.textContent = `${usuario.email} · ${pendentes} alteração${pendentes > 1 ? "ões" : ""} aguardando envio.`;
    } else {
      status.textContent = `${usuario.email} · tudo sincronizado.`;
    }
  }

  function montarFormAuth() {
    authSecao.innerHTML = `
      <button type="button" class="swap-pill google-btn" style="width:100%;">Entrar com Google</button>
      <div class="prev-hint" style="text-align:center; margin:8px 0;">ou com e-mail e senha</div>
      <form class="auth-form" style="display:grid; gap:10px;">
        <div class="set-field">
          <label>E-mail<input name="email" type="email" autocomplete="username" /></label>
        </div>
        <div class="set-field">
          <label>Senha<input name="senha" type="password" autocomplete="current-password" /></label>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="submit" class="swap-pill entrar-btn" style="flex:1;">Entrar</button>
          <button type="button" class="swap-pill cadastrar-btn" style="flex:1;">Criar conta</button>
        </div>
        <div class="prev-hint auth-erro"></div>
      </form>
    `;
    const formAuth = authSecao.querySelector(".auth-form");
    const erro = authSecao.querySelector(".auth-erro");

    // signInWithOAuth redireciona a página inteira pro Google e volta —
    // não há nada pra atualizar aqui depois do clique, só tratar se o
    // Supabase recusar antes mesmo de redirecionar (provider Google
    // desativado, por exemplo).
    authSecao.querySelector(".google-btn").addEventListener("click", async () => {
      erro.textContent = "";
      try {
        await entrarComGoogle();
      } catch (err) {
        erro.textContent = err.message ?? "Não foi possível entrar com Google.";
      }
    });

    formAuth.addEventListener("submit", async (event) => {
      event.preventDefault();
      erro.textContent = "Entrando...";
      try {
        await entrar(formAuth.email.value.trim(), formAuth.senha.value);
        erro.textContent = "";
        await aposLogin();
      } catch (err) {
        erro.textContent = err.message ?? "Não foi possível entrar.";
      }
    });

    authSecao.querySelector(".cadastrar-btn").addEventListener("click", async () => {
      erro.textContent = "Criando conta...";
      try {
        await cadastrar(formAuth.email.value.trim(), formAuth.senha.value);
        erro.textContent = "Conta criada. Se o projeto exigir confirmação por e-mail, confirme antes de entrar.";
      } catch (err) {
        erro.textContent = err.message ?? "Não foi possível criar a conta.";
      }
    });
  }

  function montarBotaoSair(usuario) {
    authSecao.innerHTML = "";
    const linha = document.createElement("div");
    linha.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:10px;";
    linha.innerHTML = `<span>Conectado como <b>${usuario.email}</b></span>`;
    const botaoSair = document.createElement("button");
    botaoSair.type = "button";
    botaoSair.className = "swap-pill";
    botaoSair.textContent = "Sair";
    botaoSair.addEventListener("click", async () => {
      await sair();
      montarFormAuth();
      await atualizarStatus();
    });
    linha.appendChild(botaoSair);
    authSecao.appendChild(linha);
  }

  // Primeiro login num aparelho novo: puxa tudo que já existe no servidor
  // antes de ativar o envio automático, senão o dispositivo vazio empurraria
  // "apagar tudo" pro servidor por engano.
  async function aposLogin() {
    status.textContent = "Trazendo dados do servidor...";
    const { recebidos } = await pullFromSupabase(db);
    initAutoSync(db);
    await flushSyncQueue(db);
    const usuario = await getUsuario();
    if (usuario) montarBotaoSair(usuario);
    // recebidos === 0 é o sinal de conta nova: nada nesta conta foi
    // sincronizado antes, então o que está local ainda é só o perfil
    // padrão auto-semeado — a pessoa escolhe o dela em vez de ficar com ele.
    if (recebidos === 0) await montarEscolhaDePerfil();
    await atualizarStatus();
  }

  formCreds.addEventListener("submit", async (event) => {
    event.preventDefault();
    salvarCredenciais(formCreds.url.value.trim(), formCreds.anonKey.value.trim());
    montarFormAuth();
    await atualizarStatus();
  });

  botaoSync.addEventListener("click", async () => {
    status.textContent = "Sincronizando...";
    await flushSyncQueue(db);
    await pullFromSupabase(db);
    await atualizarStatus();
  });

  if (isConfigured()) {
    const usuario = await getUsuario();
    if (usuario) montarBotaoSair(usuario);
    else montarFormAuth();
  }
  await atualizarStatus();

  return card;
}

function criarSecaoGemini(db) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Chave de IA (Gemini)</div></div>
    <form class="sets gemini-form" style="padding:0 18px 18px;">
      <div class="set-field" style="grid-column:1/-1;">
        <label>Chave de API — sincroniza pela sua conta (se estiver logado em Config), sobrevive a reinstalar o app<input name="chave" type="password" /></label>
      </div>
      <div class="set-field" style="grid-column:1/-1;">
        <label>Modelo — troque se a cota grátis do padrão acabar (veja em ai.google.dev/gemini-api/docs/models)<input name="modelo" type="text" placeholder="gemini-3.5-flash-lite" /></label>
      </div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
      <div class="prev-hint gemini-status" style="grid-column:1/-1;"></div>
    </form>
  `;
  const form = card.querySelector(".gemini-form");
  form.chave.value = getApiKey();
  form.modelo.value = getModelo();
  const status = card.querySelector(".gemini-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await salvarGeminiApiKey(db, form.chave.value.trim());
    await salvarGeminiModelo(db, form.modelo.value.trim());
    status.textContent = "Salvo.";
  });
  return card;
}

const TEXTO_STATUS_PERMISSAO = {
  granted: "Ativado.",
  denied: "Bloqueado — reative nas permissões do navegador/site pra receber lembretes.",
  default: "Ainda não ativado.",
  indisponivel: "Notificações não são suportadas neste navegador.",
};

function criarSecaoLembretes() {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Lembretes</div></div>
    <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:10px;">
      <div class="prev-hint">Creatina do dia, foto/medida a cada 2 semanas e reavaliação de fase — só chegam enquanto o app estiver aberto (ou for reaberto), sem servidor de push não dá pra garantir aviso com o app fechado.</div>
      <button type="button" class="swap-pill ativar-lembretes-btn"></button>
      <div class="prev-hint lembretes-status"></div>
    </div>
  `;
  const botao = card.querySelector(".ativar-lembretes-btn");
  const status = card.querySelector(".lembretes-status");

  const atualizar = () => {
    const permissao = statusPermissao();
    status.textContent = TEXTO_STATUS_PERMISSAO[permissao] ?? "";
    botao.disabled = permissao === "granted" || permissao === "denied" || permissao === "indisponivel";
    botao.textContent = permissao === "granted" ? "Ativado" : "Ativar lembretes";
  };
  atualizar();

  botao.addEventListener("click", async () => {
    await pedirPermissaoNotificacao();
    atualizar();
  });

  return card;
}

function obterDataLocal() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

async function criarSecaoSugestoes(db) {
  const hoje = obterDataLocal();
  const perfil = await get(db, "perfil", "1.0");
  const medidas = await getMedidas(db);

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Sugestões</div></div>`;

  const corpo = document.createElement("div");
  corpo.className = "sets";
  corpo.style.cssText = "padding:0 18px 18px; display:flex; flex-direction:column; gap:14px;";
  card.appendChild(corpo);

  // --- Lembretes ---
  const ultimaMedida = medidas.length > 0 ? [...medidas].sort((a, b) => b.data.localeCompare(a.data))[0].data : undefined;
  if (deveLembrarFotosMedidas(ultimaMedida, hoje)) {
    const aviso = document.createElement("div");
    aviso.className = "prev-hint";
    aviso.textContent = "📸 Já faz 2 semanas (ou mais) desde a última foto/medida de cintura — vale registrar em Evolução. Tendência de semanas conta mais que um número isolado.";
    corpo.appendChild(aviso);
  }

  // --- Reavaliação de fase ---
  if (perfil?.fase) {
    const dataInicioFase = perfil.fase.historico?.at(-1)?.data ?? perfil.dataAtualizacao;
    const dataReavaliacaoAtual = perfil.fase.dataReavaliacao ?? calcularDataReavaliacaoSugerida(dataInicioFase);

    if (devePedirReavaliacaoFase(dataReavaliacaoAtual, hoje)) {
      const aviso = document.createElement("div");
      aviso.className = "prev-hint";
      aviso.textContent = `🔁 Hora de reavaliar a fase "${perfil.fase.atual}" — confira a tendência de bioimpedância e fotos das últimas semanas antes de decidir manter, ajustar volume ou trocar de fase.`;
      corpo.appendChild(aviso);
    }

    const reavaliacaoForm = document.createElement("form");
    reavaliacaoForm.className = "sets";
    reavaliacaoForm.style.cssText = "display:contents;";
    reavaliacaoForm.innerHTML = `
      <div class="set-field" style="grid-column:1/-1;">
        <label>Data de reavaliação da fase "${perfil.fase.atual}" (sugestão: 6-8 semanas do início)<input name="dataReavaliacao" type="date" /></label>
      </div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar data</button>
      <div class="prev-hint reavaliacao-status" style="grid-column:1/-1;"></div>
    `;
    reavaliacaoForm.querySelector('input[name="dataReavaliacao"]').value = dataReavaliacaoAtual;
    const status = reavaliacaoForm.querySelector(".reavaliacao-status");
    reavaliacaoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const novaData = reavaliacaoForm.dataReavaliacao.value;
      const perfilAtualizado = { ...perfil, fase: { ...perfil.fase, dataReavaliacao: novaData } };
      await put(db, "perfil", perfilAtualizado);
      status.textContent = "Salvo.";
    });
    corpo.appendChild(reavaliacaoForm);
  }

  // --- Conteúdo informativo (estático, só leitura) ---
  corpo.appendChild(criarBlocoInformativo("Curiosidades contra-intuitivas", [
    "Treinar um músculo 3x/semana não é \"melhor\" que 1x, se o volume total for igual — frequência distribui o mesmo volume com mais qualidade, não é estímulo extra por si só.",
    "Pegar pesado não é necessário: 10-15 repetições bem executadas rendem o mesmo que 5 repetições pesadas, contanto que o esforço seja real.",
    "Máquina não é \"menos eficiente\" que peso livre — não há diferença de hipertrofia detectada entre as duas.",
    "Abdômen treinado todo dia não \"define a barriga\" mais rápido — um estudo de 6 semanas, 5x/semana, 7 exercícios de abdômen, não mudou nem a gordura abdominal nem a circunferência.",
    "Chegar exatamente na falha não é comprovadamente melhor que \"quase falha\" — falha total custa mais recuperação sem entregar mais resultado proporcional.",
  ]));

  corpo.appendChild(criarBlocoInformativo("Por que o app decide assim", [
    "Déficit moderado, não agressivo: acelera perda de peso (água + músculo + gordura juntos), não de gordura especificamente — e dieta muito restritiva costuma durar semanas, não meses.",
    "Peito em volume intermediário durante a fase de definição: déficit calórico limita quanto o corpo constrói músculo ao mesmo tempo — o volume reflete essa realidade.",
    "Bíceps virou prioridade 2 porque foi declarado como objetivo real — antes disso recebia só estímulo indireto, suficiente pra manutenção, não pra crescimento visível.",
    "A IA só interpreta, nunca decide volume, progressão, deload ou meta calórica — decisão de treino precisa ser auditável e reproduzível, mesma situação sempre gera a mesma resposta.",
    "PWA em vez de app nativo: o único ganho real de nativo seria notificação na tela bloqueada, que não faz falta aqui — PWA entrega o resto (offline, ícone, tela cheia) sem o custo de Mac + Xcode + conta Apple.",
    "Abdômen nunca vira dia isolado: perda de gordura localizada não existe — é o resultado mais replicado dessa área da ciência do exercício.",
  ]));

  corpo.appendChild(criarBlocoInformativo("Expectativa de tempo realista", [
    "Mudanças visíveis (foto, roupa) costumam levar 8-12 semanas, mesmo com tudo certo — antes disso o progresso é majoritariamente invisível.",
    "Força sobe mais rápido que estética no início — é adaptação neural, o sistema nervoso ficando mais eficiente antes do crescimento muscular de fato.",
    "Bioimpedância oscila por água — só a tendência de 3-4 semanas conta, não uma leitura isolada.",
    "Dado o histórico de pouca consistência, manter a rotina por 4 semanas seguidas já é um resultado mensurável, antes mesmo de qualquer mudança física aparecer.",
  ]));

  return card;
}

function criarBlocoInformativo(titulo, itens) {
  const bloco = document.createElement("details");
  bloco.style.cssText = "border-top:1px solid var(--line); padding-top:12px;";
  const resumo = document.createElement("summary");
  resumo.style.cssText = "cursor:pointer; font-weight:600;";
  resumo.textContent = titulo;
  bloco.appendChild(resumo);
  const lista = document.createElement("ul");
  lista.style.cssText = "margin:10px 0 0; padding-left:18px; display:flex; flex-direction:column; gap:8px;";
  for (const item of itens) {
    const li = document.createElement("li");
    li.className = "prev-hint";
    li.textContent = item;
    lista.appendChild(li);
  }
  bloco.appendChild(lista);
  return bloco;
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
      <label>Peso da barra (kg)<input name="pesoBarra" type="number" step="0.5" /></label>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label>Anilhas disponíveis (kg, separadas por vírgula)<input name="anilhas" type="text" /></label>
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
