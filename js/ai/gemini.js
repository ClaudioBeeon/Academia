// js/ai/gemini.js
//
// Camada de IA isolada (spec seção 9). Nunca importada por js/engine/ — só a
// UI chama, sempre depois que o motor determinístico já decidiu tudo. Toda
// função aqui tem fallback gracioso: sem chave, offline ou erro da API nunca
// derruba a tela, sempre devolve { ok: false, motivo }.

const CHAVE_LOCALSTORAGE = "gemini_api_key";
const MODELO = "gemini-3.6-flash";
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

export async function chamarGemini(prompt, { fetchImpl = globalThis.fetch, apiKey = getApiKey() } = {}) {
  if (!apiKey) {
    return { ok: false, motivo: "sem_chave" };
  }
  try {
    const resposta = await fetchImpl(
      `${ENDPOINT_BASE}/${MODELO}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // Desliga "thinking" — sem isso o modelo às vezes gasta todo o
          // orçamento de tokens pensando e devolve texto final vazio.
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
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
