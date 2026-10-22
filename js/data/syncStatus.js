// js/data/syncStatus.js
//
// Estado da sincronização pra quem quiser mostrar (o ícone no canto da tela).
// Só guarda e avisa — quem muda o estado é js/data/sync.js. Sem DOM nem rede.
//
// fase: "desligado" (sem Supabase ou sem login) | "sincronizando" | "ok" |
//       "offline" (sem sinal, com alterações esperando) | "erro".

let estado = { fase: "desligado", pendentes: 0, ultimoOk: null };
const ouvintes = new Set();

export function obterEstadoSync() {
  return estado;
}

export function definirEstadoSync(parcial) {
  estado = { ...estado, ...parcial };
  for (const fn of ouvintes) {
    try { fn(estado); } catch (err) { console.error("Falha num ouvinte de sync:", err); }
  }
}

export function observarEstadoSync(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
