// js/data/supabaseClient.js
//
// Config e sessão do Supabase — mesmo padrão de js/ai/gemini.js: credenciais
// só em localStorage, nunca no repositório, nunca em outro lugar. O SDK só é
// baixado (via CDN, dinamicamente) quando a sincronização é de fato usada, pra
// não pesar nem quebrar a abertura offline do app: js/app.js nunca importa
// este arquivo eagerly no topo, só quando isConfigured() é verdadeiro.

const CHAVE_URL = "supabaseUrl";
const CHAVE_ANON_KEY = "supabaseAnonKey";
const SDK_URL = "https://esm.sh/@supabase/supabase-js@2";

let clientePromise = null;

export function getUrl() {
  try {
    return localStorage.getItem(CHAVE_URL) ?? "";
  } catch {
    return "";
  }
}

export function getAnonKey() {
  try {
    return localStorage.getItem(CHAVE_ANON_KEY) ?? "";
  } catch {
    return "";
  }
}

export function salvarCredenciais(url, anonKey) {
  try {
    if (url) localStorage.setItem(CHAVE_URL, url.trim());
    else localStorage.removeItem(CHAVE_URL);
    if (anonKey) localStorage.setItem(CHAVE_ANON_KEY, anonKey.trim());
    else localStorage.removeItem(CHAVE_ANON_KEY);
  } catch {
    // localStorage indisponível (modo privado) — segue sem salvar, igual ao
    // padrão já usado pra chave do Gemini.
  }
  clientePromise = null; // força recriar o client com as credenciais novas
}

export function isConfigured() {
  return Boolean(getUrl() && getAnonKey());
}

// Lazy + cacheado: só importa o SDK e cria o client na primeira chamada real,
// e reaproveita depois. Se as credenciais mudarem, salvarCredenciais() zera
// o cache pra próxima chamada recriar do zero.
export async function getClient() {
  if (!isConfigured()) return null;
  if (!clientePromise) {
    clientePromise = import(SDK_URL).then(({ createClient }) =>
      createClient(getUrl(), getAnonKey(), {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    );
  }
  try {
    return await clientePromise;
  } catch (err) {
    console.error("Falha ao carregar o SDK do Supabase:", err);
    clientePromise = null;
    return null;
  }
}

export async function cadastrar(email, senha) {
  const client = await getClient();
  if (!client) throw new Error("Configure a URL e a chave do Supabase antes.");
  const { data, error } = await client.auth.signUp({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function entrar(email, senha) {
  const client = await getClient();
  if (!client) throw new Error("Configure a URL e a chave do Supabase antes.");
  const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function sair() {
  const client = await getClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function getUsuario() {
  const client = await getClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data?.user ?? null;
}

const BUCKET_IMAGENS_EXERCICIO = "exercicio-imagens";

// Sobe um arquivo de imagem pro bucket público de exercícios e devolve a URL
// pública já pronta pra usar num <img src>. Lança erro se não houver sessão
// configurada — quem chama decide como mostrar isso ao usuário.
export async function subirImagemExercicio(exercicioId, arquivo) {
  const client = await getClient();
  if (!client) throw new Error("Configure a sincronização com o Supabase em Configurações antes.");
  const usuario = await getUsuario();
  if (!usuario) throw new Error("Faça login em Configurações antes de subir imagens.");

  const extensao = (arquivo.name.split(".").pop() || "jpg").toLowerCase();
  const caminho = `${exercicioId}-${Date.now()}.${extensao}`;
  const { error } = await client.storage.from(BUCKET_IMAGENS_EXERCICIO).upload(caminho, arquivo, {
    upsert: true,
    contentType: arquivo.type || "image/jpeg",
  });
  if (error) throw error;

  const { data } = client.storage.from(BUCKET_IMAGENS_EXERCICIO).getPublicUrl(caminho);
  return data.publicUrl;
}
