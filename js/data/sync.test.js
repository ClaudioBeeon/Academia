import { test } from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDatabase, clearStore, getAll, get } from "./db.js";
import { enfileirar, flushSyncQueue, pullFromSupabase, pendentesNaFila, ehStoreNumerica } from "./sync.js";

const USUARIO = { id: "user-123", email: "teste@exemplo.com" };

// Cliente Supabase falso: guarda upserts em memória e simula .storage.
function criarClienteFalso({ falharNoUpsert = false, linhasIniciais = [] } = {}) {
  const registros = [...linhasIniciais];
  const arquivos = new Map();
  return {
    registros,
    arquivos,
    from(tabela) {
      assert.equal(tabela, "sync_records");
      return {
        upsert: async (registro) => {
          if (falharNoUpsert) return { error: new Error("rede fora") };
          const i = registros.findIndex(
            (r) => r.store_name === registro.store_name && r.record_key === registro.record_key
          );
          if (i >= 0) registros[i] = registro; else registros.push(registro);
          return { error: null };
        },
        select: () => ({
          eq: async () => ({ data: registros, error: null }),
        }),
      };
    },
    storage: {
      from: () => ({
        upload: async (caminho, blob) => { arquivos.set(caminho, blob); return { error: null }; },
        download: async (caminho) => {
          const blob = arquivos.get(caminho);
          return blob ? { data: blob, error: null } : { data: null, error: new Error("não achado") };
        },
      }),
    },
  };
}

function depsOk(client) {
  return { getClienteImpl: async () => client, getUsuarioImpl: async () => USUARIO, isConfiguredImpl: () => true };
}

test("ehStoreNumerica identifica corretamente as stores autoIncrement", () => {
  assert.equal(ehStoreNumerica("historicoSeries"), true);
  assert.equal(ehStoreNumerica("fotosPostura"), true);
  assert.equal(ehStoreNumerica("perfil"), false);
  assert.equal(ehStoreNumerica("habitos"), false);
});

test("flushSyncQueue não faz nada sem configuração (no-op seguro)", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await enfileirar(db, "habitos", "2026-08-24", { creatina: true }, false);

  const r = await flushSyncQueue(db, { isConfiguredImpl: () => false });
  assert.equal(r.enviados, 0);
  assert.equal((await getAll(db, "syncOutbox")).length, 1, "item continua na fila");
  db.close();
});

test("flushSyncQueue envia os itens da fila e os remove ao ter sucesso", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await enfileirar(db, "habitos", "2026-08-24", { creatina: true }, false);
  await enfileirar(db, "perfil", "1.0", { dadosBasicos: { peso_kg: 71 } }, false);

  const client = criarClienteFalso();
  const r = await flushSyncQueue(db, depsOk(client));

  assert.equal(r.enviados, 2);
  assert.equal((await getAll(db, "syncOutbox")).length, 0, "fila esvaziada");
  assert.equal(client.registros.length, 2);
  assert.deepEqual(client.registros[0].data, { creatina: true });
  assert.equal(client.registros[0].user_id, "user-123");
  db.close();
});

test("flushSyncQueue para no primeiro erro e preserva a ordem pra tentar de novo depois", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await enfileirar(db, "habitos", "2026-08-24", { creatina: true }, false);
  await enfileirar(db, "perfil", "1.0", { peso_kg: 71 }, false);

  const clienteFalho = criarClienteFalso({ falharNoUpsert: true });
  const r1 = await flushSyncQueue(db, depsOk(clienteFalho));
  assert.equal(r1.enviados, 0);
  assert.equal((await getAll(db, "syncOutbox")).length, 2, "nada foi removido");

  const clienteOk = criarClienteFalso();
  const r2 = await flushSyncQueue(db, depsOk(clienteOk));
  assert.equal(r2.enviados, 2, "reprocessa a fila inteira quando a rede volta");
  db.close();
});

test("flushSyncQueue marca deleted:true pra exclusões, sem mandar dado", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await enfileirar(db, "medidasCorporais", "7", null, true);

  const client = criarClienteFalso();
  await flushSyncQueue(db, depsOk(client));

  assert.equal(client.registros[0].deleted, true);
  assert.deepEqual(client.registros[0].data, {});
  db.close();
});

