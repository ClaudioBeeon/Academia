// js/screens/cardioTimer.js
//
// Cronômetro regressivo do cardio prescrito do dia. Reaproveita o mesmo
// criarCronometro() do descanso entre séries (js/screens/timer.js), que
// guarda um alvo em relógio de parede — então minimizar o app não faz o
// tempo "congelar": ao voltar, o restante é recalculado pelo tempo real
// decorrido, não pelo número de ticks que o navegador deixou de disparar.
//
// Limitação de plataforma (mesma documentada em js/lib/notificacoes.js):
// não existe alarme real com o app fechado num PWA sem servidor de push.
// O que dá pra fazer, e é o que está aqui: manter a tela acesa via Wake
// Lock enquanto o cardio roda, e avisar por som + vibração ao terminar,
// que funcionam enquanto a tela está ligada.
import { criarCronometro } from "./timer.js";
import { registrarCardio } from "../data/cardio.js";

const NOME_MODALIDADE = {
  bicicleta: "Bicicleta", eliptico: "Elíptico", escada: "Escada",
  caminhada: "Caminhada", corrida: "Corrida", patins: "Patins",
  volei_praia: "Vôlei de praia", beach_tenis: "Beach tênis",
};

const INTENSIDADES = [
  [1, "Muito leve"], [2, "Leve"], [3, "Moderada"], [4, "Forte"], [5, "Muito forte"],
];

const TAMANHO_ANEL = 232;
const ESPESSURA_ANEL = 10;

function formatarRelogio(segundos) {
  const min = String(Math.floor(segundos / 60)).padStart(2, "0");
  const seg = String(Math.floor(segundos % 60)).padStart(2, "0");
  return `${min}:${seg}`;
}

// Bipe curto via Web Audio — evita depender de um arquivo de áudio no
// bundle. Só toca se o navegador permitir (contexto criado após um toque
// do usuário, que é sempre o caso aqui: a tela abre por um clique).
function tocarAlarme() {
  try {
    const Contexto = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const inicio = ctx.currentTime + i * 0.42;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.35, inicio + 0.03);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.3);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.32);
    }
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {
    /* som é um extra: se o navegador barrar, o cronômetro segue igual */
  }
}

