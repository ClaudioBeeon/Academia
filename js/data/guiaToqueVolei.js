// js/data/guiaToqueVolei.js
//
// Guia ilustrado do toque (levantamento): desenhos em SVG feitos à mão, com
// os dedos coloridos por função, a área de contato marcada e setas no que
// tem que se mexer. SVG em vez de imagem gerada: fica exato (imagem de IA
// erra dedo e mão), pesa quase nada e funciona offline.
//
// Cada painel é { titulo, svg, pontos[] }. Cores fixas (fundo claro próprio)
// pra ficar igual no tema claro e no escuro.

const COR = {
  fundo: "#f8fafc",
  linha: "#1f2937",
  pele: "#f2cba8",
  peleEscura: "#d9a27a",
  principal: "#22c55e",
  principalEscuro: "#15803d",
  apoio: "#facc15",
  apoioEscuro: "#a16207",
  errado: "#dc2626",
  movimento: "#2563eb",
  bolaAzul: "#1d4ed8",
  bolaAmarela: "#fbbf24",
  texto: "#111827",
  textoFraco: "#4b5563",
};

const r1 = (n) => Math.round(n * 10) / 10;

function ponto(cx, cy, raio, anguloGraus, lado) {
  const a = (anguloGraus * Math.PI) / 180;
  return [r1(cx + lado * raio * Math.sin(a)), r1(cy + raio * Math.cos(a))];
}

// Pedaço de uma curva quadrática de t até 1 (de Casteljau).
function trechoFinal([p0, p1, p2], t) {
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  return [lerp(a, b, t), b, p2];
}

const caminho = ([p0, p1, p2]) => `M${r1(p0[0])},${r1(p0[1])} Q${r1(p1[0])},${r1(p1[1])} ${r1(p2[0])},${r1(p2[1])}`;

function bola(id, cx, cy, r, { fita = false, fitaGirando = false } = {}) {
  const faixa = (cor, dy, largura) =>
    `<path d="M${r1(cx - r * 1.1)},${r1(cy + dy * r - r * 0.35)} Q${cx},${r1(cy + dy * r + r * 0.45)} ${r1(cx + r * 1.1)},${r1(cy + dy * r - r * 0.35)}" stroke="${cor}" stroke-width="${r1(r * largura)}" fill="none"/>`;
  const fitaSvg = fita
    ? fitaGirando
      ? `<path d="M${r1(cx - r * 0.35)},${r1(cy - r * 1.05)} Q${r1(cx + r * 0.55)},${cy} ${r1(cx - r * 0.35)},${r1(cy + r * 1.05)}" stroke="${COR.linha}" stroke-width="${r1(r * 0.16)}" fill="none"/>`
      : `<line x1="${r1(cx - r)}" y1="${cy}" x2="${r1(cx + r)}" y2="${cy}" stroke="${COR.linha}" stroke-width="${r1(r * 0.16)}"/>`
    : "";
  return `
    <clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>
    <g clip-path="url(#${id})">${faixa(COR.bolaAzul, -0.35, 0.28)}${faixa(COR.bolaAmarela, 0.2, 0.22)}${faixa(COR.bolaAzul, 0.72, 0.26)}${fitaSvg}</g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COR.linha}" stroke-width="2"/>`;
}

// Dedos vistos de baixo (do rosto de quem levanta): [nome, ângulo da ponta,
// ângulo da base, raio da ponta, raio da base, função]. Ângulo 0 = embaixo
// da bola (perto dos olhos), 90 = do lado.
const DEDOS = [
  ["polegar", 16, 40, 0.84, 1.72, "principal", 17],
  ["indicador", 46, 52, 0.88, 1.5, "principal", 15],
  ["médio", 78, 63, 0.88, 1.47, "principal", 15],
  ["anelar", 108, 74, 0.88, 1.5, "apoio", 14],
  ["mínimo", 134, 84, 0.88, 1.58, "apoio", 12],
];

