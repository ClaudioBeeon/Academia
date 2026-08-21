// js/screens/iconeExercicio.js
import { ICONES_EXERCICIO, ICONE_PADRAO } from "../data/iconesExercicio.js";

export function criarIconeExercicio(exercicioId, tamanho = 52) {
  const wrapper = document.createElement("div");
  wrapper.className = "icone-exercicio";
  wrapper.style.width = `${tamanho}px`;
  wrapper.style.height = `${tamanho}px`;
  const miolo = ICONES_EXERCICIO[exercicioId] ?? ICONE_PADRAO;
  wrapper.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">${miolo}</svg>`;
  return wrapper;
}
