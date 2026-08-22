// js/screens/config.js
import { exportarTudo, importarTudo, historicoParaCsv } from "../data/exportImport.js";
import { getAll, get, put } from "../data/db.js";
import { getEquipamento, salvarEquipamento } from "../data/equipamento.js";
import { getApiKey, salvarApiKey } from "../ai/gemini.js";
import { getMedidas } from "../data/medidas.js";
import { calcularDataReavaliacaoSugerida, devePedirReavaliacaoFase, deveLembrarFotosMedidas } from "../engine/lembretes.js";
import { statusPermissao, pedirPermissaoNotificacao } from "../lib/notificacoes.js";

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

  main.appendChild(await criarSecaoEquipamento(db));
  main.appendChild(criarSecaoGemini());
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

function criarSecaoGemini() {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Chave de IA (Gemini)</div></div>
    <form class="sets gemini-form" style="padding:0 18px 18px;">
      <div class="set-field" style="grid-column:1/-1;">
        <label>Chave de API — salva só neste dispositivo, nunca enviada a outro lugar</label>
        <input name="chave" type="password" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
      </div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar chave</button>
      <div class="prev-hint gemini-status" style="grid-column:1/-1;"></div>
    </form>
  `;
  const form = card.querySelector(".gemini-form");
  form.chave.value = getApiKey();
  const status = card.querySelector(".gemini-status");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    salvarApiKey(form.chave.value.trim());
    status.textContent = form.chave.value.trim() ? "Chave salva." : "Chave removida.";
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
        <label>Data de reavaliação da fase "${perfil.fase.atual}" (sugestão: 6-8 semanas do início)</label>
        <input name="dataReavaliacao" type="date" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
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
