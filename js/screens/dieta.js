// js/screens/dieta.js
import { get, put } from "../data/db.js";
import { getDietaBase, getSelecoesDoDia, salvarSelecaoRefeicao, adicionarAlimentoPessoal, calcularTotalDoDia, adicionarRefeicao, removerRefeicao, adicionarOpcaoRefeicao, removerOpcaoRefeicao } from "../data/dieta.js";
import { getMedidas } from "../data/medidas.js";
import { getCheckin, registrarCheckin } from "../data/checkin.js";
import { calcularTMB, calcularMetaCalorica, checarAdequacaoNutricional, calcularMetaProteina, avaliarProteinaDoDia } from "../engine/nutricao.js";
import { interpretarComida, gerarResumoNutricionalDoDia, getApiKey } from "../ai/gemini.js";

function obterDataLocal() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

// Proteína ganha barra própria em vez de virar mais um alerta: em déficit é o
// número que mais protege massa magra e precisa estar visível todo dia, não só
// nos dias em que falha.
function montarBarraProteina(proteinaG, metaProteina) {
  if (!metaProteina) return "";
  const avaliacao = avaliarProteinaDoDia({ proteinaG, metaProteina });
  const ok = avaliacao?.status === "ok";
  const percentual = Math.min(100, (proteinaG / metaProteina.min_g) * 100).toFixed(0);
  const nota = ok
    ? "Meta batida — é isso que protege sua massa magra no déficit."
    : `Faltam ${avaliacao?.faltam_g ?? metaProteina.min_g}g. Em déficit, proteína abaixo da meta é o que mais custa massa magra.`;
  return `
    <div class="meta-proteina" style="grid-column:1/-1;">
      <div class="meta-proteina-topo">
        <span>Proteína</span>
        <b>${proteinaG.toFixed(0)}g <s>/ ${metaProteina.min_g}–${metaProteina.max_g}g</s></b>
      </div>
      <div class="meta-proteina-trilho">
        <div class="meta-proteina-barra ${ok ? "ok" : "abaixo"}" style="width:${percentual}%"></div>
      </div>
      <div class="meta-proteina-nota">${nota}</div>
    </div>`;
}

// Único intervalo vivo por vez: se a aba Dieta for remontada (troca de aba
// e volta), o intervalo anterior é limpo antes de criar outro, pra não
// acumular checagens em segundo plano.
let intervaloChecagemDeVirada = null;

