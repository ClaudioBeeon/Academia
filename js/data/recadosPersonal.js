// js/data/recadosPersonal.js
//
// Recados do "personal" por exercício. Quem escreve é a análise do treino
// (Claude, via scripts/recado-personal.mjs), direto no servidor — então o
// celular precisa buscar: a sincronização normal só manda do aparelho pro
// servidor (o caminho contrário só existe no login). Busca ao abrir o app e
// guarda local, pra continuar aparecendo offline na academia.
import { get, put, del } from "./db.js";
import { getClient, getUsuario, isConfigured } from "./supabaseClient.js";

const STORE = "recadosPersonal";

export async function getRecadoPersonal(db, exercicioId) {
  return get(db, STORE, exercicioId);
}

export async function baixarRecadosPersonal(db, deps = {}) {
  const { getClienteImpl = getClient, getUsuarioImpl = getUsuario, isConfiguredImpl = isConfigured } = deps;
  if (!isConfiguredImpl()) return 0;
  const client = await getClienteImpl();
  if (!client) return 0;
  const usuario = await getUsuarioImpl();
  if (!usuario) return 0;

  const { data: linhas, error } = await client.from("sync_records").select("record_key,data,deleted")
    .eq("user_id", usuario.id).eq("store_name", STORE);
  if (error) throw error;
  for (const linha of linhas ?? []) {
    if (linha.deleted) await del(db, STORE, linha.record_key);
    else await put(db, STORE, { ...linha.data, exercicioId: linha.record_key });
  }
  return (linhas ?? []).length;
}
