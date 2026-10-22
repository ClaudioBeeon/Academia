// js/data/sync.js
//
// Sincronização automática com o Supabase, em cima do banco local — nunca no
// lugar dele. Toda gravação já acontece no IndexedDB primeiro (rápido,
// funciona sem sinal); este módulo só observa essas gravações via
// registerWriteHook() e tenta replicar pro servidor.
//
// Padrão fila-de-saída (outbox): toda escrita entra na store "syncOutbox"
// antes de qualquer tentativa de rede. Se a rede falhar (sem sinal, 4G caindo
// na academia), o item fica na fila e é reenviado no próximo gatilho — ao
// voltar a conexão, periodicamente, ou na próxima gravação. A ordem é
// preservada e o processamento para no primeiro erro de rede pra não pular
// itens.
//
// Não há sincronização automática puxando do servidor a cada mudança — isso
// exigiria assinar mudanças em tempo real e resolver conflito de verdade.
// O que existe: pullFromSupabase() traz tudo do servidor pra um dispositivo
// vazio (primeiro login), e a fila garante que tudo que muda localmente sobe.
// Pra dois dispositivos editando ao mesmo tempo, o mais recente vence
// (updated_at) — não é o problema deste app de uso pessoal.

import {
  put, get, getAll, del,
  registerWriteHook, withHooksSuspended, STORES_COM_CHAVE_NUMERICA,
} from "./db.js";
import { getClient, getUsuario, isConfigured } from "./supabaseClient.js";
import { definirEstadoSync, obterEstadoSync } from "./syncStatus.js";

const TABELA = "sync_records";
const BUCKET_FOTOS = "fotos-postura";
const INTERVALO_FLUSH_MS = 30000;

// syncOutbox nunca é sincronizada (seria recursivo), e config guarda inclusive
// a chave da API do Gemini/Supabase — nada aqui deveria ir pro servidor.
// recadosPersonal vem do servidor (escrito pela análise do treino) e nunca
// é editado no aparelho — mandar de volta seria só eco.
const STORES_EXCLUIDAS_DO_SYNC = new Set(["syncOutbox", "config", "recadosPersonal"]);

export function ehStoreNumerica(storeName) {
  return STORES_COM_CHAVE_NUMERICA.includes(storeName);
}

export async function enfileirar(db, storeName, key, value, deletado) {
  if (STORES_EXCLUIDAS_DO_SYNC.has(storeName)) return;
  await put(db, "syncOutbox", { storeName, key: String(key), value: deletado ? null : value, deletado, ts: Date.now() });
}

// Envia uma foto de postura pro Storage e devolve os metadados (sem o Blob,
// que jsonb não guarda) mais o caminho salvo.
async function enviarFotoPostura(client, userId, key, valor) {
  const caminho = `${userId}/${key}.jpg`;
  const { blob, ...metadados } = valor;
  if (blob instanceof Blob) {
    const { error } = await client.storage.from(BUCKET_FOTOS).upload(caminho, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg",
    });
    if (error) throw error;
  }
  return { metadados, caminho };
}

// deps injetável (mesmo padrão de fetchImpl em seed.js/gemini.js) — permite
// testar a lógica de fila com um cliente Supabase falso, sem rede nem
// credenciais reais.
export async function flushSyncQueue(db, deps = {}) {
  const {
    getClienteImpl = getClient,
    getUsuarioImpl = getUsuario,
    isConfiguredImpl = isConfigured,
    semStatus = false, // sincronizarTudo cuida do estado do começo ao fim
  } = deps;

  if (!isConfiguredImpl()) return { enviados: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (!semStatus) await marcarSemSinal(db);
    return { enviados: 0 };
  }

  const client = await getClienteImpl();
  if (!client) return { enviados: 0 };
  const usuario = await getUsuarioImpl();
  if (!usuario) return { enviados: 0 };

  const fila = await getAll(db, "syncOutbox");
  fila.sort((a, b) => a.id - b.id);
  if (!semStatus && fila.length > 0) definirEstadoSync({ fase: "sincronizando", pendentes: fila.length });

  let enviados = 0;
  for (const item of fila) {
    try {
      const registro = {
        user_id: usuario.id,
        store_name: item.storeName,
        record_key: item.key,
        deleted: Boolean(item.deletado),
        data: {},
        storage_path: null,
        updated_at: new Date(item.ts).toISOString(),
      };

      if (!item.deletado && item.storeName === "fotosPostura" && item.value) {
        const { metadados, caminho } = await enviarFotoPostura(client, usuario.id, item.key, item.value);
        registro.data = metadados;
        registro.storage_path = caminho;
      } else if (!item.deletado) {
        registro.data = item.value ?? {};
      }

      const { error } = await client.from(TABELA).upsert(registro, { onConflict: "user_id,store_name,record_key" });
      if (error) throw error;

      await del(db, "syncOutbox", item.id);
      enviados++;
    } catch (err) {
      // Rede fora ou erro do servidor: para aqui, preserva a ordem, tenta de
      // novo no próximo gatilho. Não descarta o item.
      console.error("Sync: falha ao enviar item da fila, tentando de novo depois:", err);
      break;
    }
  }
  if (!semStatus && fila.length > 0) {
    const restantes = fila.length - enviados;
    if (restantes === 0) definirEstadoSync({ fase: "ok", pendentes: 0, ultimoOk: Date.now() });
    else definirEstadoSync({ fase: "erro", pendentes: restantes });
  }
  return { enviados };
}