export async function montarTelaDieta(db) {
  const root = document.createElement("div");
  root.className = "tela-dieta";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Alimentação</div><div class="day-title">Dieta</div></div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  let dataDeHoje = obterDataLocal();
  let dietaBase = await getDietaBase(db);
  let contextoNutricionalAtual = null;
  // Reatribuída depois que o card de resumo é montado (mais abaixo) — até lá
  // é no-op, porque redesenharTotaisEAlertas() já roda antes disso na carga
  // inicial da tela.
  let agendarResumoAutomatico = () => {};

  if (!dietaBase) {
    main.innerHTML = `<p class="vazio">Sem dieta base cadastrada ainda.</p>`;
    return root;
  }

  let selecoes = await getSelecoesDoDia(db, dataDeHoje);

  const refeicoesCard = document.createElement("section");
  refeicoesCard.className = "exercise-card";
  refeicoesCard.innerHTML = `<div class="exercise-head"><div class="exercise-name">Hoje</div></div>`;
  const refeicoesBody = document.createElement("div");
  refeicoesBody.className = "sets";
  refeicoesBody.style.cssText = "padding:0 18px 18px; display:flex; flex-direction:column; gap:14px;";
  refeicoesCard.appendChild(refeicoesBody);
  main.appendChild(refeicoesCard);

  const totaisCard = document.createElement("section");
  totaisCard.className = "exercise-card";
  main.appendChild(totaisCard);

  const alertasCard = document.createElement("section");
  alertasCard.className = "exercise-card";
  main.appendChild(alertasCard);

  const perfis = await get(db, "perfil", "1.0");
  const perfil = perfis;

  async function redesenharTotaisEAlertas() {
    const { total, detalhePorRefeicao, alimentosPessoaisDoDia } = calcularTotalDoDia(dietaBase, selecoes, dataDeHoje);

    totaisCard.innerHTML = `
      <div class="exercise-head"><div class="exercise-name">Total estimado do dia</div></div>
      <div class="stats-grid" style="padding:0 18px 18px;">
        <div class="stat-tile"><b>${Math.round(total.kcal)}</b><span>kcal</span></div>
        <div class="stat-tile"><b>${total.proteina_g.toFixed(0)}g</b><span>Proteína</span></div>
        <div class="stat-tile"><b>${total.carboidrato_g.toFixed(0)}g</b><span>Carboidrato</span></div>
        <div class="stat-tile"><b>${total.gordura_g.toFixed(1)}g</b><span>Gordura</span></div>
      </div>
      ${detalhePorRefeicao.some((r) => !r.confirmada)
        ? `<div class="prev-hint" style="padding:0 18px 14px;">Refeições sem marcação usam a primeira opção como estimativa — confirme o que você realmente comeu acima.</div>`
        : ""}
      ${alimentosPessoaisDoDia.length
        ? `<div class="prev-hint" style="padding:0 18px 14px;">Também contando hoje, fora da dieta base: ${alimentosPessoaisDoDia.map((a) => a.nome).join(", ")}.</div>`
        : ""}
    `;

    alertasCard.innerHTML = "";
    // Proteína só depende do peso, então é montada fora da porteira da idade:
    // a meta calórica precisa de idade (Mifflin-St Jeor), a de proteína não, e
    // em déficit ela é o número mais importante da tela.
    const metaProteina = calcularMetaProteina({
      pesoKg: perfil?.dadosBasicos?.peso_kg,
      fase: perfil?.fase?.atual,
    });
    const barraProteina = montarBarraProteina(total.proteina_g, metaProteina);

    if (!perfil?.dadosBasicos?.idade) {
      alertasCard.innerHTML = `
        <div class="exercise-head"><div class="exercise-name">Meta calórica</div></div>
        <div class="sets idade-form" style="padding:0 18px 18px;">
          ${barraProteina}
          <div class="set-field" style="grid-column:1/-1;">
            <label>Sua idade (necessária pra calcular a meta calórica)</label>
            <input name="idade" type="number" min="10" max="100" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" />
          </div>
          <button type="button" class="swap-pill salvar-idade" style="grid-column:1/-1;">Salvar idade</button>
        </div>
      `;
      alertasCard.querySelector(".salvar-idade").addEventListener("click", async () => {
        const idade = Number(alertasCard.querySelector('input[name="idade"]').value);
        if (!(idade > 0)) return;
        const perfilAtualizado = { ...perfil, dadosBasicos: { ...perfil.dadosBasicos, idade } };
        await put(db, "perfil", perfilAtualizado);
        perfil.dadosBasicos.idade = idade;
        await redesenharTotaisEAlertas();
      });
      return;
    }

    const tmb = calcularTMB({
      sexo: perfil.dadosBasicos.sexo,
      pesoKg: perfil.dadosBasicos.peso_kg,
      alturaCm: perfil.dadosBasicos.altura_cm,
      idade: perfil.dadosBasicos.idade,
    });
    const medidas = await getMedidas(db);
    const historicoPesoTendencia = medidas.filter((m) => m.peso_kg != null);
    const metaCalorica = calcularMetaCalorica({ tmb, fase: perfil.fase?.atual, historicoPesoTendencia });
    const alertas = checarAdequacaoNutricional({
      totalDia: total,
      metaCalorica,
      pesoKg: perfil.dadosBasicos.peso_kg,
      temFibraOuVegetais: false,
      metaProteina,
    });

    alertasCard.innerHTML = `
      <div class="exercise-head"><div class="exercise-name">Meta calórica: ${metaCalorica.meta_kcal} kcal</div></div>
      <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:8px;">
        ${barraProteina}
        <div class="prev-hint">${metaCalorica.obs}</div>
        ${alertas.filter((a) => a.eixo !== "proteina").map((a) => `<div class="prev-hint" style="color:var(--warn, #e0b04a);">⚠ ${a.mensagem}</div>`).join("")}
      </div>
    `;

    contextoNutricionalAtual = { fase: perfil.fase?.atual, total, metaCalorica, metaProteina, alertas };
    agendarResumoAutomatico();
  }

  const REFEICOES_LABELS = { cafeDaManha: "Café da manhã", almoco: "Almoço", cafeDaTarde: "Café da tarde", janta: "Janta" };

  function renderizarRefeicoes() {
    refeicoesBody.innerHTML = "";
    for (const [chave, refeicao] of Object.entries(dietaBase.dietaBase)) {
      const bloco = document.createElement("div");

      const titulo = document.createElement("div");
      titulo.className = "exercise-name";
      titulo.style.cssText = "font-size:0.85rem; margin-bottom:6px;";
      titulo.textContent = REFEICOES_LABELS[chave] ?? refeicao.nome;
      bloco.appendChild(titulo);

      // Uma refeição pode ter mais de uma opção marcada ao mesmo tempo (ex.:
      // banana + morango E 2 bananas no mesmo café da manhã) — por isso cada
      // pill liga/desliga por conta própria, e mais de um pode ficar ativo.
      const idsSelecionadosRaw = selecoes[chave];
      const idsSelecionados = Array.isArray(idsSelecionadosRaw)
        ? idsSelecionadosRaw
        : idsSelecionadosRaw !== undefined ? [idsSelecionadosRaw] : [];

      const opcoesEl = document.createElement("div");
      opcoesEl.style.cssText = "display:flex; flex-wrap:wrap; gap:12px 8px;";
      for (const opcao of refeicao.opcoes) {
        const pillWrap = document.createElement("span");
        pillWrap.style.cssText = "position:relative; display:inline-block;";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "swap-pill";
        btn.classList.toggle("selecionada", idsSelecionados.includes(opcao.id));
        btn.textContent = opcao.alimentos.map((a) => a.nome).join(" + ");
        btn.addEventListener("click", async () => {
          selecoes = await salvarSelecaoRefeicao(db, dataDeHoje, chave, opcao.id);
          const idsAtualizados = selecoes[chave] ?? [];
          btn.classList.toggle("selecionada", idsAtualizados.includes(opcao.id));
          await redesenharTotaisEAlertas();
        });
        pillWrap.appendChild(btn);

        const removerOpcaoBtn = document.createElement("button");
        removerOpcaoBtn.type = "button";
        removerOpcaoBtn.title = "Remover esta opção";
        removerOpcaoBtn.setAttribute("aria-label", "Remover esta opção");
        removerOpcaoBtn.textContent = "✕";
        removerOpcaoBtn.style.cssText = "position:absolute; top:-7px; right:-7px; width:18px; height:18px; border-radius:50%; background:var(--card-2); border:1px solid var(--line); color:var(--ink-faint); font-size:0.62rem; line-height:1; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center;";
        removerOpcaoBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (!confirm(`Remover "${btn.textContent}"?`)) return;
          dietaBase = await removerOpcaoRefeicao(db, chave, opcao.id);
          renderizarRefeicoes();
          await redesenharTotaisEAlertas();
        });
        pillWrap.appendChild(removerOpcaoBtn);

        opcoesEl.appendChild(pillWrap);
      }

      const adicionarOpcaoBtn = document.createElement("button");
      adicionarOpcaoBtn.type = "button";
      adicionarOpcaoBtn.className = "swap-pill";
      adicionarOpcaoBtn.textContent = "+";
      adicionarOpcaoBtn.title = "Adicionar opção nesta refeição";
      adicionarOpcaoBtn.style.cssText = "opacity:0.6; border:1px dashed var(--line); background:transparent;";
      opcoesEl.appendChild(adicionarOpcaoBtn);
      bloco.appendChild(opcoesEl);

      const formOpcao = criarFormularioOpcao({
        aoSalvar: async (alimento) => {
          dietaBase = await adicionarOpcaoRefeicao(db, chave, {
            alimentos: [alimento],
            totalEstimado: { kcal: alimento.kcal, proteina_g: alimento.proteina_g, carboidrato_g: alimento.carboidrato_g, gordura_g: alimento.gordura_g },
          });
          renderizarRefeicoes();
          await redesenharTotaisEAlertas();
        },
      });
      formOpcao.style.display = "none";
      adicionarOpcaoBtn.addEventListener("click", () => {
        formOpcao.style.display = formOpcao.style.display === "none" ? "flex" : "none";
      });
      bloco.appendChild(formOpcao);

      const removerRefeicaoLink = document.createElement("button");
      removerRefeicaoLink.type = "button";
      removerRefeicaoLink.textContent = `Remover "${REFEICOES_LABELS[chave] ?? refeicao.nome}" inteira`;
      removerRefeicaoLink.style.cssText = "background:none; border:none; color:var(--ink-faint); font-size:0.72rem; font-weight:700; cursor:pointer; padding:6px 0 0; display:block; font-family:inherit;";
      removerRefeicaoLink.addEventListener("click", async () => {
        if (!confirm(`Remover "${REFEICOES_LABELS[chave] ?? refeicao.nome}" da dieta, com todas as suas opções?`)) return;
        dietaBase = await removerRefeicao(db, chave);
        renderizarRefeicoes();
        await redesenharTotaisEAlertas();
      });
      bloco.appendChild(removerRefeicaoLink);

      refeicoesBody.appendChild(bloco);
    }

    const novaRefeicaoBtn = document.createElement("button");
    novaRefeicaoBtn.type = "button";
    novaRefeicaoBtn.className = "swap-pill";
    novaRefeicaoBtn.textContent = "+ Nova refeição (novo horário)";
    novaRefeicaoBtn.style.cssText = "opacity:0.7; border:1px dashed var(--line); background:transparent; align-self:flex-start;";
    refeicoesBody.appendChild(novaRefeicaoBtn);

    const formNovaRefeicao = criarFormularioNovaRefeicao({
      aoSalvar: async (nome, alimento) => {
        dietaBase = await adicionarRefeicao(db, {
          nome,
          opcoes: [{ id: "unica", alimentos: [alimento], totalEstimado: { kcal: alimento.kcal, proteina_g: alimento.proteina_g, carboidrato_g: alimento.carboidrato_g, gordura_g: alimento.gordura_g } }],
        });
        renderizarRefeicoes();
        await redesenharTotaisEAlertas();
      },
    });
    formNovaRefeicao.style.display = "none";
    novaRefeicaoBtn.addEventListener("click", () => {
      formNovaRefeicao.style.display = formNovaRefeicao.style.display === "none" ? "flex" : "none";
    });
    refeicoesBody.appendChild(formNovaRefeicao);
  }
  renderizarRefeicoes();

  await redesenharTotaisEAlertas();

  main.appendChild(criarCardComidaLivre(db, () => dataDeHoje, redesenharTotaisEAlertas));

  const cardResumo = criarCardResumoIA(db, () => dataDeHoje, () => contextoNutricionalAtual);
  main.appendChild(cardResumo.elemento);
  agendarResumoAutomatico = cardResumo.agendar;
  agendarResumoAutomatico(); // cobre "abrir o app" — a carga inicial já rodou antes deste ponto

  if (intervaloChecagemDeVirada) clearInterval(intervaloChecagemDeVirada);
  intervaloChecagemDeVirada = setInterval(async () => {
    const dataAtual = obterDataLocal();
    if (dataAtual === dataDeHoje) return;
    dataDeHoje = dataAtual;
    selecoes = await getSelecoesDoDia(db, dataDeHoje);
    renderizarRefeicoes();
    await redesenharTotaisEAlertas();
  }, 60000);

  return root;
}

