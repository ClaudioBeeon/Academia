// sw.js
const CACHE_NAME = "app-treino-shell-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/tokens.css",
  "./css/styles.css",
  "./js/app.js",
  "./js/data/db.js",
  "./js/data/seed.js",
  "./js/data/historico.js",
  "./js/data/exportImport.js",
  "./js/data/checkin.js",
  "./js/engine/progressao.js",
  "./js/engine/volume.js",
  "./js/engine/rir.js",
  "./js/engine/cargas.js",
  "./js/engine/substituicao.js",
  "./js/engine/anilhas.js",
  "./js/engine/aquecimento.js",
  "./js/engine/recordes.js",
  "./js/engine/medidas.js",
  "./js/engine/sessao.js",
  "./js/engine/graficos.js",
  "./js/engine/divisao.js",
  "./js/data/equipamento.js",
  "./js/data/medidas.js",
  "./js/screens/treino.js",
  "./js/screens/timer.js",
  "./js/screens/biblioteca.js",
  "./js/screens/historico.js",
  "./js/screens/config.js",
  "./js/screens/evolucao.js",
  "./js/screens/divisao.js",
  "./data/perfil.json",
  "./data/protocolo.json",
  "./data/exercicios.json",
  "./data/dieta.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || Response.error())
      )
  );
});