// Uma mão vista de baixo. `praia`: bola mais funda e mais dedo encostando.
function maoDeBaixo(cx, cy, r, lado, { praia = false, rotulos = false } = {}) {
  const inicioContato = praia ? 0.12 : 0.58;
  const partes = [];
  const bases = [];
  for (const [nome, aPonta, aBase, rPonta, rBase, funcao, largura] of DEDOS) {
    const p2 = ponto(cx, cy, r * rPonta * (praia ? 0.86 : 1), aPonta * (praia ? 1.08 : 1), lado);
    const p0 = ponto(cx, cy, r * rBase, aBase, lado);
    const p1 = ponto(cx, cy, r * 1.2, aPonta * 0.8 + aBase * 0.2, lado);
    bases.push(p0);
    const cor = funcao === "principal" ? COR.principal : COR.apoio;
    const escuro = funcao === "principal" ? COR.principalEscuro : COR.apoioEscuro;
    const w = largura * (r / 80);
    const curva = [p0, p1, p2];
    partes.push(`<path d="${caminho(curva)}" stroke="${COR.linha}" stroke-width="${r1(w + 3)}" stroke-linecap="round" fill="none"/>`);
    partes.push(`<path d="${caminho(curva)}" stroke="${cor}" stroke-width="${r1(w)}" stroke-linecap="round" fill="none"/>`);
    partes.push(`<path d="${caminho(trechoFinal(curva, inicioContato))}" stroke="${escuro}" stroke-width="${r1(w * 0.45)}" stroke-linecap="round" fill="none" opacity="0.9"/>`);
    if (rotulos && lado === 1) partes.push({ nome, p2, funcao });
  }
  const externo = [ponto(cx, cy, r * 1.95, 86, lado), ponto(cx, cy, r * 2.25, 66, lado), ponto(cx, cy, r * 2.0, 46, lado)];
  const contorno = [...bases, ...externo].map((p) => p.join(",")).join(" L");
  const palmaSvg = `<path d="M${contorno} Z" fill="${COR.pele}" stroke="${COR.errado}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
  const desenho = partes.filter((p) => typeof p === "string");
  const rotulosDedos = partes.filter((p) => typeof p !== "string");
  return { svg: palmaSvg + desenho.join(""), rotulosDedos, externo };
}

function envelope(largura, altura, corpo, descricao) {
  return `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${descricao}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:12px;background:${COR.fundo};font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <defs>
      <marker id="seta-azul" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COR.movimento}"/></marker>
      <marker id="seta-vermelha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COR.errado}"/></marker>
      <marker id="seta-cinza" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COR.textoFraco}"/></marker>
    </defs>
    ${corpo}
  </svg>`;
}

const texto = (x, y, conteudo, { tam = 12, cor = COR.texto, peso = 400, ancora = "start" } = {}) =>
  `<text x="${x}" y="${y}" font-size="${r1(tam * 1.3)}" fill="${cor}" font-weight="${peso}" text-anchor="${ancora}">${conteudo}</text>`;

const legendaCor = (x, y, cor, rotulo) =>
  `<rect x="${x}" y="${y - 9}" width="14" height="10" rx="3" fill="${cor}" stroke="${COR.linha}" stroke-width="1"/>${texto(x + 19, y, rotulo, { tam: 11 })}`;

// Painel 1 — os dedos, vistos de baixo.
function painelDedos() {
  const cx = 200, cy = 118, r = 70;
  const direita = maoDeBaixo(cx, cy, r, 1, { rotulos: true });
  const esquerda = maoDeBaixo(cx, cy, r, -1);
  const [pd, pe] = [ponto(cx, cy, r * 0.86, 20, 1), ponto(cx, cy, r * 0.86, 20, -1)];
  const [id, ie] = [ponto(cx, cy, r * 0.88, 50, 1), ponto(cx, cy, r * 0.88, 50, -1)];
  const janela = `<path d="M${pe.join(",")} L${pd.join(",")} L${id.join(",")} L${ie.join(",")} Z" fill="#7c3aed" fill-opacity="0.22" stroke="#7c3aed" stroke-width="2.5" stroke-dasharray="4 3"/>`;
  const rotulos = direita.rotulosDedos.map(({ nome, p2 }, i) => {
    const y = [206, 172, 116, 76, 42][i];
    return `<line x1="${p2[0]}" y1="${p2[1]}" x2="358" y2="${y - 5}" stroke="${COR.textoFraco}" stroke-width="1"/>` + texto(362, y, nome, { tam: 10 });
  });
  const corpo = `
    ${texto(16, 26, "Vista de baixo (como os olhos veem)", { tam: 13, peso: 700 })}
    ${bola("b-dedos", cx, cy, r)}
    ${esquerda.svg}${direita.svg}${janela}
    ${rotulos.join("")}
    <line x1="${cx}" y1="${cy + r * 0.95}" x2="${cx}" y2="226" stroke="#7c3aed" stroke-width="1"/>
    ${texto(cx - 30, 244, "janela (triângulo)", { tam: 11, cor: "#7c3aed", ancora: "middle" })}
    <line x1="${direita.externo[1][0] - 8}" y1="${direita.externo[1][1] - 6}" x2="352" y2="236" stroke="${COR.errado}" stroke-width="1"/>
    ${texto(300, 252, "palma não encosta", { tam: 11, cor: COR.errado })}
    ${legendaCor(16, 282, COR.principal, "força e direção")}
    ${legendaCor(210, 282, COR.apoio, "só apoio")}
    <rect x="16" y="297" width="14" height="10" rx="3" fill="${COR.principal}" stroke="${COR.linha}" stroke-width="1"/><rect x="20" y="300" width="10" height="4" rx="2" fill="${COR.principalEscuro}"/>
    ${texto(35, 306, "onde encosta na bola", { tam: 11 })}`;
  return envelope(440, 320, corpo, "Mãos na bola vistas de baixo, com os dedos coloridos por função");
}

// Braço + mão de lado, com o punho num ângulo. Pessoa olhando pra direita.
function bracoDeLado(cotovelo, punho, anguloMao, comprimentoMao, { corMao = COR.principal } = {}) {
  const a = (anguloMao * Math.PI) / 180;
  const ponta = [r1(punho[0] + comprimentoMao * Math.cos(a)), r1(punho[1] - comprimentoMao * Math.sin(a))];
  return {
    ponta,
    svg: `
      <line x1="${cotovelo[0]}" y1="${cotovelo[1]}" x2="${punho[0]}" y2="${punho[1]}" stroke="${COR.linha}" stroke-width="19" stroke-linecap="round"/>
      <line x1="${cotovelo[0]}" y1="${cotovelo[1]}" x2="${punho[0]}" y2="${punho[1]}" stroke="${COR.pele}" stroke-width="16" stroke-linecap="round"/>
      <line x1="${punho[0]}" y1="${punho[1]}" x2="${ponta[0]}" y2="${ponta[1]}" stroke="${COR.linha}" stroke-width="15" stroke-linecap="round"/>
      <line x1="${punho[0]}" y1="${punho[1]}" x2="${ponta[0]}" y2="${ponta[1]}" stroke="${corMao}" stroke-width="12" stroke-linecap="round"/>
      <circle cx="${punho[0]}" cy="${punho[1]}" r="7" fill="${COR.movimento}" stroke="#fff" stroke-width="2"/>`,
  };
}

// Painel 2 — o punho é uma mola (3 tempos, de lado).
function painelPunho() {
  const quadros = [
    { x: 0, titulo: "1. Chega", cot: [60, 222], pun: [76, 148], ang: 95, bola: [73, 104], nota: ["mãos prontas", "antes da bola"] },
    { x: 146, titulo: "2. Amortece", cot: [68, 226], pun: [80, 164], ang: 128, bola: [58, 122], nota: ["punho dobra", "pra trás (mola)"] },
    { x: 292, titulo: "3. Solta", cot: [40, 216], pun: [66, 138], ang: 62, bola: [96, 80], nota: ["estica e aponta", "pro alvo"] },
  ];
  const partes = quadros.map((q, i) => {
    const deslocar = ([x, y]) => [x + q.x, y];
    const braco = bracoDeLado(deslocar(q.cot), deslocar(q.pun), q.ang, 38);
    const [bx, by] = deslocar(q.bola);
    let extra = "";
    if (i === 0) extra = `<line x1="${bx}" y1="${by - 46}" x2="${bx}" y2="${by - 28}" stroke="${COR.textoFraco}" stroke-width="2" stroke-dasharray="4 3" marker-end="url(#seta-cinza)"/>`;
    if (i === 1) extra = `<path d="M${q.x + 112},${162} A30,30 0 0 0 ${q.x + 94},${128}" stroke="${COR.movimento}" stroke-width="3" fill="none" marker-end="url(#seta-azul)"/>`;
    if (i === 2) extra = `<line x1="${bx + 14}" y1="${by - 14}" x2="${bx + 32}" y2="${by - 32}" stroke="${COR.movimento}" stroke-width="3" marker-end="url(#seta-azul)"/>`;
    return `
      <rect x="${q.x + 6}" y="30" width="136" height="236" rx="10" fill="#fff" stroke="#e5e7eb"/>
      ${texto(q.x + 74, 54, q.titulo, { tam: 12, peso: 700, ancora: "middle" })}
      ${bola(`b-punho-${i}`, bx, by, 22)}
      ${braco.svg}
      ${extra}
      ${texto(q.x + 74, 244, q.nota[0], { tam: 10, ancora: "middle", cor: COR.textoFraco })}
      ${texto(q.x + 74, 259, q.nota[1], { tam: 10, ancora: "middle", cor: COR.textoFraco })}`;
  });
  const corpo = `
    ${texto(16, 22, "O punho (azul) é uma mola", { tam: 13, peso: 700 })}
    ${partes.join("")}