function montarResultadoEstimativa(alimento) {
  return `<div class="prev-hint">${alimento.nome} — ~${alimento.kcal} kcal, ${alimento.proteina_g}g proteína, ${alimento.carboidrato_g}g carb, ${alimento.gordura_g}g gordura (confiança: ${alimento.confianca})</div>`;
}

// Card no fim da aba Dieta: pede pra IA transformar os totais do dia (já
// calculados pelo motor determinístico acima) num parágrafo explicativo,
// em vez de mais uma lista de números — pensado pra ler de relance no fim
// do dia e entender o que fazer com a próxima refeição.
//
// Gera sozinho (debounced) toda vez que os totais do dia mudam — abrir a
// aba, marcar uma opção como comida, adicionar algo fora da dieta base —
// além do botão manual pra forçar de novo quando quiser. O debounce evita
// disparar uma chamada de API a cada clique quando várias marcações
// acontecem em sequência rápida.
//
// A conta gratuita do Gemini tem cota bem curta (20 chamadas/dia no total,
// somando com a estimativa de comida) — por isso o resultado fica em cache
// no registro do dia (registrosDiarios), junto com uma "assinatura" dos
// totais que geraram ele. Só chama a API de novo (automático) quando os
// totais realmente mudaram desde a última vez; abrir o app sem mudar nada
// só relê o cache. O botão manual sempre força uma chamada nova.
const DEBOUNCE_RESUMO_MS = 1200;

