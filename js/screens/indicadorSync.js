// js/screens/indicadorSync.js
//
// Ícone de sincronização no canto da tela. Fica fora de #tab-content (igual à
// bolha do cronômetro), então aparece em qualquer aba. Mostra o estado de
// js/data/syncStatus.js: girando enquanto sincroniza, "check" quando está
// tudo na nuvem, e um aviso quando algo ficou pra trás. Tocar força uma
// sincronização. Sem Supabase ou sem login, fica escondido.

import { obterEstadoSync, observarEstadoSync } from "../data/syncStatus.js";

const ICONES = {
  sincronizando: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="sync-giro"><path d="M20 12a8 8 0 0 0-14-5.3M4 12a8 8 0 0 0 14 5.3"/><path d="M6 3v4h4M18 21v-4h-4"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.2 4.2 0 0 1-.5 8.5z"/><path d="m9.5 13.5 2 2 3.5-4"/></svg>',
  offline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.2 4.2 0 0 1-.5 8.5z"/><path d="M4 4l16 16"/></svg>',
  erro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.2v.1"/></svg>',
};

const TEXTOS = {
  sincronizando: "Sincronizando…",
  ok: "Tudo sincronizado",
  offline: "Sem sinal",
  erro: "Não sincronizou",
};

const MS_ROTULO_VISIVEL = 2500;

function descricao(estado) {
  const base = TEXTOS[estado.fase] || "";
  if ((estado.fase === "offline" || estado.fase === "erro") && estado.pendentes > 0) {
    return `${base} — ${estado.pendentes} alteraç${estado.pendentes > 1 ? "ões" : "ão"} esperando`;
  }
  return base;
}

export function montarIndicadorSync({ aoTocar } = {}) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.id = "sync-indicador";
  botao.hidden = true;
  const icone = document.createElement("span");
  icone.className = "sync-icone";
  const rotulo = document.createElement("span");
  rotulo.className = "sync-rotulo";
  botao.append(icone, rotulo);
  document.body.appendChild(botao);

  let temporizador = null;
  let faseAnterior = null;

  function desenhar(estado) {
    const visivel = estado.fase !== "desligado";
    botao.hidden = !visivel;
    if (!visivel) return;

    botao.dataset.fase = estado.fase;
    icone.innerHTML = ICONES[estado.fase] || "";
    const texto = descricao(estado);
    rotulo.textContent = texto;
    botao.setAttribute("aria-label", texto);
    botao.title = texto;

    // O rótulo aparece ao mudar de fase e some sozinho; ícone fica sempre.
    // Aviso (offline/erro) mantém o rótulo, pra não passar despercebido.
    clearTimeout(temporizador);
    if (estado.fase !== faseAnterior) {
      botao.classList.add("com-rotulo");
      if (estado.fase === "ok") {
        temporizador = setTimeout(() => botao.classList.remove("com-rotulo"), MS_ROTULO_VISIVEL);
      }
    }
    if (estado.fase === "sincronizando") botao.classList.add("com-rotulo");
    if (estado.fase === "offline" || estado.fase === "erro") botao.classList.add("com-rotulo");
    faseAnterior = estado.fase;
  }

  botao.addEventListener("click", () => {
    if (obterEstadoSync().fase === "sincronizando") return;
    aoTocar?.();
  });

  observarEstadoSync(desenhar);
  desenhar(obterEstadoSync());
  return botao;
}
