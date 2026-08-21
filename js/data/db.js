const DB_NAME = "academiaDB";
const DB_VERSION = 4;

const STORES = {
  perfil: "versao",
  protocolo: "versao",
  exercicios: "id",
  dietaBase: "versao",
  historicoSeries: { keyPath: "id", autoIncrement: true },
  medidasCorporais: { keyPath: "id", autoIncrement: true },
  cargas: "exercicioId",
  registrosDiarios: "data",
  config: "chave",
  registrosCardio: { keyPath: "id", autoIncrement: true },
};

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
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Abertura do banco bloqueada — feche outras abas do app e tente novamente."));
  });
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
    req.onsuccess = () => resolve(req.result);
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
    req.onsuccess = () => resolve();
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
