// js/data/guiaAtaqueVolei.js
//
// Guia desenhado do ataque (cortada pra baixo): a mão, onde bater, o
// estalo do punho e o braço em "arco e flecha". Mesmo estilo e cores do
// guia do toque (js/data/guiaToqueVolei.js), de onde vêm os ajudantes.

import { COR, bola, envelope, texto, bracoDeLado } from "./guiaToqueVolei.js";

const linha = (a, b, { cor = COR.linha, largura = 7 } = {}) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round"/>`;

const cabeca = (x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="${COR.pele}" stroke="${COR.linha}" stroke-width="3"/>`;

// Painel 1 — a mão: aberta, dedos juntos, bate com a mão inteira.
function painelMao() {
  const dedos = [
    [110, 60], [130, 52], [150, 56], [170, 68],
  ].map(([x, topo]) => `<rect x="${x - 9}" y="${topo}" width="18" height="${150 - topo}" rx="9" fill="${COR.principal}" stroke="${COR.linha}" stroke-width="2.5"/>`);
  const corpo = `
    ${texto(16, 26, "A mão que bate", { tam: 13, peso: 700 })}
    ${dedos.join("")}
    <path d="M102,188 L70,150 A11,11 0 0 1 86,136 L112,166 Z" fill="${COR.principal}" stroke="${COR.linha}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="98" y="130" width="84" height="92" rx="30" fill="${COR.principal}" stroke="${COR.linha}" stroke-width="2.5"/>
    <rect x="104" y="196" width="72" height="22" rx="11" fill="${COR.principalEscuro}" opacity="0.85"/>
    <line x1="182" y1="100" x2="214" y2="92" stroke="${COR.textoFraco}" stroke-width="1"/>
    ${texto(218, 96, "dedos juntos", { tam: 10 })}
    <line x1="182" y1="165" x2="214" y2="150" stroke="${COR.textoFraco}" stroke-width="1"/>
    ${texto(218, 154, "palma em concha", { tam: 10 })}
    <line x1="176" y1="208" x2="214" y2="204" stroke="${COR.textoFraco}" stroke-width="1"/>
    ${texto(218, 208, "base da palma", { tam: 10 })}
    ${texto(140, 252, "✓ bate com a mão inteira", { tam: 11, peso: 700, cor: COR.principalEscuro, ancora: "middle" })}
    <rect x="336" y="136" width="62" height="58" rx="18" fill="${COR.pele}" stroke="${COR.errado}" stroke-width="3"/>
    <path d="M344,152 h46 M344,166 h46 M344,180 h46" stroke="${COR.peleEscura}" stroke-width="3" stroke-linecap="round"/>
    ${texto(367, 124, "✗ fechada", { tam: 11, peso: 700, cor: COR.errado, ancora: "middle" })}
    ${texto(367, 218, "pouco contato,", { tam: 10, cor: COR.errado, ancora: "middle" })}
    ${texto(367, 234, "sem giro", { tam: 10, cor: COR.errado, ancora: "middle" })}`;
  return envelope(440, 266, corpo, "Mão aberta com os dedos juntos, comparada com a mão fechada");
}

// Bonequinho no ar, de lado (olhando pra direita), com o braço de ataque.
function bonecoNoAr(x, { maoAtaque, outroBraco, cotoveloAtaque = null }) {
  const t = ([a, b]) => [a + x, b];
  const ombro = t([60, 118]);
  return `
    ${linha(t([56, 190]), t([42, 224]))}${linha(t([42, 224]), t([52, 252]))}
    ${linha(t([56, 190]), t([68, 226]))}${linha(t([68, 226]), t([58, 256]))}
    ${linha(t([56, 190]), ombro, { largura: 9 })}
    ${cabeca(...t([62, 96]))}
    ${linha(ombro, t(outroBraco))}
    ${cotoveloAtaque ? linha(ombro, t(cotoveloAtaque)) + linha(t(cotoveloAtaque), t(maoAtaque)) : linha(ombro, t(maoAtaque))}
    <circle cx="${t(maoAtaque)[0]}" cy="${t(maoAtaque)[1]}" r="6" fill="${COR.principal}" stroke="${COR.linha}" stroke-width="2"/>`;
}

// Painel 2 — onde bater: no alto, braço esticado, bola à frente do ombro.
function painelContato() {
  const corpo = `
    ${texto(16, 26, "Onde bater", { tam: 13, peso: 700 })}
    <rect x="8" y="38" width="208" height="266" rx="10" fill="#fff" stroke="${COR.principal}" stroke-width="2"/>
    <rect x="224" y="38" width="208" height="266" rx="10" fill="#fff" stroke="${COR.errado}" stroke-width="2"/>
    ${bonecoNoAr(10, { maoAtaque: [92, 58], outroBraco: [84, 160] })}
    ${bola("ba-contato-1", 110, 50, 15)}
    <line x1="${10 + 60}" y1="118" x2="${10 + 60}" y2="44" stroke="${COR.movimento}" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M126,58 Q176,84 196,190" stroke="${COR.principal}" stroke-width="3" fill="none" marker-end="url(#seta-azul)"/>
    ${texto(112, 280, "✓ no alto, braço esticado,", { tam: 10, ancora: "middle", peso: 700, cor: COR.principalEscuro })}
    ${texto(112, 295, "bola à frente do ombro", { tam: 10, ancora: "middle" })}
    ${bonecoNoAr(236, { maoAtaque: [50, 76], outroBraco: [84, 160] })}
    ${bola("ba-contato-2", 236 + 42, 60, 15)}
    <path d="M${236 + 58},54 Q${236 + 120},20 ${236 + 190},70" stroke="${COR.errado}" stroke-width="3" fill="none" marker-end="url(#seta-vermelha)"/>
    ${texto(328, 280, "✗ bola em cima ou atrás", { tam: 10, ancora: "middle", peso: 700, cor: COR.errado })}
    ${texto(328, 295, "da cabeça: sobe e sai", { tam: 10, ancora: "middle" })}`;
  return envelope(440, 312, corpo, "Ponto de contato certo à frente do ombro e errado atrás da cabeça");
}

// Painel 3 — o estalo do punho por cima da bola (de lado, 3 tempos).
function painelPunho() {
  const quadros = [
    { x: 0, titulo: "1. Chega", cot: [48, 226], pun: [70, 150], ang: 120, bola: [96, 118], nota: ["punho aberto,", "mão atrás da bola"] },
    { x: 146, titulo: "2. Bate", cot: [44, 224], pun: [66, 146], ang: 72, bola: [92, 112], nota: ["mão inteira", "atrás e em cima"] },
    { x: 292, titulo: "3. Estala", cot: [40, 222], pun: [64, 144], ang: 18, bola: [112, 150], nota: ["punho dobra por", "cima: bola gira"] },
  ];
  const partes = quadros.map((q, i) => {
    const d = ([a, b]) => [a + q.x, b];
    const braco = bracoDeLado(d(q.cot), d(q.pun), q.ang, 36);
    const [bx, by] = d(q.bola);
    let extra = "";
    if (i === 2) {
      extra = `
        <path d="M${bx - 20},${by - 16} A24,24 0 0 1 ${bx + 20},${by - 16}" stroke="${COR.movimento}" stroke-width="3" fill="none" marker-end="url(#seta-azul)"/>
        <path d="M${bx + 6},${by + 22} Q${bx + 18},${by + 50} ${bx + 12},${by + 70}" stroke="${COR.principal}" stroke-width="3" fill="none" marker-end="url(#seta-azul)"/>`;
    }
    if (i === 1) extra = `<path d="M${q.x + 40},${108} A26,26 0 0 1 ${q.x + 78},${86}" stroke="${COR.movimento}" stroke-width="3" fill="none" marker-end="url(#seta-azul)"/>`;
    return `
      <rect x="${q.x + 6}" y="34" width="136" height="238" rx="10" fill="#fff" stroke="#e5e7eb"/>
      ${texto(q.x + 74, 56, q.titulo, { tam: 12, peso: 700, ancora: "middle" })}
      ${bola(`ba-punho-${i}`, bx, by, 20)}
      ${braco.svg}
      ${extra}
      ${texto(q.x + 74, 248, q.nota[0], { tam: 10, ancora: "middle", cor: COR.textoFraco })}
      ${texto(q.x + 74, 263, q.nota[1], { tam: 10, ancora: "middle", cor: COR.textoFraco })}`;
  });
  const corpo = `
    ${texto(16, 24, "O estalo do punho (ponto azul)", { tam: 13, peso: 700 })}
    ${partes.join("")}`;
  return envelope(440, 280, corpo, "Três tempos do punho no ataque: chega, bate e estala por cima da bola");
}

// Painel 4 — o braço em "arco e flecha" e a finalização.
function painelArco() {
  const corpo = `
    ${texto(16, 24, "Braço em arco e flecha", { tam: 13, peso: 700 })}
    ${texto(112, 50, "1. Prepara", { tam: 12, peso: 700, ancora: "middle" })}
    ${texto(328, 50, "2. Bate e acompanha", { tam: 12, peso: 700, ancora: "middle" })}
    ${bonecoNoAr(40, { cotoveloAtaque: [30, 100], maoAtaque: [46, 70], outroBraco: [100, 70] })}
    <circle cx="70" cy="100" r="6" fill="${COR.movimento}" stroke="#fff" stroke-width="2"/>
    <line x1="28" y1="118" x2="64" y2="104" stroke="${COR.movimento}" stroke-width="1"/>
    ${texto(8, 132, "cotovelo alto,", { tam: 10, cor: COR.movimento })}
    ${texto(8, 147, "na orelha", { tam: 10, cor: COR.movimento })}
    <line x1="142" y1="72" x2="150" y2="96" stroke="${COR.textoFraco}" stroke-width="1"/>
    ${texto(128, 112, "outra mão", { tam: 10, cor: COR.textoFraco })}
    ${texto(128, 127, "aponta a bola", { tam: 10, cor: COR.textoFraco })}
    <line x1="220" y1="40" x2="220" y2="270" stroke="#e5e7eb" stroke-width="2"/>
    ${bonecoNoAr(300, { maoAtaque: [100, 176], outroBraco: [36, 150] })}
    <path d="M${300 + 70},62 A70,70 0 0 1 ${300 + 100},170" stroke="${COR.movimento}" stroke-width="3" fill="none" stroke-dasharray="6 4" marker-end="url(#seta-azul)"/>
    ${texto(228, 196, "braço desce", { tam: 10, cor: COR.movimento })}
    ${texto(228, 211, "cruzando até", { tam: 10, cor: COR.movimento })}
    ${texto(228, 226, "o quadril", { tam: 10, cor: COR.movimento })}`;
  return envelope(440, 278, corpo, "Preparação do braço em arco e flecha e a finalização cruzando o corpo");
}

export const GUIA_ATAQUE_VOLEI = [
  {
    titulo: "1. A mão",
    svg: painelMao(),
    pontos: [
      "Mão aberta, dedos juntos (ou só um pouco afastados), palma em concha no formato da bola.",
      "Bate com a mão inteira ao mesmo tempo: base da palma, palma e dedos. Firme, sem os dedos dobrarem pra trás.",
      "Mão fechada tem pouco contato, pouca direção e não dá giro — só pra salvar bola ruim.",
    ],
  },
  {
    titulo: "2. Onde bater",
    svg: painelContato(),
    pontos: [
      "No ponto mais alto, com o braço totalmente esticado.",
      "Bola um pouco à frente do ombro do braço que ataca. Em cima ou atrás da cabeça, ela sobe e sai.",
      "Acerta a parte de cima e de trás da bola.",
    ],
  },
  {
    titulo: "3. O punho",
    svg: painelPunho(),
    pontos: [
      "Sim, \"quebra a munheca\": no contato o punho dobra por cima da bola e os dedos embrulham a parte de cima.",
      "É isso que dá o giro pra frente que faz a bola afundar. A FORÇA vem das pernas, do tronco e do braço — o punho dá o giro e a direção.",
      "Punho solto, estalo rápido junto com o braço — não um movimento separado depois.",
    ],
  },
  {
    titulo: "4. O braço",
    svg: painelArco(),
    pontos: [
      "Os dois braços sobem no salto. O do ataque vai com o cotovelo alto, na altura da orelha, como quem puxa um arco.",
      "A outra mão aponta a bola e desce com força: é ela que faz o tronco girar.",
      "Termine o braço descendo e cruzando o corpo até o quadril do outro lado.",
      "Na praia: cortada de mão aberta vale; largadinha com a ponta dos dedos abertos é falta — use os nós dos dedos ou os dedos juntos e esticados (\"cobra\").",
    ],
  },
];
