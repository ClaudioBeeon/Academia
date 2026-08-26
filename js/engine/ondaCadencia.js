// js/engine/ondaCadencia.js
//
// Matemática pura do guia visual de cadência: a forma da onda (uma senoide
// — não conta tempo) e o percurso (quão rápido a bolinha anda em cada ponto
// da onda — é aqui que o tempo real da cadência entra). Compartilhado entre
// a versão compacta (js/screens/guiaCadencia.js) e a tela cheia
// (js/screens/telaSerieCheia.js), que só diferem em tamanho/layout.
import { fasesDaCadencia, totalDaRepeticao } from "./cadencia.js";

// Senoide pura: 0 no vale, 1 na crista, sem nenhuma quina — a forma não
// muda com o tempo prescrito, só a velocidade com que se percorre ela.
export function formaOnda(s) {
  return (1 - Math.cos(2 * Math.PI * s)) / 2;
}

// Perfil de velocidade em torno de uma gaussiana invertida: desacelera
// perto da crista (e da base, se a cadência tiver pausa embaixo) sem nunca
// chegar a zero — o freio é sempre < 1. Cada metade da onda é reescalada
// pra durar exatamente os segundos que a cadência prescreve.
export function construirPercursoOnda(cadencia) {
  const fases = fasesDaCadencia(cadencia);
  const total = totalDaRepeticao(cadencia);
  const segundosSubida = fases
    .filter((f) => f.chave === "concentrica" || f.chave === "pausaTopo")
    .reduce((soma, f) => soma + f.segundos, 0);
  const fracaoSubida = total > 0 ? segundosSubida / total : 0.25;

  const temPausaTopo = fases.some((f) => f.chave === "pausaTopo");
  const temPausaBase = fases.some((f) => f.chave === "pausaBase");
  const freioTopo = temPausaTopo ? 0.72 : 0.55;
  const freioBase = temPausaBase ? 0.6 : 0;

  const velocidade = (s) => {
    const perto = (centro) => Math.exp(-Math.pow((s - centro) / 0.16, 2));
    const freio = freioTopo * perto(0.5) + freioBase * (perto(0) + perto(1));
    return Math.max(0.08, 1 - freio);
  };

  const AMOSTRAS = 4000;
  const passo = 1 / AMOSTRAS;
  const bruto = [0];
  let somaSubida = 0;
  let somaDescida = 0;
  for (let i = 1; i <= AMOSTRAS; i++) {
    const s = (i - 0.5) * passo;
    const dt = passo / velocidade(s);
    if (s < 0.5) somaSubida += dt;
    else somaDescida += dt;
    bruto.push(somaSubida + somaDescida);
  }

  const tempos = bruto.map((valor, i) => {
    const s = i * passo;
    if (s <= 0.5) return (valor / somaSubida) * fracaoSubida;
    return fracaoSubida + ((valor - somaSubida) / somaDescida) * (1 - fracaoSubida);
  });

  return function posicaoEm(t) {
    let baixo = 0;
    let alto = AMOSTRAS;
    while (baixo < alto) {
      const meio = (baixo + alto) >> 1;
      if (tempos[meio] < t) baixo = meio + 1;
      else alto = meio;
    }
    const i = Math.max(1, baixo);
    const anterior = tempos[i - 1];
    const atual = tempos[i];
    const fracao = atual > anterior ? (t - anterior) / (atual - anterior) : 0;
    return Math.min(1, (i - 1 + fracao) * passo);
  };
}
