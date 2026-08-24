// js/screens/iconeExercicio.js
import { ICONES_EXERCICIO, ICONE_PADRAO } from "../data/iconesExercicio.js";

export function criarIconeExercicio(exercicioId, tamanho = 52, imagemUrl = null) {
  const wrapper = document.createElement("div");
  wrapper.className = "icone-exercicio";
  wrapper.style.width = `${tamanho}px`;
  wrapper.style.height = `${tamanho}px`;
  if (imagemUrl) {
    wrapper.style.borderRadius = "10px";
    wrapper.style.overflow = "hidden";
    wrapper.innerHTML = `<img src="${imagemUrl}" alt="" style="width:100%; height:100%; object-fit:cover; display:block;" />`;
    return wrapper;
  }
  const miolo = ICONES_EXERCICIO[exercicioId] ?? ICONE_PADRAO;
  wrapper.innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">${miolo}</svg>`;
  return wrapper;
}
