// js/data/medidas.js
import { getAll, put } from "./db.js";

export async function getMedidas(db) {
  const existentes = await getAll(db, "medidasCorporais");
  if (existentes.length > 0) return existentes;

  const perfis = await getAll(db, "perfil");
  if (perfis.length === 0) return [];
  const perfil = perfis[0];

  const linhaInicial = { data: perfil.dataAtualizacao };
  if (perfil.dadosBasicos?.peso_kg != null) {
    linhaInicial.peso_kg = perfil.dadosBasicos.peso_kg;
  }
  const gordura = perfil.composicaoCorporal?.historico?.[0];
  if (gordura?.percentualGordura != null) {
    linhaInicial.percentualGordura = gordura.percentualGordura;
  }
  const cintura = perfil.medidas?.cintura_cm?.historico?.[0];
  if (cintura?.valor != null) {
    linhaInicial.cintura_cm = cintura.valor;
  }

  await put(db, "medidasCorporais", linhaInicial);
  return getAll(db, "medidasCorporais");
}

export function registrarMedida(db, { data, peso_kg, cintura_cm, percentualGordura }) {
  const linha = { data };
  if (peso_kg != null) linha.peso_kg = peso_kg;
  if (cintura_cm != null) linha.cintura_cm = cintura_cm;
  if (percentualGordura != null) linha.percentualGordura = percentualGordura;
  return put(db, "medidasCorporais", linha);
}
