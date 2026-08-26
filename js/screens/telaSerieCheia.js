// js/screens/telaSerieCheia.js
//
// Telão da série: cobre a tela inteira do começo da repetição até o fim do
// descanso — não fecha entre os dois. Tem dois modos, alternados por
// data-modo no elemento raiz:
//
// - "trabalho": nome do exercício, carga/reps/ciclo, a onda com a bolinha
//   (guia de cadência) em destaque e o cronômetro subindo. Reaproveita a
//   matemática do guia compacto (js/engine/ondaCadencia.js).
// - "descanso": o mesmo cabeçalho/trilha, mas o corpo vira um anel
//   regressivo lima com o tempo restante no centro — quem toca "Terminei"
//   já vê a contagem do descanso sem sair da tela.
// - "contagem": um número grande contando regressivo antes da onda — 5→1
//   na primeira série do exercício (dá tempo de posicionar o celular) ou
//   3→1 nas seguintes. Dispara ao tocar "Comecei a série" na primeira, e
//   sozinho ao sair do descanso (zerou ou foi pulado) nas seguintes — o
//   telão nunca fecha nesse meio-tempo, só troca o corpo de lugar.
import { fasesDaCadencia, totalDaRepeticao } from "../engine/cadencia.js";
import { formaOnda as forma, construirPercursoOnda as construirPercurso } from "../engine/ondaCadencia.js";

const CINZA = "#303030";
const LIMA = "#C9F241";
const ONDAS_DESENHADAS = 6;
const RAIO_ANEL = 86;
const CIRCUNFERENCIA_ANEL = 2 * Math.PI * RAIO_ANEL;

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
 * Monta o telão. Devolve { elemento, iniciarTrabalho, pararTrabalho,
 * mostrarDescanso, atualizarDescanso, mostrarContagem, atualizarSerieAtual }
 * — quem chama controla o ciclo de vida (a animação e os cronômetros só
 * correm com a série/descanso em andamento) e decide quando anexar/remover
 * `elemento` do DOM.
 *
 * `aoFechar` é a seta de voltar no cabeçalho (só esconde o telão, não
 * cancela a série nem o descanso). `aoTerminar` é o botão
 * "Terminei — registrar", que decide o que fazer com a série em
 * andamento — o telão não sabe registrar nada sozinho. `aoAjustarDescanso`
 * é chamado pelos botões ±30 do anel de descanso. `aoPularDescanso` é
 * chamado por "Pular descanso" — encerra o descanso na hora, mesmo com
 * tempo sobrando.
 */
