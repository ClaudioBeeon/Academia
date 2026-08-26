// js/screens/telaSerieCheia.js
//
// Telão da série: cobre a tela inteira enquanto a repetição está
// acontecendo — nome do exercício, carga/reps/ciclo, a trilha de séries da
// sessão, e a onda com a bolinha (guia de cadência) em destaque, cronômetro
// grande logo abaixo. Reaproveita a mesma matemática do guia compacto
// (js/engine/ondaCadencia.js) — só o tamanho e o layout mudam.
import { fasesDaCadencia, totalDaRepeticao } from "../engine/cadencia.js";
import { formaOnda as forma, construirPercursoOnda as construirPercurso } from "../engine/ondaCadencia.js";

const CINZA = "#303030";
const LIMA = "#C9F241";
const ONDAS_DESENHADAS = 6;

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const chave in attrs) el.setAttribute(chave, attrs[chave]);
  return el;
}

function formatarNumero(valor) {
  if (valor == null) return "—";
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(/\.0$/, "");
}

function formatarRelogio(segundos) {
  const min = String(Math.floor(segundos / 60)).padStart(2, "0");
  const seg = String(segundos % 60).padStart(2, "0");
  return `${min}:${seg}`;
}

/**
 * Monta o telão. Devolve { elemento, iniciar, parar } — quem chama controla
 * o ciclo de vida (a animação e o cronômetro só correm com a série em
 * andamento) e decide quando anexar/remover `elemento` do DOM.
 *
 * `aoFechar` é a seta de voltar no cabeçalho (só esconde o telão, não
 * cancela a série). `aoTerminar` é o botão "Terminei — registrar", que
 * decide o que fazer com a série em andamento — o telão não sabe registrar
 * nada sozinho.
 */
export function montarTelaSerieCheia({
  exercicio,
  cadencia,
  cargaSelecionada,
  repsMin,
  repsMax,
  rirAlvo,
  totalSeriesAlvo,
  numeroAtual,
  aoFechar,
  aoTerminar,
}) {
  const elemento = document.createElement("div");
  elemento.className = "serie-cheia";

  let tracos = "";
  for (let n = 1; n <= totalSeriesAlvo; n++) {
    tracos += `<i class="${n <= numeroAtual ? "on" : ""}"></i>`;
  }

  elemento.innerHTML = `
    <div class="sc-topo">
      <button type="button" class="sc-voltar" aria-label="Fechar">←</button>
      <div class="sc-trilho">
        <div class="sc-trilho-tracos">${tracos}</div>
        <span class="sc-trilho-n">${numeroAtual}/${totalSeriesAlvo}</span>
      </div>
    </div>
    <div class="sc-info">
      <div class="sc-nome"></div>
      <div class="sc-sub"></div>
      <div class="sc-tiles">
        <div class="sc-tile"><b></b><span>kg</span></div>
        <div class="sc-tile"><b></b><span>reps</span></div>
        <div class="sc-tile"><b></b><span>ciclo</span></div>
      </div>
    </div>
    <div class="sc-corpo">
      <div class="sc-onda-box">
        <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g class="onda"><path fill="none" stroke="${CINZA}" stroke-width="24"
            stroke-linecap="round" stroke-linejoin="round" /></g>
          <circle class="bolinha" r="10" fill="${LIMA}" cx="200" cy="130" />
        </svg>
        <div class="sc-fase" role="status" aria-live="polite"></div>
      </div>
      <div class="sc-crono-bloco">
        <b class="sc-crono">00:00</b>
        <span>tempo do exercício</span>
      </div>
    </div>
    <div class="sc-foot"><button type="button" class="sc-terminar">Terminei — registrar</button></div>
  `;

  elemento.querySelector(".sc-nome").textContent = exercicio.nome;
  const musculo = exercicio.musculoPrimario ? exercicio.musculoPrimario : "";
  elemento.querySelector(".sc-sub").textContent = [musculo, `RIR ${formatarNumero(rirAlvo)}`].filter(Boolean).join(" · ");

  const tiles = elemento.querySelectorAll(".sc-tile b");
  tiles[0].textContent = `${formatarNumero(cargaSelecionada)}`;
  tiles[1].textContent = repsMin === repsMax ? formatarNumero(repsMax) : `${formatarNumero(repsMin)}–${formatarNumero(repsMax)}`;
  tiles[2].textContent = `${formatarNumero(totalDaRepeticao(cadencia))}s`;

  elemento.querySelector(".sc-voltar").addEventListener("click", () => { if (aoFechar) aoFechar(); });
  elemento.querySelector(".sc-terminar").addEventListener("click", () => { if (aoTerminar) aoTerminar(); });

  const AMP = 78;
  const CY = 130;
  const LARGURA_ONDA = 400 / 1.8;

  const grupoOnda = elemento.querySelector(".onda");
  const bolinha = elemento.querySelector(".bolinha");
  const faseEl = elemento.querySelector(".sc-fase");
  const cronoEl = elemento.querySelector(".sc-crono");

  let d = "";
  const PASSOS = 80;
  for (let i = 0; i <= ONDAS_DESENHADAS * PASSOS; i++) {
    const x = (i / PASSOS) * LARGURA_ONDA;
    const y = CY - forma((i % PASSOS) / PASSOS) * AMP;
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2);
  }
  elemento.querySelector(".onda path").setAttribute("d", d);

  const percurso = construirPercurso(cadencia);
  const cicloMs = totalDaRepeticao(cadencia) * 1000;
  const fases = fasesDaCadencia(cadencia);

  function rotuloNoInstante(msNoCiclo) {
    let acumulado = 0;
    for (const fase of fases) {
      acumulado += fase.segundos * 1000;
      if (msNoCiclo < acumulado) return fase.rotulo;
    }
    return fases[fases.length - 1]?.rotulo ?? "";
  }

  let quadroId = null;
  let inicioOndaTs = null;
  let rotuloAtual = null;
  let inicioTrabalhoTs = Date.now();
  let intervaloCrono = null;

  function quadro(ts) {
    if (inicioOndaTs == null) inicioOndaTs = ts;
    const msNoCiclo = (ts - inicioOndaTs) % cicloMs;
    const s = percurso(msNoCiclo / cicloMs);

    grupoOnda.setAttribute("transform", `translate(${(200 - (2 + s) * LARGURA_ONDA).toFixed(2)},0)`);
    bolinha.setAttribute("cy", (CY - forma(s) * AMP).toFixed(2));

    const rotulo = rotuloNoInstante(msNoCiclo);
    if (rotulo !== rotuloAtual) {
      rotuloAtual = rotulo;
      faseEl.textContent = rotulo;
    }

    quadroId = requestAnimationFrame(quadro);
  }

  function atualizarCrono() {
    const segundos = Math.max(0, Math.floor((Date.now() - inicioTrabalhoTs) / 1000));
    cronoEl.textContent = formatarRelogio(segundos);
  }

  function iniciar() {
    if (quadroId != null) return;
    inicioOndaTs = null;
    rotuloAtual = null;
    inicioTrabalhoTs = Date.now();
    atualizarCrono();
    intervaloCrono = setInterval(atualizarCrono, 1000);
    quadroId = requestAnimationFrame(quadro);
  }

  function parar() {
    if (quadroId != null) cancelAnimationFrame(quadroId);
    quadroId = null;
    if (intervaloCrono) { clearInterval(intervaloCrono); intervaloCrono = null; }
  }

  return { elemento, iniciar, parar };
}
