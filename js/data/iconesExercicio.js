// js/data/iconesExercicio.js
// Pictogramas SVG (boneco articulado) para cada exercício do catálogo.
// Convenção visual: corpo/tronco/pernas em preto (CORPO), braços e
// equipamento (peso, cabo, barra) em verde-lima (var(--accent)) — os
// "detalhes verdes" pedidos, destacando a parte que trabalha o músculo.
//
// As duas cores saem por variável (--fig e --eq) pra que cada tela escolha
// o fundo do azulejo e ajuste o boneco a ele. O corpo quase preto some num
// azulejo escuro — em fundo claro ele fica em preto, em fundo escuro é
// invertido pra claro. Os defaults abaixo reproduzem o visual original, e
// css/styles.css os declara em .icone-exercicio.
const CORPO = "var(--fig, #0d0f0d)";
const DETALHE = "var(--eq, var(--accent))";
const SW = 8;
const SA = 7;

function linha(x1, y1, x2, y2, cor = CORPO, largura = SW) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round"/>`;
}

function circulo(cx, cy, r, cor = CORPO) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cor}"/>`;
}

function retangulo(x, y, w, h, rx, cor = CORPO) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${cor}"/>`;
}

function cabeca(cx, cy, r = 8) {
  return circulo(cx, cy, r, CORPO);
}

