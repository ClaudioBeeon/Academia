// js/screens/guiaCadencia.js
//
// Guia visual de cadência: uma senoide cinza rolando e uma bolinha lima que
// a percorre no ritmo prescrito pelo exercício.
//
// Duas decisões que sustentam o desenho:
//
// 1. A FORMA não conta o tempo. Desenhar a subida estreita (porque dura
//    menos) criava uma rampa quase vertical — a "ponta" que estragava a
//    curva. Aqui a onda é uma senoide pura e simétrica, e o ritmo vive na
//    VELOCIDADE com que a bolinha anda sobre ela.
//
// 2. A bolinha desacelera no topo mas NUNCA para. Em vez de congelar a
//    posição durante a pausa (o que lia como travamento), existe um perfil
//    de velocidade — uma gaussiana invertida centrada na crista. Como o
//    fator de freio é sempre menor que 1, a velocidade não chega a zero em
//    nenhum instante do ciclo.
import { fasesDaCadencia, totalDaRepeticao } from "../engine/cadencia.js";

const CINZA = "#303030";
const LIMA = "#C9F241";
const LARGURA_ONDA = 230;
const AMPLITUDE = 115;
const CENTRO_Y = 150 + AMPLITUDE / 2;
const ESPESSURA = 26;
const ONDAS_DESENHADAS = 6;
const AMOSTRAS_PERCURSO = 4000;

// Senoide pura: 0 no vale, 1 na crista, sem nenhuma quina.
function forma(s) {
  return (1 - Math.cos(2 * Math.PI * s)) / 2;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const chave in attrs) el.setAttribute(chave, attrs[chave]);
  return el;
}

// Constrói a tabela tempo → posição. A velocidade cai perto da crista (e do
// vale, quando o exercício tem pausa embaixo) sem nunca zerar; depois cada
// metade é reescalada pra durar exatamente os segundos que a ficha manda.
function construirPercurso(cadencia) {
  const fases = fasesDaCadencia(cadencia);
  const total = totalDaRepeticao(cadencia);
  const segundosSubida = fases
    .filter((f) => f.chave === "concentrica" || f.chave === "pausaTopo")
    .reduce((soma, f) => soma + f.segundos, 0);
  const fracaoSubida = total > 0 ? segundosSubida / total : 0.25;

  const temPausaTopo = fases.some((f) => f.chave === "pausaTopo");
  const temPausaBase = fases.some((f) => f.chave === "pausaBase");
  // Quanto maior a pausa prescrita, mais forte o freio naquela ponta.
  const freioTopo = temPausaTopo ? 0.72 : 0.55;
  const freioBase = temPausaBase ? 0.6 : 0;

  const velocidade = (s) => {
    const perto = (centro) => Math.exp(-Math.pow((s - centro) / 0.16, 2));
    const freio = freioTopo * perto(0.5) + freioBase * (perto(0) + perto(1));
    return Math.max(0.08, 1 - freio);
  };

  const passo = 1 / AMOSTRAS_PERCURSO;
  const bruto = [0];
  let somaSubida = 0;
  let somaDescida = 0;
  for (let i = 1; i <= AMOSTRAS_PERCURSO; i++) {
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
    let alto = AMOSTRAS_PERCURSO;
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

function caminhoDaOnda() {
  const PASSOS = 80;
  let d = "";
  for (let i = 0; i <= ONDAS_DESENHADAS * PASSOS; i++) {
    const x = (i / PASSOS) * LARGURA_ONDA;
    const y = CENTRO_Y - forma((i % PASSOS) / PASSOS) * AMPLITUDE;
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
  }
  return d;
}

/**
 * Monta o guia. Devolve { elemento, iniciar, parar, definirCadencia } — quem
 * chama controla quando ele roda, porque a animação só faz sentido com uma
 * série em andamento.
 */
export function montarGuiaCadencia(cadenciaInicial) {
  const elemento = document.createElement("div");
  elemento.className = "guia-cadencia";
  elemento.innerHTML = `
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g class="onda"><path fill="none" stroke="${CINZA}" stroke-width="${ESPESSURA}"
        stroke-linecap="round" stroke-linejoin="round" /></g>
      <circle class="bolinha" r="11" fill="${LIMA}" cx="200" cy="${CENTRO_Y}" />
    </svg>
    <div class="guia-fase" role="status" aria-live="polite"></div>
  `;
  elemento.querySelector("path").setAttribute("d", caminhoDaOnda());

  const grupoOnda = elemento.querySelector(".onda");
  const bolinha = elemento.querySelector(".bolinha");
  const faseEl = elemento.querySelector(".guia-fase");

  let cadencia = cadenciaInicial;
  let percurso = construirPercurso(cadencia);
  let cicloMs = totalDaRepeticao(cadencia) * 1000;
  let fases = fasesDaCadencia(cadencia);
  let quadroId = null;
  let inicioTs = null;
  let rotuloAtual = null;

  function rotuloNoInstante(msNoCiclo) {
    let acumulado = 0;
    for (const fase of fases) {
      acumulado += fase.segundos * 1000;
      if (msNoCiclo < acumulado) return fase.rotulo;
    }
    return fases[fases.length - 1]?.rotulo ?? "";
  }

  function quadro(ts) {
    if (inicioTs == null) inicioTs = ts;
    const msNoCiclo = (ts - inicioTs) % cicloMs;
    const s = percurso(msNoCiclo / cicloMs);

    grupoOnda.setAttribute("transform", `translate(${(200 - (2 + s) * LARGURA_ONDA).toFixed(2)},0)`);
    bolinha.setAttribute("cy", (CENTRO_Y - forma(s) * AMPLITUDE).toFixed(2));

    const rotulo = rotuloNoInstante(msNoCiclo);
    if (rotulo !== rotuloAtual) {
      rotuloAtual = rotulo;
      faseEl.textContent = rotulo;
    }

    quadroId = requestAnimationFrame(quadro);
  }

  function iniciar() {
    if (quadroId != null) return;
    inicioTs = null;
    rotuloAtual = null;
    quadroId = requestAnimationFrame(quadro);
  }

  function parar() {
    if (quadroId != null) cancelAnimationFrame(quadroId);
    quadroId = null;
  }

  // Trocar a cadência com o guia rodando reinicia o ciclo — é o que faz a
  // bolinha "entender" o novo tempo assim que a pessoa salva o ajuste.
  function definirCadencia(nova) {
    cadencia = nova;
    percurso = construirPercurso(cadencia);
    cicloMs = totalDaRepeticao(cadencia) * 1000;
    fases = fasesDaCadencia(cadencia);
    inicioTs = null;
    rotuloAtual = null;
  }

  return { elemento, iniciar, parar, definirCadencia };
}