test("flushSyncQueue nunca envia syncOutbox nem config pro servidor", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await enfileirar(db, "syncOutbox", "x", { qualquer: "coisa" }, false);
  await enfileirar(db, "config", "seedVersion", { valor: "1.0" }, false);

  assert.equal((await getAll(db, "syncOutbox")).length, 0, "enfileirar() já recusa essas stores");
  db.close();
});

test("flushSyncQueue sobe foto de postura pro Storage e separa metadados do blob", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  const blob = new Blob(["fake-jpeg"], { type: "image/jpeg" });
  await enfileirar(db, "fotosPostura", "5", { data: "2026-08-24", observacao: "", blob }, false);

  const client = criarClienteFalso();
  await flushSyncQueue(db, depsOk(client));

  const registro = client.registros[0];
  assert.equal(registro.storage_path, "user-123/5.jpg");
  assert.deepEqual(registro.data, { data: "2026-08-24", observacao: "" }, "blob não vai no jsonb");
  assert.ok(client.arquivos.has("user-123/5.jpg"), "blob foi pro storage");
  db.close();
});

test("pullFromSupabase aplica registros do servidor sem reenfileirar (hooks suspensos)", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await clearStore(db, "habitos");

  const client = criarClienteFalso({
    linhasIniciais: [
      { store_name: "habitos", record_key: "2026-08-20", data: { data: "2026-08-20", creatina: true }, deleted: false, storage_path: null },
    ],
  });
  const r = await pullFromSupabase(db, depsOk(client));

  assert.equal(r.recebidos, 1);
  const habito = await get(db, "habitos", "2026-08-20");
  assert.equal(habito.creatina, true);
  assert.equal((await getAll(db, "syncOutbox")).length, 0, "pull não gera reenvio");
  db.close();
});

test("pullFromSupabase converte a chave pra número em stores autoIncrement", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await clearStore(db, "medidasCorporais");

  const client = criarClienteFalso({
    linhasIniciais: [
      { store_name: "medidasCorporais", record_key: "12", data: { peso_kg: 70 }, deleted: false, storage_path: null },
    ],
  });
  await pullFromSupabase(db, depsOk(client));

  const linha = await get(db, "medidasCorporais", 12);
  assert.equal(linha.peso_kg, 70, "gravou sob a chave numérica 12, não a string '12'");
  db.close();
});

test("pullFromSupabase apaga localmente o que veio marcado deleted", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  await clearStore(db, "habitos");
  await enfileirar(db, "habitos", "2026-08-20", { creatina: true }, false);
  await flushSyncQueue(db, depsOk(criarClienteFalso())); // limpa a fila de novo

  const client = criarClienteFalso({
    linhasIniciais: [
      { store_name: "habitos", record_key: "2026-08-20", data: {}, deleted: true, storage_path: null },
    ],
  });
  await pullFromSupabase(db, depsOk(client));

  assert.equal(await get(db, "habitos", "2026-08-20"), undefined);
  db.close();
});

test("pullFromSupabase baixa o blob da foto de postura do Storage", async () => {
  const db = await openDatabase();
  await clearStore(db, "fotosPostura");

  const client = criarClienteFalso();
  client.arquivos.set("user-123/9.jpg", new Blob(["conteudo"], { type: "image/jpeg" }));
  client.registros.push({
    store_name: "fotosPostura", record_key: "9",
    data: { data: "2026-08-24", observacao: "" }, deleted: false, storage_path: "user-123/9.jpg",
  });

  await pullFromSupabase(db, depsOk(client));

  const foto = await get(db, "fotosPostura", 9);
  assert.ok(foto.blob instanceof Blob);
  db.close();
});

test("pendentesNaFila conta o que ainda não foi enviado", async () => {
  const db = await openDatabase();
  await clearStore(db, "syncOutbox");
  assert.equal(await pendentesNaFila(db), 0);
  await enfileirar(db, "habitos", "2026-08-24", { creatina: true }, false);
  await enfileirar(db, "perfil", "1.0", {}, false);
  assert.equal(await pendentesNaFila(db), 2);
  db.close();
});
