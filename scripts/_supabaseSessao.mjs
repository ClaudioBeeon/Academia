// scripts/_supabaseSessao.mjs
//
// Sessão do Supabase compartilhada pelos scripts de terminal (login,
// relatório). Mesmo projeto/chave anon do app (js/data/supabaseClient.js) —
// a chave anon não é segredo, é protegida por RLS no lado do servidor
// (supabase/schema.sql). O que É sensível é a sessão (access/refresh token)
// depois do login, por isso ela fica só em .supabase-session.json, um
// arquivo local nunca versionado (ver .gitignore) — nunca a senha em si,
// que só existe no prompt interativo de scripts/supabase-login.mjs.
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL_PADRAO = "https://ydlzdxqtjxbocwuzurzv.supabase.co";
const ANON_KEY_PADRAO = "sb_publishable_fE28T99MB-_mqqRRtMp87A_FoFTPpeT";

const raizDoRepo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const ARQUIVO_SESSAO = path.join(raizDoRepo, ".supabase-session.json");

export async function lerSessaoSalva() {
  try {
    const texto = await readFile(ARQUIVO_SESSAO, "utf8");
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

async function salvarSessao(sessao) {
  await writeFile(ARQUIVO_SESSAO, JSON.stringify(sessao, null, 2), "utf8");
}

export function criarClient() {
  return createClient(URL_PADRAO, ANON_KEY_PADRAO, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Cria um client já autenticado com a sessão salva, renovando (e
// re-salvando) o token se tiver expirado. Lança erro com instrução clara se
// não houver sessão salva ainda.
export async function clientAutenticado() {
  const sessaoSalva = await lerSessaoSalva();
  if (!sessaoSalva) {
    throw new Error("Nenhuma sessão salva ainda — rode `node scripts/supabase-login.mjs` primeiro (fora do Claude Code, no seu próprio terminal).");
  }

  const client = criarClient();
  const { data, error } = await client.auth.setSession({
    access_token: sessaoSalva.access_token,
    refresh_token: sessaoSalva.refresh_token,
  });
  if (error) {
    throw new Error(`Sessão salva expirou ou é inválida (${error.message}) — rode \`node scripts/supabase-login.mjs\` de novo.`);
  }

  // setSession já renova sozinho se o access_token expirou; se o token
  // devolvido for diferente do salvo, persiste o novo pra não pedir login
  // de novo na próxima vez.
  if (data.session && data.session.access_token !== sessaoSalva.access_token) {
    await salvarSessao({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  }

  return client;
}

export { salvarSessao };
