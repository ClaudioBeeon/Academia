// js/lib/spring.js
// Motor de animação por física de mola (o mesmo modelo — massa/rigidez/
// amortecimento — usado pelo UIKit e pela Motion do iOS), escrito à mão pra
// não depender de CDN: o app roda offline na academia, então qualquer
// biblioteca externa carregada em runtime é um ponto de falha.

const IOS_PADRAO = { rigidez: 300, amortecimento: 26, massa: 1 };
const EPSILON_POSICAO = 0.4;
const EPSILON_VELOCIDADE = 1.2;

function simularMola(valorInicial, valorAlvo, { rigidez, amortecimento, massa }) {
  let posicao = valorInicial;
  let velocidade = 0;
  return function passo(dtSegundos) {
    const forca = -rigidez * (posicao - valorAlvo);
    const amortecedor = -amortecimento * velocidade;
    const aceleracao = (forca + amortecedor) / massa;
    velocidade += aceleracao * dtSegundos;
    posicao += velocidade * dtSegundos;
    const parado = Math.abs(posicao - valorAlvo) < EPSILON_POSICAO && Math.abs(velocidade) < EPSILON_VELOCIDADE;
    return { posicao: parado ? valorAlvo : posicao, parado };
  };
}

/**
 * Anima translateX/translateY/scale/opacity de um elemento com física de
 * mola. `de`/`para` aceitam as chaves: x, y, scale, opacity (todas opcionais).
 * Retorna { parar, finalizado } — finalizado é uma Promise que resolve
 * quando a mola de todas as propriedades assenta (ou quando parar() é chamado).
 */
export function animarSpring(elemento, de, para, config = {}) {
  const { rigidez, amortecimento, massa } = { ...IOS_PADRAO, ...config };
  const props = Object.keys(para);
  const passos = Object.fromEntries(
    props.map((p) => [p, simularMola(de[p] ?? (p === "opacity" ? 1 : p === "scale" ? 1 : 0), para[p], { rigidez, amortecimento, massa })])
  );

  const estado = { x: de.x ?? 0, y: de.y ?? 0, scale: de.scale ?? 1, opacity: de.opacity ?? 1 };

  function aplicarEstilo() {
    const transformPartes = [];
    if ("x" in para || "y" in para) transformPartes.push(`translate3d(${estado.x}px, ${estado.y}px, 0)`);
    if ("scale" in para) transformPartes.push(`scale(${estado.scale})`);
    if (transformPartes.length) elemento.style.transform = transformPartes.join(" ");
    if ("opacity" in para) elemento.style.opacity = String(Math.min(1, Math.max(0, estado.opacity)));
  }

  let quadroId = null;
  let ultimoTs = null;
  let resolverFinalizado;
  const finalizado = new Promise((resolve) => { resolverFinalizado = resolve; });

  function quadro(ts) {
    if (ultimoTs == null) ultimoTs = ts;
    const dt = Math.min(0.032, (ts - ultimoTs) / 1000);
    ultimoTs = ts;

    let todosParados = true;
    for (const p of props) {
      const { posicao, parado } = passos[p](dt);
      estado[p] = posicao;
      if (!parado) todosParados = false;
    }
    aplicarEstilo();

    if (todosParados) {
      // Zera x/y/scale de verdade (não só chegar em 0) — um transform
      // residual, mesmo identidade, cria um novo "containing block" e
      // quebra qualquer position:fixed dentro do elemento (ex.: o rodapé
      // fixo de js/screens/execucao.js passa a ficar preso ao fim do
      // conteúdo da tela em vez de fixo na janela).
      if ("x" in para || "y" in para || "scale" in para) elemento.style.transform = "";
      resolverFinalizado();
      return;
    }
    quadroId = requestAnimationFrame(quadro);
  }

  aplicarEstilo();
  quadroId = requestAnimationFrame(quadro);

  function parar() {
    if (quadroId != null) cancelAnimationFrame(quadroId);
    resolverFinalizado();
  }

  return { parar, finalizado };
}
