// sw.js
const CACHE_NAME = "app-treino-shell-v37";
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
  "./js/data/cardio.js",
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
  "./js/engine/sequenciaSemanal.js",
  "./js/engine/alertasRecuperacao.js",
  "./js/engine/alertasDesempenho.js",
  "./js/engine/alertasVolume.js",
  "./js/engine/cardio.js",
  "./js/engine/sessaoGerada.js",
  "./js/engine/contextoSessao.js",
  "./js/engine/fichaFixa.js",
  "./js/engine/atividade.js",
  "./js/data/equipamento.js",
  "./js/data/medidas.js",
  "./js/data/sequenciaSemanal.js",
  "./js/data/dieta.js",
  "./js/engine/nutricao.js",
  "./js/ai/gemini.js",
  "./js/data/habitos.js",
  "./js/data/sync.js",
  "./js/data/supabaseClient.js",
  "./js/data/ficha.js",
  "./js/data/postura.js",
  "./js/engine/autorregulacao.js",
  "./js/engine/lembretes.js",
  "./js/engine/perguntasDiarias.js",
  "./js/lib/notificacoes.js",
  "./js/screens/treino.js",
  "./js/screens/timer.js",
  "./js/screens/biblioteca.js",
  "./js/screens/historico.js",
  "./js/screens/config.js",
  "./js/screens/perguntasDiarias.js",
  "./js/screens/evolucao.js",
  "./js/screens/divisao.js",
  "./js/screens/execucao.js",
  "./js/screens/fila.js",
  "./js/screens/relatorio.js",
  "./js/screens/sessao.js",
  "./js/screens/seletorCarga.js",
  "./js/screens/iconeExercicio.js",
  "./js/screens/transicaoTela.js",
  "./js/screens/dieta.js",
  "./js/screens/postura.js",
  "./js/screens/cardioTimer.js",
  "./js/screens/novaAtividade.js",
  "./js/screens/telaSerieCheia.js",
  "./js/screens/editorCadencia.js",
  "./js/engine/cadencia.js",
  "./js/engine/ondaCadencia.js",
  "./js/data/ajustesCadencia.js",
  "./js/screens/cardioPrompt.js",
  "./js/lib/spring.js",
  "./js/lib/detailsAnimado.js",
  "./js/data/iconesExercicio.js",
  "./data/perfil.json",
  "./data/protocolo.json",
  "./data/exercicios.json",
  "./data/dieta.json",
  "./data/ficha.json",
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