function assinaturaContexto(contexto) {
  const { fase, total } = contexto;
  return [fase, total.kcal.toFixed(0), total.proteina_g.toFixed(0), total.carboidrato_g.toFixed(0), total.gordura_g.toFixed(1)].join("|");
}

function criarCardResumoIA(db, obterDataDeHoje, obterContexto) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Resumo do dia</div></div>
    <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:10px;">
      <button type="button" class="swap-pill gerar-resumo-btn" style="width:100%;">Gerar resumo com IA</button>
      <div class="resumo-ia-status prev-hint"></div>
      <p class="resumo-ia-texto" style="margin:0; font-size:0.85rem; line-height:1.6; color:var(--ink);"></p>
    </div>
  `;

  const botao = card.querySelector(".gerar-resumo-btn");
  const status = card.querySelector(".resumo-ia-status");
  const textoEl = card.querySelector(".resumo-ia-texto");

  async function gerar({ silencioso = false, forcar = false } = {}) {
    const contexto = obterContexto();
    if (!contexto) {
      if (!silencioso) status.textContent = "Preencha sua idade acima primeiro — a meta calórica depende dela.";
      return;
    }

    const dataDeHoje = obterDataDeHoje();
    const assinatura = assinaturaContexto(contexto);
    const registro = await getCheckin(db, dataDeHoje);
    const cache = registro?.resumoNutricionalIA;

    if (!forcar && cache?.assinatura === assinatura) {
      status.textContent = "";
      textoEl.textContent = cache.texto;
      return;
    }

    // Sem chave configurada, gerar automaticamente ficaria só avisando toda
    // hora que falta chave — deixa o botão manual pra isso, silencioso aqui.
    if (silencioso && !getApiKey()) return;

    status.textContent = "Perguntando à IA...";
    textoEl.textContent = "";
    botao.disabled = true;
    const resposta = await gerarResumoNutricionalDoDia(contexto);
    botao.disabled = false;

    if (!resposta.ok) {
      status.textContent = resposta.motivo === "sem_chave"
        ? "IA indisponível: cadastre sua chave do Gemini em Configurações."
        : resposta.motivo === "erro_api_429"
          ? "Cota diária da IA esgotada — tenta de novo amanhã, ou ajusta o plano no Google AI Studio."
          : "IA indisponível agora — tente de novo mais tarde.";
      return;
    }

    status.textContent = "";
    textoEl.textContent = resposta.texto.trim();
    await registrarCheckin(db, dataDeHoje, { resumoNutricionalIA: { texto: resposta.texto.trim(), assinatura } });
  }

  botao.addEventListener("click", () => gerar({ forcar: true }));

  let temporizador = null;
  function agendar() {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => gerar({ silencioso: true }), DEBOUNCE_RESUMO_MS);
  }

  return { elemento: card, agendar };
}

function alimentoDaEstimativa(alimentoIA, descricaoDigitada) {
  return {
    nome: alimentoIA.nome,
    quantidade: descricaoDigitada,
    kcal: alimentoIA.kcal,
    proteina_g: alimentoIA.proteina_g,
    carboidrato_g: alimentoIA.carboidrato_g,
    gordura_g: alimentoIA.gordura_g,
    estimativa: true,
  };
}

// Adiciona uma opção a uma refeição (horário) que já existe — ex.: uma
// alternativa nova pro almoço, ao lado das que já existiam. A IA estima as
// calorias/macros a partir da descrição, igual ao card "comeu algo diferente"
// — usuário nunca precisa digitar kcal/proteína/carbo/gordura na mão.
function criarFormularioOpcao({ aoSalvar }) {
  const wrap = document.createElement("div");
  wrap.className = "sets";
  wrap.style.cssText = "flex-direction:column; gap:8px; width:100%; padding:10px 0 4px;";
  wrap.innerHTML = `
    <div class="set-field" style="width:100%;">
      <label>O que é essa opção?</label>
      <textarea name="descricao" rows="2" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" placeholder="ex: 2 ovos mexidos com queijo"></textarea>
    </div>
    <button type="button" class="swap-pill estimar-btn" style="width:100%;">Estimar com IA</button>
    <div class="prev-hint status-ia"></div>
    <div class="resultado-ia"></div>
    <button type="button" class="swap-pill cancelar-btn" style="width:100%; opacity:0.6;">Cancelar</button>
  `;

  const textarea = wrap.querySelector('textarea[name="descricao"]');
  const estimarBtn = wrap.querySelector(".estimar-btn");
  const status = wrap.querySelector(".status-ia");
  const resultado = wrap.querySelector(".resultado-ia");

  function limparEFechar() {
    textarea.value = "";
    status.textContent = "";
    resultado.innerHTML = "";
    wrap.style.display = "none";
  }

  estimarBtn.addEventListener("click", async () => {
    const descricao = textarea.value.trim();
    if (!descricao) return;
    status.textContent = "Perguntando à IA...";
    resultado.innerHTML = "";
    estimarBtn.disabled = true;
    const resposta = await interpretarComida(descricao);
    estimarBtn.disabled = false;

    if (!resposta.ok) {
      status.textContent = resposta.motivo === "sem_chave"
        ? "IA indisponível: cadastre sua chave do Gemini em Configurações."
        : "IA indisponível agora — tente de novo mais tarde.";
      return;
    }

    status.textContent = "Confirme antes de salvar:";
    resultado.innerHTML = `${montarResultadoEstimativa(resposta.alimento)}<button type="button" class="swap-pill confirmar-btn" style="width:100%; margin-top:6px;">Confirmar e salvar</button>`;
    resultado.querySelector(".confirmar-btn").addEventListener("click", async () => {
      await aoSalvar(alimentoDaEstimativa(resposta.alimento, descricao));
      limparEFechar();
    });
  });

  wrap.querySelector(".cancelar-btn").addEventListener("click", limparEFechar);

  return wrap;
}

// Cria uma refeição inteira nova (um horário que ainda não existe na dieta,
// ex.: "Ceia") — diferente do formulário de opção, que só adiciona uma
// alternativa a um horário que já existe. Mesma estimativa por IA.
function criarFormularioNovaRefeicao({ aoSalvar }) {
  const wrap = document.createElement("div");
  wrap.className = "sets";
  wrap.style.cssText = "flex-direction:column; gap:8px; width:100%; padding:10px 0 4px;";
  wrap.innerHTML = `
    <div class="set-field" style="width:100%;">
      <label>Nome da refeição</label>
      <input type="text" name="nome" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" placeholder="ex: Lanche da noite" />
    </div>
    <div class="set-field" style="width:100%;">
      <label>O que você come nessa refeição?</label>
      <textarea name="descricao" rows="2" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" placeholder="ex: 2 fatias de pão integral com queijo"></textarea>
    </div>
    <button type="button" class="swap-pill estimar-btn" style="width:100%;">Estimar com IA</button>
    <div class="prev-hint status-ia"></div>
    <div class="resultado-ia"></div>
    <button type="button" class="swap-pill cancelar-btn" style="width:100%; opacity:0.6;">Cancelar</button>
  `;

  const nomeInput = wrap.querySelector('input[name="nome"]');
  const textarea = wrap.querySelector('textarea[name="descricao"]');
  const estimarBtn = wrap.querySelector(".estimar-btn");
  const status = wrap.querySelector(".status-ia");
  const resultado = wrap.querySelector(".resultado-ia");

  function limparEFechar() {
    nomeInput.value = "";
    textarea.value = "";
    status.textContent = "";
    resultado.innerHTML = "";
    wrap.style.display = "none";
  }

  estimarBtn.addEventListener("click", async () => {
    const nome = nomeInput.value.trim();
    const descricao = textarea.value.trim();
    if (!nome || !descricao) return;
    status.textContent = "Perguntando à IA...";
    resultado.innerHTML = "";
    estimarBtn.disabled = true;
    const resposta = await interpretarComida(descricao);
    estimarBtn.disabled = false;

    if (!resposta.ok) {
      status.textContent = resposta.motivo === "sem_chave"
        ? "IA indisponível: cadastre sua chave do Gemini em Configurações."
        : "IA indisponível agora — tente de novo mais tarde.";
      return;
    }

    status.textContent = "Confirme antes de salvar:";
    resultado.innerHTML = `${montarResultadoEstimativa(resposta.alimento)}<button type="button" class="swap-pill confirmar-btn" style="width:100%; margin-top:6px;">Confirmar e salvar</button>`;
    resultado.querySelector(".confirmar-btn").addEventListener("click", async () => {
      await aoSalvar(nome, alimentoDaEstimativa(resposta.alimento, descricao));
      limparEFechar();
    });
  });

  wrap.querySelector(".cancelar-btn").addEventListener("click", limparEFechar);

  return wrap;
}

function criarCardComidaLivre(db, obterDataDeHoje, aoSalvar) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">Comeu algo fora da dieta base?</div></div>
    <div class="sets" style="padding:0 18px 18px; display:flex; flex-direction:column; gap:8px;">
      <textarea class="comida-livre-input" rows="2" placeholder="Descreva o que comeu (ex.: 1 fatia de pizza de calabresa)" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;"></textarea>
      <button type="button" class="swap-pill comida-livre-btn">Estimar com IA</button>
      <div class="prev-hint comida-livre-status"></div>
      <div class="comida-livre-resultado"></div>
    </div>
  `;

  const input = card.querySelector(".comida-livre-input");
  const btn = card.querySelector(".comida-livre-btn");
  const status = card.querySelector(".comida-livre-status");
  const resultado = card.querySelector(".comida-livre-resultado");

  btn.addEventListener("click", async () => {
    const texto = input.value.trim();
    if (!texto) return;
    status.textContent = "Perguntando à IA...";
    resultado.innerHTML = "";
    btn.disabled = true;

    const resposta = await interpretarComida(texto);
    btn.disabled = false;

    if (!resposta.ok) {
      status.textContent = resposta.motivo === "sem_chave"
        ? "IA indisponível: cadastre sua chave do Gemini em Configurações."
        : "IA indisponível agora — tente de novo mais tarde.";
      return;
    }

    status.textContent = "Confirme antes de salvar:";
    const { alimento } = resposta;
    resultado.innerHTML = `
      <div class="prev-hint">${alimento.nome} — ~${alimento.kcal} kcal, ${alimento.proteina_g}g proteína, ${alimento.carboidrato_g}g carb, ${alimento.gordura_g}g gordura (confiança: ${alimento.confianca})</div>
      <button type="button" class="swap-pill confirmar-comida-btn" style="margin-top:6px;">Confirmar e salvar</button>
    `;
    resultado.querySelector(".confirmar-comida-btn").addEventListener("click", async () => {
      await adicionarAlimentoPessoal(db, { ...alimento, adicionadoEm: obterDataDeHoje(), origem: "gemini" });
      status.textContent = "Salvo — já somado no total estimado do dia acima.";
      resultado.innerHTML = "";
      input.value = "";
      await aoSalvar();
    });
  });

  return card;
}
