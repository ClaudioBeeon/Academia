import { get, put } from "./db.js";

const PADRAO = {
  chave: "equipamento",
  pesoBarra: 20,
  anilhasDisponiveis: [20, 15, 10, 5, 2.5, 1.25],
};

export async function getEquipamento(db) {
  const salvo = await get(db, "config", "equipamento");
  return salvo ?? PADRAO;
}

export function salvarEquipamento(db, { pesoBarra, anilhasDisponiveis }) {
  return put(db, "config", { chave: "equipamento", pesoBarra, anilhasDisponiveis });
}
