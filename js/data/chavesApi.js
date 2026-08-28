// js/data/chavesApi.js
//
// Chaves de API do usuário (Gemini, YouTube) — diferente das credenciais do
// próprio Supabase (js/data/supabaseClient.js), que têm que ficar fora do
// banco sincronizado por necessidade (não dá pra usar o Supabase pra
// guardar a credencial que abre o Supabase). Essas aqui não têm esse
// problema, então vivem na store "chavesApi" (js/data/db.js), que
// sincroniza normalmente — sobrevivem a reinstalar o app ou trocar de
// aparelho, desde que a pessoa esteja logada. Antes dessas viverem só em
// localStorage, cada reinstalo do PWA (comum no iOS) apagava a chave e
// obrigava a digitar de novo.
//
// Fica em cache em memória depois de carregarCacheDeChaves() (chamada uma
// vez em app.js, antes de qualquer tela renderizar) porque várias telas leem
// essas chaves de forma síncrona, como valor padrão de parâmetro — só a
// escrita precisa esperar o IndexedDB.
import { get, put } from "./db.js";

const CHAVE_GEMINI = "gemini_api_key";
const CHAVE_GEMINI_MODELO = "gemini_model";
const CHAVE_YOUTUBE = "youtube_api_key";
const TODAS_AS_CHAVES = [CHAVE_GEMINI, CHAVE_GEMINI_MODELO, CHAVE_YOUTUBE];

const cache = new Map(TODAS_AS_CHAVES.map((chave) => [chave, ""]));

export async function carregarCacheDeChaves(db) {
  const registros = await Promise.all(TODAS_AS_CHAVES.map((chave) => get(db, "chavesApi", chave)));
  for (const registro of registros) {
    if (registro) cache.set(registro.chave, registro.valor ?? "");
  }

  // Migração de uma vez: essas chaves viviam em localStorage antes desta
  // versão, por isso nunca sincronizavam e sumiam a cada reinstalar. Se
  // ainda tiver algo lá que não veio do IndexedDB/sync, sobe agora — sem
  // isso, quem já tinha a chave do Gemini cadastrada teria que digitar de
  // novo depois desta atualização.
  try {
    for (const chave of TODAS_AS_CHAVES) {
      if (cache.get(chave)) continue;
      const antigo = localStorage.getItem(chave);
      if (antigo) {
        await salvar(db, chave, antigo);
        localStorage.removeItem(chave);
      }
    }
  } catch {
    // localStorage indisponível (ex.: modo privado) — segue sem migrar.
  }
}

function ler(chave) {
  return cache.get(chave) ?? "";
}

async function salvar(db, chave, valor) {
  cache.set(chave, valor ?? "");
  await put(db, "chavesApi", { chave, valor: valor ?? "" });
}

export function getGeminiApiKeyBruta() { return ler(CHAVE_GEMINI); }
export function getGeminiModeloBruto() { return ler(CHAVE_GEMINI_MODELO); }
export function getYoutubeApiKey() { return ler(CHAVE_YOUTUBE); }

export function salvarGeminiApiKey(db, valor) { return salvar(db, CHAVE_GEMINI, valor); }
export function salvarGeminiModelo(db, valor) { return salvar(db, CHAVE_GEMINI_MODELO, valor); }
export function salvarYoutubeApiKey(db, valor) { return salvar(db, CHAVE_YOUTUBE, valor); }
