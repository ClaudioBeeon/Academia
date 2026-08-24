// js/ai/gemini.js
//
// Camada de IA isolada (spec seção 9). Nunca importada por js/engine/ — só a
// UI chama, sempre depois que o motor determinístico já decidiu tudo. Toda
// função aqui tem fallback gracioso: sem chave, offline ou erro da API nunca
// derruba a tela, sempre devolve { ok: false, motivo }.

const CHAVE_LOCALSTORAGE = "gemini_api_key";
const CHAVE_MODELO_LOCALSTORAGE = "gemini_model";
// flash-lite é a variante de menor custo/latência da família — cota grátis
// bem mais generosa que o "flash" cheio, e o app só pede texto curto (JSON de
// estimativa nutricional, parágrafo de resumo), nada que precise do modelo
// mais caro. Ajustável em Configurações se a Google mudar as cotas de novo.
const MODELO_PADRAO = "gemini-3.5-flash-lite";
const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function getApiKey() {
  try {
    return localStorage.getItem(CHAVE_LOCALSTORAGE) ?? "";
  } catch {
    return "";
  }
}

export function salvarApiKey(chave) {
  try {
    if (chave) localStorage.setItem(CHAVE_LOCALSTORAGE, chave);
    else localStorage.removeItem(CHAVE_LOCALSTORAGE);
  } catch {
    // localStorage indisponível (ex.: modo privado) — segue sem salvar,
    // as funções de IA vão cair no fallback "sem chave" normalmente.
  }
}

export function getModelo() {
  try {
    return localStorage.getItem(CHAVE_MODELO_LOCALSTORAGE) || MODELO_PADRAO;
  } catch {
    return MODELO_PADRAO;
  }
}

export function salvarModelo(modelo) {
  try {
    if (modelo && modelo !== MODELO_PADRAO) localStorage.setItem(CHAVE_MODELO_LOCALSTORAGE, modelo);
    else localStorage.removeItem(CHAVE_MODELO_LOCALSTORAGE);
  } catch {
    // idem salvarApiKey — sem localStorage, cai sempre no padrão.
  }
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
