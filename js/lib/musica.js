// js/lib/musica.js
//
// Busca de vídeos no YouTube (YouTube Data API v3) — mesmo padrão de chave
// do Gemini (js/ai/gemini.js): salva só neste dispositivo via localStorage,
// nunca sincronizada, nunca enviada a lugar nenhum além da própria chamada
// à API do Google. Chave é grátis e de auto-cadastro (console.cloud.google.com),
// diferente da do SoundCloud/Spotify, que exigem aprovação manual — por isso
// é o único dos três que permite busca de verdade dentro do app hoje.
const CHAVE_LOCALSTORAGE = "youtube_api_key";

export function getYoutubeApiKey() {
  try {
    return localStorage.getItem(CHAVE_LOCALSTORAGE) ?? "";
  } catch {
    return "";
  }
}

export function salvarYoutubeApiKey(chave) {
  try {
    if (chave) localStorage.setItem(CHAVE_LOCALSTORAGE, chave);
    else localStorage.removeItem(CHAVE_LOCALSTORAGE);
  } catch {
    // localStorage indisponível (ex.: modo privado) — segue sem salvar.
  }
}

export async function buscarVideosYoutube(consulta, { fetchImpl = globalThis.fetch, apiKey = getYoutubeApiKey() } = {}) {
  if (!apiKey) return { ok: false, motivo: "sem_chave" };
  const termo = consulta.trim();
  if (!termo) return { ok: false, motivo: "consulta_vazia" };

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(termo)}&key=${encodeURIComponent(apiKey)}`;
    const resposta = await fetchImpl(url);
    if (!resposta.ok) {
      return { ok: false, motivo: resposta.status === 403 ? "erro_api_403" : "erro_api" };
    }
    const dados = await resposta.json();
    const resultados = (dados.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id.videoId,
        titulo: item.snippet.title,
        canal: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.default?.url ?? item.snippet.thumbnails?.medium?.url ?? "",
      }));
    return { ok: true, resultados };
  } catch {
    return { ok: false, motivo: "erro_rede" };
  }
}

// SoundCloud não exige chave nem login pra embutir um player — o widget
// aceita qualquer URL pública de faixa/playlist já existente (é o mesmo
// endpoint que qualquer site usa pra embutir um player do SoundCloud).
export function construirUrlWidgetSoundcloud(urlFaixa) {
  const params = new URLSearchParams({
    url: urlFaixa,
    color: "c9f241",
    auto_play: "true",
    hide_related: "true",
    show_comments: "false",
    show_reposts: "false",
    show_teaser: "false",
    visual: "false",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

export function pareceUrlSoundcloud(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com") || hostname === "on.soundcloud.com";
  } catch {
    return false;
  }
}
