// js/lib/tema.js
//
// Tema claro/escuro/sistema. Guardado em localStorage (não IndexedDB) — é
// preferência de exibição do aparelho, não dado do treino, não precisa
// sincronizar entre dispositivos nem entrar no backup/restore.
const CHAVE_LOCAL_STORAGE = "tema";
export const TEMAS_VALIDOS = ["sistema", "escuro", "claro"];
const COR_POR_TEMA_EFETIVO = { claro: "#F7F7F5", escuro: "#0E0E0E" };

export function obterTemaSalvo() {
  try {
    const valor = localStorage.getItem(CHAVE_LOCAL_STORAGE);
    return TEMAS_VALIDOS.includes(valor) ? valor : "sistema";
  } catch {
    return "sistema";
  }
}

function temaEfetivo(tema) {
  if (tema !== "sistema") return tema;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

// [data-theme] no <html> é o que o CSS (tokens.css) realmente usa pra
// decidir a paleta; a cor da barra de status do iOS/Android é um <meta>
// separado que o CSS não alcança, então precisa ser atualizado à parte.
export function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  else delete raiz.dataset.theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", COR_POR_TEMA_EFETIVO[temaEfetivo(tema)]);
}

// Só a cor da barra de status precisa desse listener — a paleta em si já
// reage sozinha via prefers-color-scheme no CSS, sem precisar de JS.
export function observarTemaDoSistema() {
  window.matchMedia?.("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (obterTemaSalvo() === "sistema") aplicarTema("sistema");
  });
}

export function salvarTema(tema) {
  try {
    localStorage.setItem(CHAVE_LOCAL_STORAGE, tema);
  } catch {
    // Sem localStorage (modo privado, etc.) o tema só vale pra sessão atual.
  }
  aplicarTema(tema);
}
