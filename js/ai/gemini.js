// js/ai/gemini.js
//
// Camada de IA isolada (spec seção 9). Nunca importada por js/engine/ — só a
// UI chama, sempre depois que o motor determinístico já decidiu tudo. Toda
// função aqui tem fallback gracioso: sem chave, offline ou erro da API nunca
// derruba a tela, sempre devolve { ok: false, motivo }.

import { getGeminiApiKeyBruta, getGeminiModeloBruto } from "../data/chavesApi.js";

// flash-lite é a variante de menor custo/latência da família — cota grátis
// bem mais generosa que o "flash" cheio, e o app só pede texto curto (JSON de
// estimativa nutricional, parágrafo de resumo), nada que precise do modelo
// mais caro. Ajustável em Configurações se a Google mudar as cotas de novo.
const MODELO_PADRAO = "gemini-3.5-flash-lite";
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Leitura só — salvar passa a ser direto por js/data/chavesApi.js
// (salvarGeminiApiKey/salvarGeminiModelo), que precisa do `db` pra
// persistir e sincronizar. Mantidas aqui porque cada chamada à IA usa
// getApiKey()/getModelo() como valor padrão de parâmetro.
export function getApiKey() {
  return getGeminiApiKeyBruta();
}

export function getModelo() {
  return getGeminiModeloBruto() || MODELO_PADRAO;
}

export async function chamarGemini(prompt, opcoes = {}) {
  return chamarGeminiComPartes([{ text: prompt }], opcoes);
}

