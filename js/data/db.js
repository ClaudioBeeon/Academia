const DB_NAME = "academiaDB";
const DB_VERSION = 9;

const STORES = {
  perfil: "versao",
  protocolo: "versao",
  ficha: "versao",
  exercicios: "id",
  dietaBase: "versao",
  historicoSeries: { keyPath: "id", autoIncrement: true },
  medidasCorporais: { keyPath: "id", autoIncrement: true },
  cargas: "exercicioId",
  registrosDiarios: "data",
  config: "chave",
  registrosCardio: { keyPath: "id", autoIncrement: true },
  habitos: "data",
  fotosPostura: { keyPath: "id", autoIncrement: true },
  observacoesTreino: "data",
  // Fila de escritas pendentes de sincronização com o Supabase (js/data/sync.js).
  // Fica no mesmo banco local por simplicidade — não é lida/gravada por
  // nenhuma tela, só pelo módulo de sync.
  syncOutbox: { keyPath: "id", autoIncrement: true },
};

// Stores cuja chave é numérica autoIncrement (as demais usam chave string:
// versão, data, chave de exercício, etc.). js/data/sync.js precisa disso pra
// saber se converte a chave de volta pra número ao aplicar dados vindos do
// servidor — lá a chave sempre trafega como texto.
export const STORES_COM_CHAVE_NUMERICA = Object.freeze(
  Object.entries(STORES)
    .filter(([, spec]) => typeof spec === "object" && spec.autoIncrement)
    .map(([nome]) => nome)
);

export function openDatabase(indexedDBImpl = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = event.target.transaction;
      for (const [name, keyPathSpec] of Object.entries(STORES)) {
        let store;
        if (!db.objectStoreNames.contains(name)) {
          const options = typeof keyPathSpec === "string"
            ? { keyPath: keyPathSpec }
            : keyPathSpec;
          store = db.createObjectStore(name, options);
        } else {
          // Loja já existe de uma versão anterior do banco — reabre-la pela
          // transação de upgrade em vez de recriá-la, pra poder acrescentar
          // índices novos sem perder os dados já gravados.
          store = tx.objectStore(name);
        }
        if (name === "historicoSeries") {
          if (!store.indexNames.contains("exercicioId")) {
            store.createIndex("exercicioId", "exercicioId", { unique: false });
          }
          if (!store.indexNames.contains("data")) {
            store.createIndex("data", "data", { unique: false });
          }
        }
        if (name === "medidasCorporais") {
          if (!store.indexNames.contains("data")) {
            store.createIndex("data", "data", { unique: false });
          }
        }
        if (name === "registrosCardio") {
          if (!store.indexNames.contains("data")) {
            store.createIndex("data", "data", { unique: false });
          }
        }
        if (name === "fotosPostura") {
          if (!store.indexNames.contains("data")) {
            store.createIndex("data", "data", { unique: false });
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Abertura do banco bloqueada — feche outras abas do app e tente novamente."));
  });
}

// Ganchos de escrita — como o app sincroniza com o Supabase (js/data/sync.js)
// sem que db.js precise saber que sync existe (importar sync.js aqui criaria
// um ciclo, já que sync.js precisa das funções deste arquivo). sync.js se
// registra uma vez em app.js via registerWriteHook(); put()/del() avisam
// depois de cada escrita bem-sucedida, com a chave real (importante pros
// stores autoIncrement, cuja chave só existe depois do put).
const writeHooks = [];
let hooksSuspensos = false;

export function registerWriteHook(fn) {
  writeHooks.push(fn);
}

// Usado só na aplicação de dados vindos do servidor (pull): escrever o que
// já veio de lá não deve gerar uma nova entrada na fila de envio, senão
// cada sincronização reenviaria o que acabou de receber.
export async function withHooksSuspended(fn) {
  hooksSuspensos = true;
  try {
    return await fn();
  } finally {
    hooksSuspensos = false;
  }
}

function notificarWriteHooks(storeName, key, value, deletado) {
  if (hooksSuspensos) return;
  for (const hook of writeHooks) {
    try {
      hook(storeName, key, value, deletado);
    } catch (err) {
      console.error("Falha num write hook:", err);
    }
  }
}

export function get(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function put(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => {
      notificarWriteHooks(storeName, req.result, value, false);
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function putAll(db, storeName, values) {
  for (const value of values) {
    await put(db, storeName, value);
  }
}

export function getAllByIndex(db, storeName, indexName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).index(indexName).getAll(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function del(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => {
      notificarWriteHooks(storeName, key, null, true);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