export const ICONES_EXERCICIO = {
  // Peito — supino inclinado com halteres: deitado num banco inclinado,
  // braços verdes estendidos pra cima segurando halteres.
  supino_inclinado_halteres:
    retangulo(16, 76, 24, 7, 3) +
    linha(28, 76, 46, 50, CORPO, 11) +
    cabeca(50, 44) +
    linha(44, 50, 32, 74, CORPO, SW) +
    linha(32, 74, 20, 88, CORPO, SW) +
    linha(44, 48, 60, 24, DETALHE, SA) +
    linha(40, 52, 54, 30, DETALHE, SA) +
    circulo(63, 18, 5, DETALHE) +
    circulo(63, 30, 5, DETALHE) +
    linha(63, 18, 63, 30, DETALHE, 4),

  // Peito — supino reto na máquina: sentado, empurrando pra frente.
  supino_reto_maquina:
    retangulo(14, 40, 8, 44, 3) +
    retangulo(14, 78, 20, 7, 3) +
    cabeca(30, 38) +
    linha(30, 46, 30, 74, CORPO, SW) +
    linha(30, 74, 20, 90, CORPO, SW) +
    linha(30, 74, 40, 90, CORPO, SW) +
    linha(28, 52, 54, 46, DETALHE, SA) +
    linha(32, 58, 54, 58, DETALHE, SA) +
    retangulo(54, 40, 8, 24, 3, DETALHE),

  // Peito — crucifixo no cabo (cross-over): em pé, braços abertos
  // puxando dois cabos até se encontrarem na frente do peito.
  crucifixo_cabo_cross:
    circulo(14, 16, 4, CORPO) +
    circulo(86, 16, 4, CORPO) +
    linha(14, 16, 34, 46, DETALHE, 3) +
    linha(86, 16, 66, 46, DETALHE, 3) +
    cabeca(50, 38) +
    linha(50, 46, 50, 70, CORPO, SW) +
    linha(50, 70, 40, 90, CORPO, SW) +
    linha(50, 70, 60, 90, CORPO, SW) +
    linha(50, 52, 34, 46, DETALHE, SA) +
    linha(50, 52, 66, 46, DETALHE, SA),

  // Costas — puxada frente (pegada aberta): sentado, puxando uma barra
  // larga de cima até a altura do peito.
  puxada_frente_pegada_aberta:
    linha(50, 8, 50, 20, CORPO, 4) +
    linha(24, 20, 76, 20, DETALHE, SA) +
    cabeca(50, 38) +
    linha(50, 46, 50, 72, CORPO, SW) +
    linha(50, 72, 40, 90, CORPO, SW) +
    linha(50, 72, 60, 90, CORPO, SW) +
    retangulo(38, 78, 24, 7, 3) +
    linha(50, 50, 30, 28, DETALHE, SA) +
    linha(50, 50, 70, 28, DETALHE, SA),

  // Costas — remada baixa na máquina/cabo: sentado, puxando o cabo
  // até o tronco com cotovelos pra trás.
  remada_baixa_maquina:
    circulo(78, 46, 4, CORPO) +
    linha(78, 46, 54, 50, DETALHE, 3) +
    retangulo(20, 78, 22, 7, 3) +
    cabeca(46, 36) +
    linha(46, 44, 42, 68, CORPO, SW) +
    linha(42, 68, 30, 88, CORPO, SW) +
    linha(42, 68, 54, 86, CORPO, SW) +
    linha(44, 52, 54, 50, DETALHE, SA),

  // Costas — remada curvada com barra: em pé, tronco inclinado,
  // puxando a barra até a altura do abdômen.
  remada_curvada_barra:
    cabeca(30, 30) +
    linha(30, 38, 58, 62, CORPO, SW) +
    linha(58, 62, 66, 88, CORPO, SW) +
    linha(58, 62, 50, 88, CORPO, SW) +
    linha(34, 46, 46, 66, DETALHE, SA) +
    circulo(44, 70, 6, DETALHE) +
    linha(38, 70, 50, 70, DETALHE, 5),

  // Ombro — desenvolvimento na máquina: sentado, empurrando as
  // alças pra cima até estender os braços sobre a cabeça.
  desenvolvimento_maquina:
    retangulo(14, 44, 8, 40, 3) +
    retangulo(14, 78, 20, 7, 3) +
    cabeca(30, 46) +
    linha(30, 54, 30, 74, CORPO, SW) +
    linha(30, 74, 20, 90, CORPO, SW) +
    linha(30, 74, 40, 90, CORPO, SW) +
    linha(28, 44, 20, 18, DETALHE, SA) +
    linha(32, 44, 44, 18, DETALHE, SA) +
    circulo(18, 14, 5, DETALHE) +
    circulo(46, 14, 5, DETALHE),

  // Ombro — elevação lateral no cabo: em pé, um braço se elevando
  // até a altura do ombro puxando o cabo de baixo.
  elevacao_lateral_cabo:
    circulo(20, 84, 4, CORPO) +
    linha(20, 84, 40, 50, DETALHE, 3) +
    cabeca(48, 30) +
    linha(48, 38, 46, 66, CORPO, SW) +
    linha(46, 66, 38, 90, CORPO, SW) +
    linha(46, 66, 54, 90, CORPO, SW) +
    linha(50, 44, 40, 50, DETALHE, SA) +
    linha(50, 44, 66, 44, DETALHE, SA),

  // Bíceps — rosca direta com barra W: em pé, cotovelos fixos,
  // flexionando os braços com a barra até o peito.
  rosca_direta_barra_w:
    cabeca(50, 24) +
    linha(50, 32, 50, 64, CORPO, SW) +
    linha(50, 64, 40, 90, CORPO, SW) +
    linha(50, 64, 60, 90, CORPO, SW) +
    linha(46, 40, 40, 58, DETALHE, SA) +
    linha(54, 40, 60, 58, DETALHE, SA) +
    retangulo(35, 56, 30, 7, 3, DETALHE),

  // Bíceps — rosca Scott na máquina: sentado, braço apoiado na
  // almofada inclinada, flexionando pra cima.
  rosca_scott_maquina:
    retangulo(20, 78, 18, 7, 3) +
    retangulo(38, 50, 24, 12, 4) +
    cabeca(30, 34) +
    linha(30, 42, 28, 74, CORPO, SW) +
    linha(28, 74, 20, 88, CORPO, SW) +
    linha(40, 56, 58, 36, DETALHE, SA) +
    circulo(60, 32, 5, DETALHE),

  // Tríceps — pulley com corda: em pé de frente pro cabo alto,
  // cotovelos fixos, empurrando a corda pra baixo.
  triceps_pulley_corda:
    circulo(50, 10, 4, CORPO) +
    linha(50, 10, 50, 40, DETALHE, 3) +
    cabeca(50, 32) +
    linha(50, 40, 48, 68, CORPO, SW) +
    linha(48, 68, 38, 90, CORPO, SW) +
    linha(48, 68, 58, 90, CORPO, SW) +
    linha(46, 46, 44, 62, DETALHE, SA) +
    linha(54, 46, 56, 62, DETALHE, SA),

  // Tríceps — tríceps testa com barra W: deitado, segurando a barra
  // sobre a testa, flexionando só o cotovelo.
  triceps_testa_barra_w:
    retangulo(14, 70, 66, 8, 4) +
    cabeca(66, 60) +
    linha(60, 62, 26, 68, CORPO, SW) +
    linha(26, 68, 14, 84, CORPO, SW) +
    linha(14, 84, 30, 88, CORPO, SW) +
    linha(60, 54, 58, 32, DETALHE, SA) +
    retangulo(44, 26, 24, 6, 3, DETALHE),

  // Quadríceps — leg press 45°: reclinado, pernas dobradas
  // empurrando a plataforma pra cima.
  leg_press_45:
    retangulo(12, 30, 26, 8, 3) +
    linha(24, 34, 54, 60, CORPO, 11) +
    cabeca(58, 66) +
    linha(52, 58, 40, 44, CORPO, SW) +
    linha(40, 44, 28, 52, DETALHE, SA) +
    retangulo(14, 44, 8, 20, 3, DETALHE),

  // Quadríceps — cadeira extensora: sentado, canela apoiada na
  // alavanca, estendendo a perna pra frente.
  cadeira_extensora:
    retangulo(20, 36, 8, 42, 3) +
    retangulo(20, 76, 22, 7, 3) +
    cabeca(38, 40) +
    linha(36, 48, 32, 74, CORPO, SW) +
    linha(32, 74, 52, 74, CORPO, SW) +
    linha(52, 74, 70, 50, DETALHE, SA) +
    circulo(72, 46, 5, DETALHE),

  // Posterior de coxa — mesa flexora: deitado de bruços, tornozelo
  // preso na alavanca, flexionando o joelho pra cima.
  mesa_flexora:
    retangulo(12, 68, 60, 8, 4) +
    cabeca(20, 60) +
    linha(26, 64, 56, 72, CORPO, SW) +
    linha(56, 72, 72, 50, DETALHE, SA) +
    circulo(74, 46, 5, DETALHE),

  // Glúteo — cadeira abdutora: sentado, joelhos contra as almofadas,
  // pernas se abrindo contra a resistência.
  cadeira_abdutora:
    retangulo(38, 78, 24, 7, 3) +
    cabeca(50, 34) +
    linha(50, 42, 50, 74, CORPO, SW) +
    linha(50, 74, 30, 84, DETALHE, SA) +
    linha(50, 74, 70, 84, DETALHE, SA) +
    circulo(28, 86, 5, DETALHE) +
    circulo(72, 86, 5, DETALHE),

  // Panturrilha — panturrilha em pé na máquina: em pé, ombros sob os
  // apoios, subindo na ponta dos pés.
  panturrilha_em_pe_maquina:
    retangulo(30, 6, 40, 8, 3) +
    linha(38, 14, 38, 26, CORPO, 6) +
    linha(62, 14, 62, 26, CORPO, 6) +
    cabeca(50, 34) +
    linha(50, 42, 50, 68, CORPO, SW) +
    linha(50, 68, 44, 84, CORPO, SW) +
    linha(50, 68, 56, 84, CORPO, SW) +
    linha(44, 84, 44, 90, DETALHE, 6) +
    linha(56, 84, 56, 90, DETALHE, 6),

  // Abdômen — abdominal na máquina: sentado, segurando as alças
  // acima dos ombros, tronco flexionando pra frente.
  abdominal_maquina:
    retangulo(64, 30, 8, 36, 3) +
    retangulo(40, 78, 22, 7, 3) +
    cabeca(48, 40) +
    linha(52, 46, 42, 66, CORPO, SW) +
    linha(42, 66, 32, 86, CORPO, SW) +
    linha(42, 66, 54, 86, CORPO, SW) +
    linha(48, 40, 60, 30, DETALHE, SA) +
    circulo(62, 26, 5, DETALHE),

  // Abdômen — prancha isométrica: apoiado nos antebraços e nas
  // pontas dos pés, corpo reto na horizontal.
  prancha_isometrica:
    cabeca(24, 46) +
    linha(28, 50, 74, 62, CORPO, SW) +
    linha(74, 62, 86, 76, CORPO, SW) +
    linha(24, 54, 18, 74, DETALHE, SA) +
    linha(18, 74, 30, 78, DETALHE, SA),
};

export const ICONE_PADRAO =
  cabeca(50, 30) + linha(50, 38, 50, 66, CORPO, SW) + linha(50, 66, 38, 88, CORPO, SW) + linha(50, 66, 62, 88, CORPO, SW);
