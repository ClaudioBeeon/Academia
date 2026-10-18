import { get, put } from "./db.js";
import { estadoDaSequencia, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";

export async function getUltimoDiaRegistrado(db) {
  const salvo = await get(db, "config", "sequenciaSemanal");
  return salvo ?? null;
}

// manual: correção pela Config ("Dia do ciclo") — zera o ajuste do vôlei.
export async function registrarDiaDaSessao(db, dia, data, concluido = false, { manual = false } = {}) {
  const estado = manual
    ? { ponteiro: null, pernasDevidas: false }
    : estadoDaSequencia(await getUltimoDiaRegistrado(db), data, dia);
  return put(db, "config", { chave: "sequenciaSemanal", dia, data, concluido, ...estado });
}

// Dias de vôlei do perfil (0 = domingo … 6 = sábado).
export async function getDiasVolei(db) {
  const perfil = await get(db, "perfil", "1.0");
  return Array.isArray(perfil?.diasVolei) ? perfil.diasVolei : [];
}

export async function salvarDiasVolei(db, dias) {
  const perfil = await get(db, "perfil", "1.0");
  if (!perfil) return;
  await put(db, "perfil", { ...perfil, diasVolei: [...new Set(dias)].sort() });
}

export async function determinarDiaDeHoje(db, hoje) {
  return determinarDiaDaSessao(await getUltimoDiaRegistrado(db), hoje, { diasVolei: await getDiasVolei(db) });
}