export function montarTelaCardio(db, { hoje, modalidade, duracaoMin, aoVoltar, aoConcluir } = {}) {
  const totalSegundos = Math.max(1, Math.round((duracaoMin ?? 20) * 60));
  const nome = NOME_MODALIDADE[modalidade] ?? modalidade ?? "Cardio";

  const raio = (TAMANHO_ANEL - ESPESSURA_ANEL) / 2;
  const perimetro = 2 * Math.PI * raio;

  const root = document.createElement("div");
  root.className = "tela-cardio";
  root.innerHTML = `
    <header class="top">
      <div>
        <div class="date-label">Cardio de hoje</div>
        <div class="day-title"></div>
      </div>
      <button type="button" class="icon-btn" aria-label="Fechar">✕</button>
    </header>
    <main>
      <div class="cardio-anel">
        <svg width="${TAMANHO_ANEL}" height="${TAMANHO_ANEL}" viewBox="0 0 ${TAMANHO_ANEL} ${TAMANHO_ANEL}" aria-hidden="true">
          <circle cx="${TAMANHO_ANEL / 2}" cy="${TAMANHO_ANEL / 2}" r="${raio}" fill="none"
            stroke="var(--card-2)" stroke-width="${ESPESSURA_ANEL}" />
          <circle class="progresso" cx="${TAMANHO_ANEL / 2}" cy="${TAMANHO_ANEL / 2}" r="${raio}" fill="none"
            stroke="var(--accent)" stroke-width="${ESPESSURA_ANEL}" stroke-linecap="round"
            stroke-dasharray="${perimetro.toFixed(1)}" stroke-dashoffset="0"
            transform="rotate(-90 ${TAMANHO_ANEL / 2} ${TAMANHO_ANEL / 2})" />
        </svg>
        <div class="centro">
          <div class="rel" role="timer" aria-live="off"></div>
          <div class="sub"></div>
        </div>
      </div>
      <div class="cardio-controles">
        <button type="button" class="cardio-ajuste" data-delta="-60">−1 min</button>
        <button type="button" class="cardio-play"></button>
        <button type="button" class="cardio-ajuste" data-delta="60">+1 min</button>
      </div>
      <p class="cardio-nota"></p>
    </main>
    <div class="foot">
      <button type="button" class="cardio-encerrar">Encerrar e registrar</button>
    </div>
  `;

  root.querySelector(".day-title").textContent = nome;

  const relEl = root.querySelector(".rel");
  const subEl = root.querySelector(".sub");
  const notaEl = root.querySelector(".cardio-nota");
  const progressoEl = root.querySelector(".progresso");
  const playBtn = root.querySelector(".cardio-play");
  const encerrarBtn = root.querySelector(".cardio-encerrar");
  const controlesEl = root.querySelector(".cardio-controles");

  let rodando = false;
  let terminou = false;
  let wakeLock = null;
  let duracaoAlvo = totalSegundos; // muda se o usuário usar ±1 min

  subEl.textContent = `de ${formatarRelogio(totalSegundos)}`;

  function pintar(restante) {
    relEl.textContent = formatarRelogio(restante);
    const fracaoFeita = duracaoAlvo > 0 ? 1 - Math.min(1, restante / duracaoAlvo) : 0;
    progressoEl.style.strokeDashoffset = (perimetro * (1 - fracaoFeita)).toFixed(1);
  }

  const cronometro = criarCronometro({
    duracaoInicialSegundos: totalSegundos,
    aoAtualizar: pintar,
    aoFinalizar: () => {
      rodando = false;
      terminou = true;
      liberarWakeLock();
      if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
      tocarAlarme();
      root.classList.add("cardio-fim");
      atualizarPlay();
      notaEl.textContent = "Tempo concluído. Registre a intensidade abaixo.";
      controlesEl.style.display = "none";
      mostrarIntensidade();
    },
  });

  async function pedirWakeLock() {
    if (!("wakeLock" in navigator)) return;
    if (wakeLock && !wakeLock.released) return;
    try { wakeLock = await navigator.wakeLock.request("screen"); } catch { /* negado: segue sem */ }
  }
  function liberarWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  function atualizarPlay() {
    if (terminou) { playBtn.textContent = "Concluído"; playBtn.disabled = true; return; }
    playBtn.textContent = rodando ? "Pausar" : "Iniciar";
    playBtn.classList.toggle("rodando", rodando);
  }

  function alternar() {
    if (terminou) return;
    if (rodando) {
      cronometro.parar();
      rodando = false;
      liberarWakeLock();
      notaEl.textContent = "Pausado.";
    } else {
      cronometro.iniciar();
      rodando = true;
      pedirWakeLock();
      notaEl.textContent = "A tela fica acesa enquanto o cardio roda.";
    }
    atualizarPlay();
  }

  playBtn.addEventListener("click", alternar);

  for (const botao of root.querySelectorAll(".cardio-ajuste")) {
    botao.addEventListener("click", () => {
      if (terminou) return;
      const delta = Number(botao.dataset.delta);
      cronometro.ajustar(delta);
      duracaoAlvo = Math.max(1, duracaoAlvo + delta);
      subEl.textContent = `de ${formatarRelogio(duracaoAlvo)}`;
      pintar(cronometro.obterRestante());
    });
  }

  // Minutos que realmente rolaram, não os prescritos — se encerrar antes,
  // registra o que foi feito de verdade.
  function minutosFeitos() {
    const restante = cronometro.obterRestante();
    return Math.max(1, Math.round((duracaoAlvo - restante) / 60));
  }

  function mostrarIntensidade() {
    if (root.querySelector(".cardio-intensidade")) return;
    const bloco = document.createElement("div");
    bloco.className = "cardio-intensidade";
    bloco.innerHTML = `<div class="rot">Como foi a intensidade?</div><div class="opcoes"></div>`;
    const opcoes = bloco.querySelector(".opcoes");
    for (const [valor, rotulo] of INTENSIDADES) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "swap-pill";
      botao.textContent = rotulo;
      botao.dataset.valor = String(valor);
      botao.addEventListener("click", () => {
        for (const outro of opcoes.querySelectorAll("button")) {
          outro.classList.toggle("selecionada", outro === botao);
        }
      });
      opcoes.appendChild(botao);
    }
    root.querySelector("main").appendChild(bloco);
  }

  encerrarBtn.addEventListener("click", async () => {
    const selecionada = root.querySelector(".cardio-intensidade .selecionada");
    if (!terminou && !selecionada) mostrarIntensidade();

    const intensidadePercebida = Number(selecionada?.dataset.valor ?? 3);
    encerrarBtn.disabled = true;
    cronometro.parar();
    rodando = false;
    liberarWakeLock();

    await registrarCardio(db, {
      data: hoje,
      modalidade,
      duracaoMinutos: minutosFeitos(),
      intensidadePercebida,
      mesmoDiaDeTreino: true,
    });

    limpar();
    if (aoConcluir) aoConcluir();
  });

  root.querySelector('[aria-label="Fechar"]').addEventListener("click", () => {
    limpar();
    if (aoVoltar) aoVoltar();
  });

  // Mesmo tratamento da execução: ao voltar do segundo plano, o restante é
  // recalculado pelo relógio real em vez de continuar de onde os ticks
  // pararam. Sem isso o cronômetro parece "travado" ao reabrir o app.
  function aoVoltarAoPrimeiroPlano() {
    if (document.visibilityState === "hidden") return;
    if (rodando) {
      cronometro.resincronizar();
      pedirWakeLock(); // o Wake Lock cai sozinho quando a aba sai de foco
    }
  }
  document.addEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
  window.addEventListener("focus", aoVoltarAoPrimeiroPlano);

  function limpar() {
    cronometro.parar();
    liberarWakeLock();
    document.removeEventListener("visibilitychange", aoVoltarAoPrimeiroPlano);
    window.removeEventListener("focus", aoVoltarAoPrimeiroPlano);
  }

  pintar(totalSegundos);
  atualizarPlay();
  notaEl.textContent = `Prescrito pra hoje: ${duracaoMin ?? "—"} min.`;

  return root;
}