async function marcarSemSinal(db) {
  const pendentes = await pendentesNaFila(db);
  if (pendentes > 0) definirEstadoSync({ fase: "offline", pendentes });
}

// jsonb do Postgres reordena as chaves, então comparar por texto não serve.
function valoresIguais(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length || Array.isArray(a) !== Array.isArray(b)) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && valoresIguais(a[k], b[k]));
}

function converterChave(storeName, chaveTexto) {
  return ehStoreNumerica(storeName) ? Number(chaveTexto) : chaveTexto;
}

async function baixarFotoPostura(client, caminho) {
  const { data, error } = await client.storage.from(BUCKET_FOTOS).download(caminho);
  if (error) {
    console.error("Sync: falha ao baixar foto de postura:", error);
    return null;
  }
  return data; // já é um Blob
}

// Traz tudo do servidor pro banco local — uso principal: primeiro login num
// dispositivo novo/vazio. Aplica com os write hooks suspensos, senão cada
// registro puxado viraria uma nova entrada na fila de envio.
//
// Com `desde` (ISO), traz só o que mudou no servidor depois disso e pula o que
// já está igual aqui (o que o próprio aparelho acabou de mandar volta na
// busca) — assim "recebidos" quer dizer "chegou algo novo de verdade".
export async function pullFromSupabase(db, deps = {}) {
  const {
    getClienteImpl = getClient,
    getUsuarioImpl = getUsuario,
    isConfiguredImpl = isConfigured,
    desde = null,
  } = deps;

  if (!isConfiguredImpl()) return { recebidos: 0 };
  const client = await getClienteImpl();
  if (!client) return { recebidos: 0 };
  const usuario = await getUsuarioImpl();
  if (!usuario) return { recebidos: 0 };

  let consulta = client.from(TABELA).select("*").eq("user_id", usuario.id);
  if (desde) consulta = consulta.gte("updated_at", desde);
  const { data: linhas, error } = await consulta;
  if (error) {
    console.error("Sync: falha ao puxar dados do servidor:", error);
    return { recebidos: 0, erro: true };
  }

  let recebidos = 0;
  await withHooksSuspended(async () => {
    for (const linha of linhas) {
      const chave = converterChave(linha.store_name, linha.record_key);
      if (linha.deleted) {
        await del(db, linha.store_name, chave).catch(() => {});
        continue;
      }
      let valor = linha.data ?? {};
      const local = desde ? await get(db, linha.store_name, chave).catch(() => undefined) : undefined;
      // Foto já está aqui: não baixa de novo (o blob nunca muda com a chave).
      if (local && linha.store_name === "fotosPostura") continue;
      if (linha.store_name === "fotosPostura" && linha.storage_path) {
        const blob = await baixarFotoPostura(client, linha.storage_path);
        if (!blob) continue; // sem a foto, não grava metadado quebrado
        valor = { ...valor, blob };
      }
      // autoIncrement precisa da chave explícita pra não gerar uma nova.
      if (ehStoreNumerica(linha.store_name)) valor = { ...valor, id: chave };
      if (local && valoresIguais(local, valor)) continue;
      await put(db, linha.store_name, valor);
      recebidos++;
    }
  });
  return { recebidos };
}

// Ficha, protocolo e perfil são gravados pelo seed/migrações antes de a
// sincronização ligar, então nunca subiam — o servidor não tinha a ficha
// (visto em 28/09/2026). Sobe uma vez, só com a pessoa logada (antes do
// login, a fila seria enviada depois do pull e sobrescreveria o servidor
// com o perfil padrão semeado).
const CHAVE_PESSOAIS_ENVIADOS = "pessoaisNoServidor20260928";
const STORES_PESSOAIS_UMA_VEZ = ["ficha", "protocolo", "perfil"];

