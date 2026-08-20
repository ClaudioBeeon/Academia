// js/engine/divisao.js
export const GRUPO_POR_MUSCULO = {
  peito: "superior",
  costas: "superior",
  ombro: "superior",
  biceps: "superior",
  triceps: "superior",
  abdomen: "superior",
  quadriceps: "inferior",
  posterior_coxa: "inferior",
  gluteo: "inferior",
  panturrilha: "inferior",
};

export function obterGrupoDoMusculo(musculo) {
  return GRUPO_POR_MUSCULO[musculo] ?? null;
}

export function determinarProximoGrupo(ultimaSerie) {
  if (!ultimaSerie) return "superior";
  const grupoAnterior = obterGrupoDoMusculo(ultimaSerie.musculo);
  if (grupoAnterior === null) return "superior";
  return grupoAnterior === "superior" ? "inferior" : "superior";
}
