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

// Fixos no código: é sempre o mesmo projeto pessoal, e a chave anon não é
// segredo — ela é feita pra ficar exposta no cliente (é o RLS do
// supabase/schema.sql que protege os dados, não esconder essa chave).
// Sem isso, reinstalar o PWA (comum no iOS pra pegar atualização) apaga o
// localStorage e obriga a digitar tudo nas Configurações de novo. Ainda dá
// pra sobrescrever por ali, mas não é mais obrigatório.
const URL_PADRAO = "https://ydlzdxqtjxbocwuzurzv.supabase.co";
const ANON_KEY_PADRAO = "sb_publishable_fE28T99MB-_mqqRRtMp87A_FoFTPpeT";

let clientePromise = null;

// Link de "esqueci a senha" (e-mail do Supabase): volta pro app com
// #...type=recovery no endereço. Lido na carga do módulo, ANTES de o SDK
// processar e limpar o endereço — é o que faz a Config abrir pedindo a
// senha nova. Link vencido volta com #error=...
const HASH_INICIAL = typeof location !== "undefined" ? location.hash : "";
const VEIO_DO_LINK_DE_SENHA = /type=recovery/.test(HASH_INICIAL);
const ERRO_DO_LINK = /error_code=([^&]+)/.exec(HASH_INICIAL)?.[1] ?? null;

export function veioDoLinkDeNovaSenha() {
  return VEIO_DO_LINK_DE_SENHA;
}

export function erroDoLinkDeLogin() {
  if (!ERRO_DO_LINK) return null;
  return ERRO_DO_LINK === "otp_expired"
    ? "O link do e-mail venceu ou já foi usado. Peça um novo em \"Esqueci a senha\"."
    : "Não deu pra entrar pelo link do e-mail. Peça um novo em \"Esqueci a senha\".";
}

// Endereço do app sem #/? — é pra onde o Supabase manda de volta depois do
// Google ou do link de senha.
function enderecoDoApp() {
  return `${location.origin}${location.pathname}`;
}

export function getUrl() {
  try {
    return localStorage.getItem(CHAVE_URL) || URL_PADRAO;
  } catch {
    return URL_PADRAO;
  }
}

export function getAnonKey() {
  try {
    return localStorage.getItem(CHAVE_ANON_KEY) || ANON_KEY_PADRAO;
  } catch {
    return ANON_KEY_PADRAO;
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

// Redireciona pro Google e volta pro app depois — precisa do provider
// Google ativado em Authentication > Providers no painel do Supabase
// (com Client ID/Secret do Google Cloud) antes de funcionar.
export async function entrarComGoogle() {
  const client = await getClient();
  if (!client) throw new Error("Configure a sincronização com o Supabase antes.");
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: enderecoDoApp() },
  });
  if (error) throw error;
}

// "Esqueci a senha": o Supabase manda um e-mail com link que volta pro app
// (veioDoLinkDeNovaSenha). Quem digita a senha nova é a pessoa, na Config.
export async function pedirLinkDeNovaSenha(email) {
  const client = await getClient();
  if (!client) throw new Error("Configure a sincronização com o Supabase antes.");
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: enderecoDoApp() });
  if (error) throw error;
}

// Lê um link do e-mail do Supabase colado pela pessoa. Dois formatos:
// - o link do e-mail em si (.../auth/v1/verify?token=...&type=recovery);
// - o endereço onde ele caiu depois de aberto (...#access_token=...&
//   refresh_token=...&type=recovery), que é o que sobra quando o Supabase
//   manda pra um endereço errado (localhost).
// Puro, sem rede — testável.
export function lerLinkDoEmail(texto) {
  const achado = /https?:\/\/\S+/.exec(texto ?? "");
  if (!achado) return null;
  let url;
  try {
    url = new URL(achado[0].replace(/[)>\].,]+$/, ""));
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (hash.get("access_token") && hash.get("refresh_token")) {
    return { formato: "sessao", accessToken: hash.get("access_token"), refreshToken: hash.get("refresh_token"), tipo: hash.get("type") };
  }
  const token = url.searchParams.get("token") ?? url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type");
  if (token && tipo) return { formato: "token", token, tipo };
  return null;
}

// Entra com o link colado — funciona dentro do app instalado no iPhone, que
// não recebe o login quando o link abre no Safari. Devolve { recuperacao }
// pra quem chama saber se deve pedir a senha nova.
export async function entrarComLinkDoEmail(texto) {
  const lido = lerLinkDoEmail(texto);
  if (!lido) throw new Error("Não achei um link do Supabase nesse texto. Copie o link inteiro do e-mail e cole de novo.");
  const client = await getClient();
  if (!client) throw new Error("Configure a sincronização com o Supabase antes.");
  if (lido.formato === "sessao") {
    const { error } = await client.auth.setSession({ access_token: lido.accessToken, refresh_token: lido.refreshToken });
    if (error) throw error;
  } else {
    const { error } = await client.auth.verifyOtp({ token_hash: lido.token, type: lido.tipo });
    if (error) {
      throw new Error(/expired|invalid/i.test(error.message ?? "")
        ? "Esse link já foi usado ou venceu. Peça outro em \"Esqueci a senha\" e cole sem tocar nele antes."
        : error.message);
    }
  }
  return { recuperacao: lido.tipo === "recovery" };
}

// Chamado depois do link: o SDK já abriu a sessão de recuperação.
export async function definirNovaSenha(senha) {
  const client = await getClient();
  if (!client) throw new Error("Configure a sincronização com o Supabase antes.");
  const { error } = await client.auth.updateUser({ password: senha });
  if (error) throw error;
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