export async function enviarDadosPessoaisUmaVez(db, deps = {}) {
  const { getUsuarioImpl = getUsuario, isConfiguredImpl = isConfigured, flushImpl = flushSyncQueue } = deps;
  if (!isConfiguredImpl()) return { enviados: 0 };
  const marcador = await get(db, "config", CHAVE_PESSOAIS_ENVIADOS);
  if (marcador?.valor) return { enviados: 0 };
  if (!(await getUsuarioImpl())) return { enviados: 0 };
  let enviados = 0;
  for (const store of STORES_PESSOAIS_UMA_VEZ) {
    for (const valor of await getAll(db, store)) {
      await enfileirar(db, store, valor.versao, valor, false);
      enviados++;
    }
  }
  await put(db, "config", { chave: CHAVE_PESSOAIS_ENVIADOS, valor: true });
  await flushImpl(db);
  return { enviados };
}

const CHAVE_ULTIMO_PULL = "ultimoPullSync";
// Folga pro relógio do aparelho não ser exatamente o do servidor.
const FOLGA_PULL_MS = 10 * 60 * 1000;
let emAndamento = null;

// Sincroniza de ponta a ponta: manda o que está na fila e traz o que mudou no
// servidor (outro aparelho, análise do treino). Só puxa com a fila vazia —
// puxar com envio pendente sobrescreveria uma alteração que ainda não subiu.
// Chamadas simultâneas dividem a mesma execução. `aposPull` roda depois de
// trazer dados (app.js usa pra voltar a ficha à revisão do repositório).
export function sincronizarTudo(db, deps = {}) {
  if (emAndamento) return emAndamento;
  emAndamento = executarSincronizacao(db, deps).finally(() => { emAndamento = null; });
  return emAndamento;
}

async function executarSincronizacao(db, deps) {
  const {
    flushImpl = flushSyncQueue,
    pullImpl = pullFromSupabase,
    getUsuarioImpl = getUsuario,
    isConfiguredImpl = isConfigured,
    aposPull = null,
    agora = Date.now,
  } = deps;

  const semResultado = { recebidos: 0, sincronizado: false };
  if (!isConfiguredImpl() || !(await getUsuarioImpl())) {
    definirEstadoSync({ fase: "desligado", pendentes: 0 });
    return semResultado;
  }

  definirEstadoSync({ fase: "sincronizando" });
  try {
    await flushImpl(db, { semStatus: true });
    let pendentes = await pendentesNaFila(db);
    if (pendentes > 0) {
      const semSinal = typeof navigator !== "undefined" && navigator.onLine === false;
      definirEstadoSync({ fase: semSinal ? "offline" : "erro", pendentes });
      return semResultado;
    }

    const marca = await get(db, "config", CHAVE_ULTIMO_PULL);
    const desde = marca?.valor ? new Date(Date.parse(marca.valor) - FOLGA_PULL_MS).toISOString() : null;
    const inicio = new Date(agora()).toISOString();
    const { recebidos, erro } = await pullImpl(db, { desde });
    if (erro) {
      definirEstadoSync({ fase: "erro", pendentes: 0 });
      return semResultado;
    }
    await put(db, "config", { chave: CHAVE_ULTIMO_PULL, valor: inicio });

    if (aposPull) {
      await aposPull();
      await flushImpl(db, { semStatus: true });
      pendentes = await pendentesNaFila(db);
    }
    definirEstadoSync(pendentes > 0
      ? { fase: "erro", pendentes }
      : { fase: "ok", pendentes: 0, ultimoOk: agora() });
    return { recebidos, sincronizado: pendentes === 0 };
  } catch (err) {
    console.error("Sync: falha na sincronização completa:", err);
    definirEstadoSync({ fase: "erro", pendentes: obterEstadoSync().pendentes });
    return semResultado;
  }
}

let intervaloAtivo = null;

// Chamada uma vez em app.js, depois de abrir o banco. Liga o gancho de
// escrita (toda gravação local passa a entrar na fila), tenta esvaziar a
// fila ao ganhar conexão e periodicamente enquanto o app está aberto.
// Sem credenciais configuradas, tudo aqui vira no-op — o app não muda de
// comportamento pra quem não usa sincronização.
export function initAutoSync(db) {
  registerWriteHook((storeName, key, value, deletado) => {
    if (!isConfigured()) return;
    enfileirar(db, storeName, key, value, deletado)
      .then(() => flushSyncQueue(db))
      .catch((err) => console.error("Sync: falha ao enfileirar escrita:", err));
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => flushSyncQueue(db));
  }

  if (!intervaloAtivo) {
    intervaloAtivo = setInterval(() => flushSyncQueue(db), INTERVALO_FLUSH_MS);
  }

  flushSyncQueue(db);
}

export async function pendentesNaFila(db) {
  const fila = await getAll(db, "syncOutbox");
  return fila.length;
}