// Igual a chamarGemini, mas aceita partes multimodais (texto + imagem inline
// em base64) — usado pelo reconhecimento de comida por foto.
export async function chamarGeminiComPartes(partes, { fetchImpl = globalThis.fetch, apiKey = getApiKey(), modelo = getModelo() } = {}) {
  if (!apiKey) {
    return { ok: false, motivo: "sem_chave" };
  }
  try {
    const resposta = await fetchImpl(
      `${ENDPOINT_BASE}/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: partes }],
        }),
      },
    );
    if (!resposta.ok) {
      const corpoErro = typeof resposta.text === "function" ? await resposta.text().catch(() => "") : "";
      console.error(`Gemini respondeu ${resposta.status}:`, corpoErro);
      return { ok: false, motivo: `erro_api_${resposta.status}` };
    }
    const dados = await resposta.json();
    const texto = dados?.candidates?.[0]?.content?.parts
      ?.map((parte) => parte.text)
      .filter(Boolean)
      .join("");
    if (!texto) {
      console.error("Gemini devolveu resposta sem texto:", JSON.stringify(dados));
      return { ok: false, motivo: "resposta_vazia" };
    }
    return { ok: true, texto };
  } catch (err) {
    console.error("Falha ao chamar Gemini:", err);
    return { ok: false, motivo: "erro_rede" };
  }
}

// Interpreta uma descrição livre de comida (texto) em estimativa nutricional
// estruturada. Sempre mostrado ao usuário pra confirmar antes de salvar —
// esta função nunca grava nada sozinha.
export async function interpretarComida(textoLivre, opcoes = {}) {
  const prompt = `Você ajuda a estimar valores nutricionais aproximados de uma refeição, para um app pessoal de acompanhamento. Nunca invente precisão que não existe — são sempre estimativas.

Descrição da refeição: "${textoLivre}"

Responda APENAS com um JSON válido, sem texto ao redor, no formato:
{"nome": "string curta descrevendo o alimento", "kcal": number, "proteina_g": number, "carboidrato_g": number, "gordura_g": number, "confianca": "baixa"|"media"|"alta"}`;

  const resultado = await chamarGemini(prompt, opcoes);
  if (!resultado.ok) return resultado;

  try {
    const jsonLimpo = resultado.texto.trim().replace(/^```json\s*|```$/g, "");
    const alimento = JSON.parse(jsonLimpo);
    return { ok: true, alimento };
  } catch (err) {
    console.error("Falha ao interpretar resposta da IA como JSON:", err, resultado.texto);
    return { ok: false, motivo: "resposta_invalida" };
  }
}

// Mesma ideia de interpretarComida, mas a partir de uma foto do prato em vez
// de texto — a IA identifica o alimento e estima os valores direto da imagem.
// `descricaoOpcional` deixa o usuário complementar o que a foto não mostra
// (ex.: "sem o refrigerante, só o prato").
export async function interpretarComidaPorFoto(base64Imagem, mimeType, descricaoOpcional = "", opcoes = {}) {
  const prompt = `Você ajuda a estimar valores nutricionais aproximados de uma refeição a partir de uma foto, para um app pessoal de acompanhamento. Identifique o(s) alimento(s) principais na imagem e nunca invente precisão que não existe — são sempre estimativas.
${descricaoOpcional ? `\nInformação extra dada pelo usuário: "${descricaoOpcional}"\n` : ""}
Responda APENAS com um JSON válido, sem texto ao redor, no formato:
{"nome": "string curta descrevendo o alimento identificado", "kcal": number, "proteina_g": number, "carboidrato_g": number, "gordura_g": number, "confianca": "baixa"|"media"|"alta"}`;

  const partes = [{ text: prompt }, { inlineData: { mimeType, data: base64Imagem } }];
  const resultado = await chamarGeminiComPartes(partes, opcoes);
  if (!resultado.ok) return resultado;

  try {
    const jsonLimpo = resultado.texto.trim().replace(/^```json\s*|```$/g, "");
    const alimento = JSON.parse(jsonLimpo);
    return { ok: true, alimento };
  } catch (err) {
    console.error("Falha ao interpretar resposta da IA (foto) como JSON:", err, resultado.texto);
    return { ok: false, motivo: "resposta_invalida" };
  }
}

// Pergunta livre sobre um exercício específico, feita na própria tela de
// execução (ex.: "sinto isso na lombar, é normal?"). A IA já sabe qual
// exercício é — o usuário não precisa reexplicar contexto que a tela já tem.
export async function responderPerguntaExercicio(exercicio, pergunta, opcoes = {}) {
  const prescricao = exercicio.prescricao;
  const contextoPrescricao = prescricao
    ? `Como executar: ${prescricao.comoExecutar ?? "não informado"}\nAtenção: ${prescricao.atencao ?? "não informado"}`
    : exercicio.observacoesExecucao
      ? `Observações: ${exercicio.observacoesExecucao}`
      : "Sem observações cadastradas.";

  const prompt = `Você é um assistente de treino de musculação, respondendo a dúvida de alguém durante o próprio treino, sobre um exercício específico. Responda em português, direto, em no máximo 3 frases, sem markdown, sem título. Se a dúvida envolver dor (não desconforto muscular normal), oriente a procurar um profissional em vez de arriscar um diagnóstico.

Exercício: ${exercicio.nome} (músculo: ${exercicio.musculo ?? "não informado"})
${contextoPrescricao}

Pergunta do usuário: "${pergunta}"`;

  return chamarGemini(prompt, opcoes);
}

// Pergunta livre sobre a dieta do dia (ex.: "posso comer um brigadeiro
// hoje?"), feita na aba Dieta. Recebe o mesmo contexto que já alimenta o
// resumo automático — a IA nunca inventa quanto já foi consumido, só o que
// o motor determinístico calculou.
export async function responderPerguntaDieta({ fase, total, metaCalorica, metaProteina, refeicoesRestantes }, pergunta, opcoes = {}) {
  const prompt = `Você é um assistente de nutrição respondendo a uma dúvida pontual sobre o dia alimentar de alguém, dentro de um app pessoal de acompanhamento. Responda em português, direto, em no máximo 4 frases, sem markdown, sem título. Baseie a resposta só nos números abaixo — nunca invente o que a pessoa já comeu.

Fase/objetivo atual: ${fase ?? "não informado"}
Consumido hoje: ${Math.round(total.kcal)} kcal, ${total.proteina_g.toFixed(0)}g de proteína, ${total.carboidrato_g.toFixed(0)}g de carboidrato, ${total.gordura_g.toFixed(1)}g de gordura.
Meta calórica do dia: ${metaCalorica.meta_kcal} kcal (piso de segurança: ${metaCalorica.piso_kcal} kcal).
Meta de proteína: ${metaProteina ? `${metaProteina.min_g}–${metaProteina.max_g}g` : "não calculada"}.
${refeicoesRestantes ? `Refeições que ainda faltam hoje: ${refeicoesRestantes}.` : "Sem informação sobre refeições restantes."}

Pergunta do usuário: "${pergunta}"`;

  return chamarGemini(prompt, opcoes);
}

// Transforma os totais do dia + os alertas já decididos pelo motor
// determinístico (js/engine/nutricao.js) num parágrafo explicativo. A IA
// nunca julga os números por conta própria — só recebe o que o motor já
// calculou e narra, pra não contradizer nem inventar alerta novo.
export async function gerarResumoNutricionalDoDia({ fase, total, metaCalorica, metaProteina, alertas }, opcoes = {}) {
  const listaAlertas = alertas?.length
    ? alertas.map((a) => `- ${a.mensagem}`).join("\n")
    : "- Nenhum — os números batem com as metas.";

  const prompt = `Você resume, em texto corrido e acolhedor, como está a alimentação de hoje de alguém em relação à meta nutricional dela. Nunca invente números, nem alertas além dos listados — use só o que está abaixo. Escreva em português, um único parágrafo de 3 a 5 frases, direto, sem jargão técnico, sem título, sem lista, sem markdown.

Fase/objetivo atual: ${fase ?? "não informado"}
Consumido hoje: ${Math.round(total.kcal)} kcal, ${total.proteina_g.toFixed(0)}g de proteína, ${total.carboidrato_g.toFixed(0)}g de carboidrato, ${total.gordura_g.toFixed(1)}g de gordura.
Meta calórica: ${metaCalorica.meta_kcal} kcal.
Meta de proteína: ${metaProteina ? `${metaProteina.min_g}–${metaProteina.max_g}g` : "não calculada"}.
Alertas já identificados pelas regras do app (narre estes, não invente outros):
${listaAlertas}`;

  return chamarGemini(prompt, opcoes);
}