export function montarTelaSerieCheia({
  exercicio,
  cadencia,
  cargaSelecionada,
  repsMax,
  rirAlvo,
  repsAtual,
  rirAtual,
  incrementoCarga = 1,
  totalSeriesAlvo,
  numeroAtual,
  aoFechar,
  aoTerminar,
  aoAjustarDescanso,
  aoPularDescanso,
  aoAjustar,
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
      <!-- Ajuste sempre à mão, em qualquer modo (onda, descanso, contagem)
           — fica em .sc-info, que nunca troca. Antes só dava pra mudar
           carga/reps/RIR voltando pra tela normal por trás do telão.
           Substitui as tiles de carga/reps de antes (eram só leitura) —
           "ciclo" continua como info pura, não é algo que se ajuste aqui. -->
      <div class="sc-ajuste">
        <div class="sc-ajuste-campos">
          <button type="button" class="sc-ajuste-campo" data-campo="carga"><b></b><span>kg</span></button>
          <button type="button" class="sc-ajuste-campo" data-campo="reps"><b></b><span>reps</span></button>
          <button type="button" class="sc-ajuste-campo" data-campo="rir"><b></b><span>RIR</span></button>
          <div class="sc-tile sc-tile-ciclo"><b></b><span>ciclo</span></div>
        </div>
        <div class="sc-ajuste-ctl">
          <span class="sc-ajuste-rot">Ajustando <b></b></span>
          <button type="button" class="sc-ajuste-menos" aria-label="Diminuir">−</button>
          <button type="button" class="sc-ajuste-mais" aria-label="Aumentar">+</button>
        </div>
      </div>
    </div>
    <div class="sc-corpo">
      <div class="sc-corpo-trabalho">
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
      <div class="sc-corpo-descanso">
        <div class="sc-anel-box">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle class="sc-anel-trilha" cx="100" cy="100" r="${RAIO_ANEL}" />
            <circle class="sc-anel-progresso" cx="100" cy="100" r="${RAIO_ANEL}" transform="rotate(-90 100 100)" />
          </svg>
          <div class="sc-anel-centro">
            <b class="sc-anel-t" role="status" aria-live="polite">00:00</b>
            <span>descanso</span>
          </div>
        </div>
        <div class="sc-anel-ctl">
          <button type="button" data-action="menos" aria-label="Menos 30 segundos">−30</button>
          <button type="button" data-action="mais" aria-label="Mais 30 segundos">+30</button>
        </div>
        <button type="button" class="sc-anel-pular">Pular descanso</button>
      </div>
      <div class="sc-corpo-contagem">
        <b class="sc-contagem-n" role="status" aria-live="polite"></b>
        <span class="sc-contagem-rotulo"></span>
      </div>
    </div>
    <div class="sc-foot"><button type="button" class="sc-terminar">Terminei — registrar</button></div>
  `;

  elemento.querySelector(".sc-nome").textContent = exercicio.nome;
  const musculo = exercicio.musculoPrimario ? exercicio.musculoPrimario : "";
  elemento.querySelector(".sc-sub").textContent = [musculo, `RIR ${formatarNumero(rirAlvo)}`].filter(Boolean).join(" · ");

  elemento.querySelector(".sc-tile-ciclo b").textContent = `${formatarNumero(totalDaRepeticao(cadencia))}s`;

  // Controle de carga/reps/RIR — mesma ideia do trio da tela normal
  // (um campo "ativo" por vez, um −/+ compartilhado embaixo), só que
  // compacto e sempre visível aqui dentro do telão, em qualquer modo.
  const valoresAjuste = { carga: cargaSelecionada, reps: repsAtual, rir: rirAtual };
  let campoAjusteAtivo = "reps";
  const botoesCampo = elemento.querySelectorAll(".sc-ajuste-campo");
  const rotAjusteEl = elemento.querySelector(".sc-ajuste-rot b");
  const ROTULOS_AJUSTE = { carga: "carga", reps: "reps", rir: "RIR" };

  function redesenharAjuste() {
    for (const botao of botoesCampo) {
      const campo = botao.dataset.campo;
      botao.querySelector("b").textContent = formatarNumero(valoresAjuste[campo]);
      botao.classList.toggle("ativo", campo === campoAjusteAtivo);
    }
    rotAjusteEl.textContent = ROTULOS_AJUSTE[campoAjusteAtivo];
  }
  redesenharAjuste();

  for (const botao of botoesCampo) {
    botao.addEventListener("click", () => {
      campoAjusteAtivo = botao.dataset.campo;
      redesenharAjuste();
    });
  }

  function ajustar(delta) {
    if (campoAjusteAtivo === "carga") valoresAjuste.carga = Math.max(incrementoCarga, valoresAjuste.carga + delta * incrementoCarga);
    else if (campoAjusteAtivo === "reps") valoresAjuste.reps = Math.max(0, valoresAjuste.reps + delta);
    else valoresAjuste.rir = Math.max(0, valoresAjuste.rir + delta);
    redesenharAjuste();
    if (aoAjustar) aoAjustar(campoAjusteAtivo, delta);
  }
  elemento.querySelector(".sc-ajuste-menos").addEventListener("click", () => ajustar(-1));
  elemento.querySelector(".sc-ajuste-mais").addEventListener("click", () => ajustar(1));

  // Chamado pela tela normal quando ela mesma altera um valor (o trio de
  // lá continua existindo e editável por trás) — mantém os dois em sincronia
  // nos dois sentidos, sem que um dependa do outro pra funcionar sozinho.
  function atualizarValores({ carga, reps, rir }) {
    if (carga != null) valoresAjuste.carga = carga;
    if (reps != null) valoresAjuste.reps = reps;
    if (rir != null) valoresAjuste.rir = rir;
    redesenharAjuste();
  }

  elemento.querySelector(".sc-voltar").addEventListener("click", () => { if (aoFechar) aoFechar(); });
  const terminarBtn = elemento.querySelector(".sc-terminar");
  terminarBtn.addEventListener("click", () => {
    // O aperto de confirmação toca junto com o crossfade pro descanso — o
    // mesmo toque que fecha a onda é o que abre o anel, então os dois
    // reagem juntos em vez de um cortar seco pro outro.
    terminarBtn.classList.remove("confirmando");
    void terminarBtn.offsetWidth; // reinicia a animação se for tocado de novo rápido
    terminarBtn.classList.add("confirmando");
    if (aoTerminar) aoTerminar();
  });

  // Um corpo por modo, sobrepostos — trocar de modo alterna qual deles
  // carrega a classe "ativo" (crossfade + leve escala via CSS) em vez de
  // um corte seco. O data-modo na raiz continua existindo só pro rodapé
  // (só o modo "trabalho" mostra "Terminei — registrar").
  const corposPorModo = {
    trabalho: elemento.querySelector(".sc-corpo-trabalho"),
    descanso: elemento.querySelector(".sc-corpo-descanso"),
    contagem: elemento.querySelector(".sc-corpo-contagem"),
  };
  function mostrarModo(modo) {
    elemento.dataset.modo = modo;
    for (const [chave, corpo] of Object.entries(corposPorModo)) {
      corpo.classList.toggle("ativo", chave === modo);
    }
  }
  mostrarModo("contagem");

  const anelProgresso = elemento.querySelector(".sc-anel-progresso");
  anelProgresso.style.strokeDasharray = String(CIRCUNFERENCIA_ANEL);
  anelProgresso.style.strokeDashoffset = "0";
  elemento.querySelector('.sc-anel-ctl [data-action="menos"]').addEventListener("click", () => { if (aoAjustarDescanso) aoAjustarDescanso(-30); });
  elemento.querySelector('.sc-anel-ctl [data-action="mais"]').addEventListener("click", () => { if (aoAjustarDescanso) aoAjustarDescanso(30); });
  elemento.querySelector(".sc-anel-pular").addEventListener("click", () => { if (aoPularDescanso) aoPularDescanso(); });

  const AMP = 78;
  const CY = 130;
  const LARGURA_ONDA = 400 / 1.8;

  const grupoOnda = elemento.querySelector(".onda");
  const bolinha = elemento.querySelector(".bolinha");
  const faseEl = elemento.querySelector(".sc-fase");
  const cronoEl = elemento.querySelector(".sc-crono");
  const anelTextoEl = elemento.querySelector(".sc-anel-t");
  const contagemNumeroEl = elemento.querySelector(".sc-contagem-n");
  const contagemRotuloEl = elemento.querySelector(".sc-contagem-rotulo");
  const trilhoTracosEl = elemento.querySelector(".sc-trilho-tracos");
  const trilhoNumeroEl = elemento.querySelector(".sc-trilho-n");

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
  let repAtual = 1;
  let inicioTrabalhoTs = Date.now();
  let intervaloCrono = null;
  let contagemIntervalId = null;

  // A repetição contada é derivada direto do relógio da onda (quantos
  // ciclos completos já se passaram) — não existe um contador separado
  // que possa dessincronizar da bolinha. Mora junto do rótulo de fase
  // (não numa tile própria) desde que as tiles de carga/reps viraram o
  // controle editável .sc-ajuste, que já mostra o valor que vai ser
  // registrado — este aqui é só "em qual repetição a bolinha está".
  function atualizarFaseTexto() {
    faseEl.textContent = `${rotuloAtual} · rep ${repAtual}/${formatarNumero(repsMax)}`;
  }

  function quadro(ts) {
    if (inicioOndaTs == null) inicioOndaTs = ts;
    const decorrido = ts - inicioOndaTs;
    const msNoCiclo = decorrido % cicloMs;
    const s = percurso(msNoCiclo / cicloMs);

    grupoOnda.setAttribute("transform", `translate(${(200 - (2 + s) * LARGURA_ONDA).toFixed(2)},0)`);
    bolinha.setAttribute("cy", (CY - forma(s) * AMP).toFixed(2));

    const rotulo = rotuloNoInstante(msNoCiclo);
    const novoRep = Math.min(repsMax, Math.floor(decorrido / cicloMs) + 1);
    if (rotulo !== rotuloAtual || novoRep !== repAtual) {
      rotuloAtual = rotulo;
      repAtual = novoRep;
      atualizarFaseTexto();
    }

    quadroId = requestAnimationFrame(quadro);
  }

  function atualizarCrono() {
    const segundos = Math.max(0, Math.floor((Date.now() - inicioTrabalhoTs) / 1000));
    cronoEl.textContent = formatarRelogio(segundos);
  }

  function iniciarTrabalho() {
    mostrarModo("trabalho");
    if (quadroId != null) return;
    inicioOndaTs = null;
    rotuloAtual = null;
    repAtual = 1;
    inicioTrabalhoTs = Date.now();
    atualizarCrono();
    intervaloCrono = setInterval(atualizarCrono, 1000);
    quadroId = requestAnimationFrame(quadro);
  }

  function pararTrabalho() {
    if (quadroId != null) cancelAnimationFrame(quadroId);
    quadroId = null;
    if (intervaloCrono) { clearInterval(intervaloCrono); intervaloCrono = null; }
    if (contagemIntervalId != null) { clearInterval(contagemIntervalId); contagemIntervalId = null; }
  }

  // Troca o corpo do telão pro anel regressivo — chamado quando a série
  // termina e o descanso começa, sem fechar o telão nem trocar de tela.
  function mostrarDescanso(duracaoInicialSegundos) {
    mostrarModo("descanso");
    atualizarDescanso(duracaoInicialSegundos, duracaoInicialSegundos);
  }

  function atualizarDescanso(restante, duracaoTotal) {
    const fracao = duracaoTotal > 0 ? Math.max(0, Math.min(1, restante / duracaoTotal)) : 0;
    anelProgresso.style.strokeDashoffset = String(CIRCUNFERENCIA_ANEL * (1 - fracao));
    anelTextoEl.textContent = formatarRelogio(Math.max(0, restante));
  }

  // Contagem regressiva simples (5s antes da primeira série da tela — dá
  // tempo de posicionar o celular — ou 3s ao sair do descanso). Não usa
  // rAF: um número por segundo não precisa de quadro a quadro, e um
  // setInterval reage bem a qualquer atraso do navegador sem desviar do
  // segundo certo.
  function mostrarContagem(segundosTotais, rotulo, aoTerminar) {
    if (contagemIntervalId != null) { clearInterval(contagemIntervalId); contagemIntervalId = null; }
    mostrarModo("contagem");
    contagemRotuloEl.textContent = rotulo;

    let restante = segundosTotais;
    contagemNumeroEl.textContent = String(restante);
    contagemIntervalId = setInterval(() => {
      restante -= 1;
      if (restante <= 0) {
        clearInterval(contagemIntervalId);
        contagemIntervalId = null;
        if (aoTerminar) aoTerminar();
        return;
      }
      contagemNumeroEl.textContent = String(restante);
    }, 1000);
  }

  // Atualiza a trilha/número de série sem reconstruir o telão — usado no
  // avanço direto pro próximo trabalho (descanso zerou ou foi pulado), onde
  // o mesmo telão continua aberto em vez de fechar e reabrir.
  function atualizarSerieAtual(numero) {
    [...trilhoTracosEl.children].forEach((traco, indice) => {
      traco.className = indice + 1 <= numero ? "on" : "";
    });
    trilhoNumeroEl.textContent = `${numero}/${totalSeriesAlvo}`;
  }

  return {
    elemento,
    iniciarTrabalho,
    pararTrabalho,
    mostrarDescanso,
    atualizarDescanso,
    mostrarContagem,
    atualizarSerieAtual,
    atualizarValores,
  };
}
