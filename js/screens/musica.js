// js/screens/musica.js
//
// Aba "Música" — dois players, pra não precisar sair do app: SoundCloud
// (cola o link de uma faixa/playlist já escolhida, sem precisar de chave
// nem login — é o widget público deles) e YouTube (busca de verdade por
// texto, usando a YouTube Data API v3; exige uma chave grátis cadastrada em
// Configurações, diferente do SoundCloud/Spotify que exigem aprovação
// manual e não dá pra fazer sozinho).
//
// O player que toca de verdade não mora aqui — mora em js/screens/
// widgetMusica.js, uma barra flutuante fora de #tab-content que sobrevive a
// trocar de aba (js/lib/playerFlutuante.js guarda o estado compartilhado).
// Esta tela só decide O QUE tocar; quem toca é a barra flutuante.
import { buscarVideosYoutube, construirUrlWidgetSoundcloud, pareceUrlSoundcloud } from "../lib/musica.js";
import { getYoutubeApiKey } from "../data/chavesApi.js";
import { definirPlayerFlutuante } from "../lib/playerFlutuante.js";

export async function montarTelaMusica(db, { onAbrirConfig } = {}) {
  const root = document.createElement("div");
  root.className = "tela-musica";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Sem sair do app</div><div class="day-title">Música</div></div>`;
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  main.appendChild(montarCardSoundcloud());
  main.appendChild(montarCardYoutube(onAbrirConfig));

  return root;
}

// Extrai um título aproximado do link, sem chamada de rede — o SoundCloud
// tem um endpoint de oEmbed que devolveria o título real, mas não vale a
// latência extra só pra um rótulo na barra flutuante.
function tituloAproximadoSoundcloud(url) {
  try {
    const partes = new URL(url).pathname.split("/").filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? "";
    return ultimo ? ultimo.replace(/-/g, " ") : "Faixa do SoundCloud";
  } catch {
    return "Faixa do SoundCloud";
  }
}

function montarCardSoundcloud() {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">SoundCloud</div></div>
    <form class="sets musica-sc-form" style="padding:0 18px 18px;">
      <div class="set-field" style="grid-column:1/-1;">
        <label>Link da faixa ou playlist<input name="url" type="url" placeholder="https://soundcloud.com/..." required /></label>
      </div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1; background:var(--accent); color:var(--accent-ink);">Tocar</button>
      <div class="prev-hint musica-sc-status" style="grid-column:1/-1;"></div>
    </form>
  `;
  const form = card.querySelector(".musica-sc-form");
  const status = card.querySelector(".musica-sc-status");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = form.url.value.trim();
    if (!pareceUrlSoundcloud(url)) {
      status.textContent = "Isso não parece um link do SoundCloud — cola o link de uma faixa ou playlist de lá.";
      return;
    }
    status.textContent = "Tocando — veja a barra no rodapé, continua mesmo trocando de aba.";
    definirPlayerFlutuante({
      tipo: "soundcloud",
      src: construirUrlWidgetSoundcloud(url),
      titulo: tituloAproximadoSoundcloud(url),
    });
  });

  return card;
}

function montarCardYoutube(onAbrirConfig) {
  const card = document.createElement("section");
  card.className = "exercise-card";

  if (!getYoutubeApiKey()) {
    card.innerHTML = `<div class="exercise-head"><div class="exercise-name">YouTube</div></div>`;
    const aviso = document.createElement("div");
    aviso.className = "prev-hint";
    aviso.style.padding = "0 18px 14px";
    aviso.textContent = "Pra buscar direto por aqui, cadastre uma chave grátis da API do YouTube em Configurações — é auto-cadastro, leva uns 5 minutos, sem esperar aprovação de ninguém.";
    card.appendChild(aviso);
    if (onAbrirConfig) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swap-pill";
      btn.textContent = "Ir pra Configurações";
      btn.style.cssText = "margin:0 18px 18px;";
      btn.addEventListener("click", onAbrirConfig);
      card.appendChild(btn);
    }
    return card;
  }

  card.innerHTML = `
    <div class="exercise-head"><div class="exercise-name">YouTube</div></div>
    <form class="sets musica-yt-form" style="padding:0 18px 12px;">
      <div class="set-field" style="grid-column:1/-1;">
        <label>Buscar<input name="q" type="text" placeholder="ex: set DJ tech house 2026" /></label>
      </div>
      <button type="submit" class="swap-pill" style="grid-column:1/-1;">Buscar</button>
    </form>
    <div class="prev-hint musica-yt-status" style="padding:0 18px 12px;"></div>
    <div class="musica-resultados"></div>
  `;

  const form = card.querySelector(".musica-yt-form");
  const status = card.querySelector(".musica-yt-status");
  const resultadosEl = card.querySelector(".musica-resultados");

  function tocar(item) {
    definirPlayerFlutuante({
      tipo: "youtube",
      src: `https://www.youtube.com/embed/${item.videoId}?autoplay=1`,
      titulo: decodificarEntidadesHtml(item.titulo),
    });
    status.textContent = "Tocando — veja a barra no rodapé, continua mesmo trocando de aba.";
  }

  const MENSAGEM_ERRO = {
    erro_api_403: "Chave inválida ou sem permissão — confira em Configurações.",
    sem_chave: "Cadastre a chave em Configurações.",
    consulta_vazia: "Digite algo pra buscar.",
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const consulta = form.q.value.trim();
    if (!consulta) return;
    status.textContent = "Buscando...";
    resultadosEl.replaceChildren();

    const resultado = await buscarVideosYoutube(consulta);
    if (!resultado.ok) {
      status.textContent = MENSAGEM_ERRO[resultado.motivo] ?? "Não foi possível buscar agora — tenta de novo.";
      return;
    }
    status.textContent = resultado.resultados.length === 0 ? "Nada encontrado." : "";
    for (const item of resultado.resultados) {
      resultadosEl.appendChild(montarLinhaResultado(item, () => tocar(item)));
    }
  });

  return card;
}

// A API do YouTube devolve título/canal com entidades HTML escapadas (ex.:
// "Rock &amp; Roll") — .textContent não decodifica isso sozinho, mostraria o
// "&amp;" literal na tela. Uma textarea decodifica sem risco de executar
// nada (conteúdo de textarea nunca é interpretado como elemento).
function decodificarEntidadesHtml(texto) {
  const el = document.createElement("textarea");
  el.innerHTML = texto;
  return el.value;
}

function montarLinhaResultado(item, aoTocar) {
  const linha = document.createElement("button");
  linha.type = "button";
  linha.className = "musica-resultado";

  const thumb = document.createElement("img");
  thumb.className = "musica-resultado-thumb";
  thumb.src = item.thumbnail;
  thumb.alt = "";
  thumb.loading = "lazy";

  const info = document.createElement("div");
  info.className = "musica-resultado-info";
  const titulo = document.createElement("b");
  titulo.textContent = decodificarEntidadesHtml(item.titulo);
  const canal = document.createElement("span");
  canal.textContent = decodificarEntidadesHtml(item.canal);
  info.append(titulo, canal);

  linha.append(thumb, info);
  linha.addEventListener("click", aoTocar);
  return linha;
}
