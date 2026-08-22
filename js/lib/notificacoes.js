// js/lib/notificacoes.js
//
// Wrapper fino sobre a Notification API do navegador. Limitação real de PWA
// (adendo seção Sugestões): sem servidor de push, só dá pra notificar
// enquanto o app está aberto/em primeiro plano (ou logo que é reaberto) —
// não existe lembrete de verdade rodando com o app fechado. Documentado
// aqui pra não vender uma garantia que a plataforma não entrega.

export function permissaoConcedida() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function statusPermissao() {
  if (typeof Notification === "undefined") return "indisponivel";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function pedirPermissaoNotificacao() {
  if (typeof Notification === "undefined") return "indisponivel";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.error("Falha ao pedir permissão de notificação:", err);
    return "denied";
  }
}

export async function mostrarNotificacao(titulo, opcoes = {}) {
  if (!permissaoConcedida()) return false;
  try {
    const registro = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (registro?.showNotification) {
      await registro.showNotification(titulo, opcoes);
    } else {
      new Notification(titulo, opcoes);
    }
    return true;
  } catch (err) {
    console.error("Falha ao mostrar notificação:", err);
    return false;
  }
}