`;
  return envelope(440, 276, corpo, "Três tempos do toque vistos de lado: chega, amortece e solta");
}

// Bonequinho de lado. `estendido`: na ponta dos pés, braços esticados.
function boneco(x, estendido) {
  const L = (a, b, w = 7, cor = COR.linha) => `<line x1="${a[0] + x}" y1="${a[1]}" x2="${b[0] + x}" y2="${b[1]}" stroke="${cor}" stroke-width="${w}" stroke-linecap="round"/>`;
  if (!estendido) {
    const quadril = [60, 178], ombro = [66, 118], cabeca = [72, 96];
    return `
      ${L([46, 262], [74, 222])}${L([74, 222], quadril)}${L([62, 262], [84, 226])}${L([84, 226], quadril)}
      ${L(quadril, ombro, 9)}
      <circle cx="${cabeca[0] + x}" cy="${cabeca[1]}" r="15" fill="${COR.pele}" stroke="${COR.linha}" stroke-width="3"/>
      ${L(ombro, [88, 104])}${L([88, 104], [88, 72], 6, COR.linha)}
      <circle cx="${88 + x}" cy="72" r="5" fill="${COR.principal}" stroke="${COR.linha}" stroke-width="2"/>`;
  }
  const quadril = [62, 168], ombro = [64, 104], cabeca = [70, 82];
  return `
    ${L([58, 258], [66, 218])}${L([66, 218], quadril)}${L([72, 256], [74, 214])}${L([74, 214], quadril)}
    ${L(quadril, ombro, 9)}
    <circle cx="${cabeca[0] + x}" cy="${cabeca[1]}" r="15" fill="${COR.pele}" stroke="${COR.linha}" stroke-width="3"/>
    ${L(ombro, [82, 72])}${L([82, 72], [104, 40], 6, COR.linha)}
    <circle cx="${104 + x}" cy="40" r="5" fill="${COR.principal}" stroke="${COR.linha}" stroke-width="2"/>`;
}

// Painel 3 — a força vem das pernas; a direção, do corpo.
function painelCorpo() {
  const corpo = `
    ${texto(16, 24, "Força das pernas, direção do corpo", { tam: 13, peso: 700 })}
    <line x1="10" y1="264" x2="430" y2="264" stroke="#cbd5e1" stroke-width="2"/>
    ${boneco(10, false)}
    ${bola("b-corpo-1", 100, 50, 20)}
    <line x1="104" y1="72" x2="118" y2="72" stroke="${COR.movimento}" stroke-width="1" stroke-dasharray="3 3"/>
    ${texto(122, 70, "um palmo", { tam: 11, cor: COR.movimento })}
    ${texto(122, 87, "acima da", { tam: 11, cor: COR.movimento })}
    ${texto(122, 104, "testa", { tam: 11, cor: COR.movimento })}
    <path d="M40,${250} L40,${196}" stroke="${COR.movimento}" stroke-width="3" marker-end="url(#seta-azul)"/>
    ${texto(12, 284, "joelho dobrado", { tam: 10, cor: COR.textoFraco })}
    <line x1="150" y1="170" x2="222" y2="170" stroke="${COR.textoFraco}" stroke-width="2" marker-end="url(#seta-cinza)"/>
    ${boneco(236, true)}
    ${bola("b-corpo-2", 364, 20, 16)}
    <line x1="${340 + 14}" y1="${60}" x2="${340 + 38}" y2="${28}" stroke="${COR.movimento}" stroke-width="3" marker-end="url(#seta-azul)"/>
    <path d="M${236 + 40},${250} L${236 + 40},${190}" stroke="${COR.movimento}" stroke-width="3" marker-end="url(#seta-azul)"/>
    ${texto(236 + 84, 150, "pernas", { tam: 11, cor: COR.movimento })}
    ${texto(236 + 84, 167, "empurram,", { tam: 11, cor: COR.movimento })}
    ${texto(236 + 84, 184, "mãos", { tam: 11, cor: COR.movimento })}
    ${texto(236 + 84, 201, "terminam", { tam: 11, cor: COR.movimento })}
    ${texto(236 + 84, 218, "no alvo", { tam: 11, cor: COR.movimento })}
    ${texto(236, 284, "quadril virado pro alvo", { tam: 10, cor: COR.textoFraco })}`;
  return envelope(440, 296, corpo, "Levantador de lado antes e depois do toque, com as pernas empurrando");
}

// Mãos vistas de frente, empurrando a bola pra cima (setas = força).
function maosDeFrente(cx, cy, forcaEsq, forcaDir, { girando = false, id }) {
  const mao = (lado, forca) => {
    const x = cx + lado * 30;
    const cor = forca > 1 ? COR.errado : COR.principal;
    return `
      <rect x="${x - 13}" y="${cy + 18}" width="26" height="34" rx="10" fill="${COR.pele}" stroke="${COR.linha}" stroke-width="2"/>
      <path d="M${x - 11},${cy + 22} L${x - 16},${cy + 6} M${x - 4},${cy + 19} L${x - 5},${cy + 1} M${x + 4},${cy + 19} L${x + 5},${cy + 1} M${x + 11},${cy + 22} L${x + 16},${cy + 6}" stroke="${COR.linha}" stroke-width="7" stroke-linecap="round"/>
      <path d="M${x - 11},${cy + 22} L${x - 16},${cy + 6} M${x - 4},${cy + 19} L${x - 5},${cy + 1} M${x + 4},${cy + 19} L${x + 5},${cy + 1} M${x + 11},${cy + 22} L${x + 16},${cy + 6}" stroke="${COR.principal}" stroke-width="4.5" stroke-linecap="round"/>
      <line x1="${x}" y1="${cy + 70}" x2="${x}" y2="${cy + 70 - 18 * forca}" stroke="${cor}" stroke-width="${forca > 1 ? 5 : 3}" marker-end="url(#seta-${forca > 1 ? "vermelha" : "azul"})"/>`;
  };
  const giro = girando
    ? `<path d="M${cx + 38},${cy - 52} A40,40 0 1 0 ${cx + 44},${cy - 20}" stroke="${COR.errado}" stroke-width="3" fill="none" marker-end="url(#seta-vermelha)"/>`
    : "";
  return `${bola(id, cx, cy - 22, 30, { fita: true, fitaGirando: girando })}${giro}${mao(-1, forcaEsq)}${mao(1, forcaDir)}`;
}

// Painel 4 — por que a bola gira (e como a fita mostra).
function painelGiro() {
  const corpo = `
    ${texto(16, 24, "Por que a bola gira", { tam: 13, peso: 700 })}
    <rect x="10" y="34" width="204" height="234" rx="10" fill="#fff" stroke="${COR.principal}" stroke-width="2"/>
    <rect x="226" y="34" width="204" height="234" rx="10" fill="#fff" stroke="${COR.errado}" stroke-width="2"/>
    ${texto(112, 60, "✓ Certo", { tam: 13, peso: 700, cor: COR.principalEscuro, ancora: "middle" })}
    ${texto(328, 60, "✗ Errado", { tam: 13, peso: 700, cor: COR.errado, ancora: "middle" })}
    ${maosDeFrente(112, 142, 1, 1, { id: "b-giro-1" })}
    ${maosDeFrente(328, 142, 1, 1.9, { girando: true, id: "b-giro-2" })}
    ${texto(112, 236, "mãos juntas, mesma", { tam: 11, ancora: "middle" })}
    ${texto(112, 253, "força: fita parada", { tam: 11, ancora: "middle" })}
    ${texto(328, 236, "uma mão empurra mais", { tam: 11, ancora: "middle" })}
    ${texto(328, 253, "ou solta depois: gira", { tam: 11, ancora: "middle" })}`;
  return envelope(440, 278, corpo, "Comparação entre toque sem giro e toque com giro, com a fita na bola");
}

// Painel 5 — quadra x praia.
function painelPraia() {
  const q = maoDeBaixo(110, 124, 44, 1), qe = maoDeBaixo(110, 124, 44, -1);
  const p = maoDeBaixo(330, 124, 44, 1, { praia: true }), pe = maoDeBaixo(330, 124, 44, -1, { praia: true });
  const corpo = `
    ${texto(16, 24, "Quadra × praia", { tam: 13, peso: 700 })}
    ${texto(110, 52, "Quadra", { tam: 13, peso: 700, ancora: "middle" })}
    ${texto(330, 52, "Praia", { tam: 13, peso: 700, ancora: "middle" })}
    ${bola("b-praia-1", 110, 124, 44)}${qe.svg}${q.svg}
    ${bola("b-praia-2", 330, 124, 44)}${pe.svg}${p.svg}
    <line x1="220" y1="40" x2="220" y2="206" stroke="#e5e7eb" stroke-width="2"/>
    ${texto(110, 226, "só a ponta encosta", { tam: 11, ancora: "middle" })}
    ${texto(330, 226, "bola mais funda:", { tam: 11, ancora: "middle" })}
    ${texto(330, 243, "mais dedo encosta", { tam: 11, ancora: "middle" })}
    ${texto(330, 260, "(palma fora)", { tam: 11, ancora: "middle", cor: COR.errado })}`;
  return envelope(440, 274, corpo, "Comparação do contato na quadra e na praia");
}

export const GUIA_TOQUE_VOLEI = [
  {
    titulo: "1. Os dedos",
    svg: painelDedos(),
    pontos: [
      "Use os 10 dedos, mas quem trabalha são polegar, indicador e médio (verde). Anelar e mínimo (amarelo) só seguram dos lados.",
      "Encoste só da ponta até a 2ª dobra dos dedos (faixa escura). A palma nunca toca.",
      "Mãos em forma de bola, um palmo acima da testa, cotovelos abertos.",
    ],
  },
  {
    titulo: "2. O punho",
    svg: painelPunho(),
    pontos: [
      "Dedos firmes, não duros: o punho cede pra trás quando a bola chega e devolve na hora, num movimento só.",
      "Dedo duro = bola sai batida. Mão mole demais = bola fica parada na mão (condução).",
      "A força não vem dos dedos — eles guiam e dão o acabamento.",
    ],
  },
  {
    titulo: "3. O corpo",
    svg: painelCorpo(),
    pontos: [
      "Contato um palmo acima da testa, um pouco à frente. Umbigo e quadril virados pro alvo.",
      "Chegue embaixo da bola antes dela e pare. Levantar andando muda a direção.",
      "Empurre com as pernas e estique os braços; termine congelado apontando pro alvo.",
    ],
  },
  {
    titulo: "4. Sem girar",
    svg: painelGiro(),
    pontos: [
      "Bola girando = uma mão soltou antes ou com mais força, ou o punho deu um tapa no fim.",
      "Solte com as duas mãos ao mesmo tempo e termine com elas juntas, apontando pro alvo.",
      "Treino: uma volta de fita isolante na bola e toques pra cima olhando a fita. Meta: 30 seguidos com ela parada.",
    ],
  },
  {
    titulo: "5. Na praia",
    svg: painelPraia(),
    pontos: [
      "Na areia o juiz é mais rígido: bola girando conta como dois toques.",
      "Deixe a bola entrar mais funda: mãos mais abertas, mais dedo encostando — sem palma.",
      "Contato um pouco mais longo, mas numa ação só e com as duas mãos juntas.",
      "Chegue antes da bola, pare e fique de frente pro parceiro. Com vento, levante mais baixo.",
      "Dia em que o toque não está confiável: levantar de manchete é legítimo na praia.",
    ],
  },
];
