const DB_NAME = "academiaDB";
const DB_VERSION = 1;

const STORES = {
  perfil: "versao",
  protocolo: "versao",
  exercicios: "id",
  dietaBase: "versao",
  historicoSeries: { keyPath: "id", autoIncrement: true },
  cargas: "exercicioId",
  registrosDiarios: "data",
  config: "chave",
};

export function openDatabase(indexedDBImpl = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDBImpl.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, keyPathSpec] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const options = typeof keyPathSpec === "string"
          ? { keyPath: keyPathSpec }
          : keyPathSpec;
        db.createObjectStore(name, options);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

export function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
