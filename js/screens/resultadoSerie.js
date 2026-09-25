// js/screens/resultadoSerie.js
//
// Folha "Como foi a série?" — aparece ao tocar "Terminei — registrar"
// (auditoria 2026-09-24). Antes a série era gravada direto com reps e RIR
// pré-preenchidos (topo da faixa e RIR-alvo, ou cópia da sessão anterior),
// e nos dados reais 100% dos RIR registrados eram iguais ao alvo: a
// progressão e os alertas não tinham com o que trabalhar. Aqui as reps
// vêm com a meta da série (ajustável) e o RIR não vem marcado — tocar no
// RIR é o que confirma e registra. "Foi aquecimento" grava a série à parte,
// sem contar como série de trabalho.
import { animarSpring } from "../lib/spring.js";

const OPCOES_RIR = [0, 1, 2, 3, 4, 5];

/**
 * Resolve com { reps, rir, aquecimento: false }, { reps, rir: null,
 * aquecimento: true } ou null (voltar sem registrar).
 */
export function perguntarResultadoSerie({ numero, reps, rirSugerido = null, rirAlvo, repsMin, repsMax, rotuloReps = "Repetições" }) {
  return new Promise((resolve) => {
    let repsAtual = Math.max(0, reps ?? repsMin ?? 0);

    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet resultado-serie-sheet" role="dialog" aria-modal="true" aria-labelledby="rs-titulo">
        <div class="carga-sheet-handle"></div>
        <h3 id="rs-titulo"></h3>
        <div class="rs-linha">
          <span class="rs-rot"></span>
          <div class="rs-ctl">
            <button type="button" class="rs-menos" aria-label="Menos uma repetição">−</button>
            <b class="rs-reps" aria-live="polite"></b>
            <button type="button" class="rs-mais" aria-label="Mais uma repetição">+</button>
          </div>
        </div>
        <div class="rs-extras" role="group" aria-label="Série extra logo depois">
          <button type="button" class="rs-extra" data-extra="drop" aria-pressed="false">+ Drop-set</button>
          <button type="button" class="rs-extra" data-extra="restpause" aria-pressed="false">+ Rest-pause</button>
        </div>
        <p class="rs-pergunta">Quantas ainda sobravam?</p>
        <div class="rs-rir" role="group" aria-label="Repetições que sobravam (RIR)"></div>
        <p class="rs-dica"></p>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar rs-voltar">Voltar</button>
          <button type="button" class="carga-sheet-cancelar rs-aquecimento">Foi aquecimento</button>
        </div>
      </div>
    `;
    overlay.querySelector("#rs-titulo").textContent = `Série ${numero} — como foi?`;
    overlay.querySelector(".rs-rot").textContent = rotuloReps;
    overlay.querySelector(".rs-dica").textContent =
      `Meta: ${repsMin}–${repsMax}, parando com ${rirAlvo} sobrando. Responda o que aconteceu — é isso que decide quando a carga sobe.`;

    const repsEl = overlay.querySelector(".rs-reps");
    const desenharReps = () => { repsEl.textContent = String(repsAtual); };
    desenharReps();
    overlay.querySelector(".rs-menos").addEventListener("click", () => { repsAtual = Math.max(0, repsAtual - 1); desenharReps(); });
    overlay.querySelector(".rs-mais").addEventListener("click", () => { repsAtual += 1; desenharReps(); });

    // "+ Drop-set" / "+ Rest-pause": marca antes de tocar no RIR; depois
    // de registrar a série, abre a folha da mini-série extra.
    let extra = null;
    const botoesExtra = [...overlay.querySelectorAll(".rs-extra")];
    for (const botao of botoesExtra) {
      botao.addEventListener("click", () => {
        extra = extra === botao.dataset.extra ? null : botao.dataset.extra;
        for (const b of botoesExtra) {
          const ativo = b.dataset.extra === extra;
          b.classList.toggle("ativo", ativo);
          b.setAttribute("aria-pressed", String(ativo));
        }
      });
    }

    const rirEl = overlay.querySelector(".rs-rir");
    for (const valor of OPCOES_RIR) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "rs-rir-btn";
      if (valor === rirSugerido) botao.classList.add("sugerido");
      botao.textContent = valor === 5 ? "5+" : String(valor);
      botao.setAttribute("aria-label", valor === 0 ? "Nenhuma — falha" : `${valor === 5 ? "5 ou mais" : valor} sobrando`);
      botao.addEventListener("click", () => fechar({ reps: repsAtual, rir: valor, aquecimento: false, extra }));
      rirEl.appendChild(botao);
    }

    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 360 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    let fechada = false;
    function fechar(resultado) {
      if (fechada) return;
      fechada = true;
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 360;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
      });
      resolve(resultado);
    }

    overlay.querySelector(".rs-voltar").addEventListener("click", () => fechar(null));
    overlay.querySelector(".rs-aquecimento").addEventListener("click", () => fechar({ reps: repsAtual, rir: null, aquecimento: true }));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
  });
}

// Folha "Já fiz o exercício" — pra quando o exercício foi feito sem o app
// acompanhar (esqueceu de dar play, fez tudo e só lembrou depois). Registra
// as séries que faltam de uma vez: mesma carga e reps em todas, e o RIR da
// ÚLTIMA série (é o que mais importa pra progressão; as outras ficam sem
// RIR em vez de receber um número inventado).
export function perguntarExercicioInteiro({ nome, carga, incremento, series, reps, rirAlvo, repsMin, repsMax }) {
  return new Promise((resolve) => {
    const valores = { carga: Math.max(0, carga ?? 0), series: Math.max(1, series), reps: Math.max(0, reps ?? repsMin ?? 0) };
    const passoCarga = incremento > 0 ? incremento : 1;

    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet resultado-serie-sheet" role="dialog" aria-modal="true" aria-labelledby="rei-titulo">
        <div class="carga-sheet-handle"></div>
        <h3 id="rei-titulo">Já fiz — registrar tudo</h3>
        <p class="rs-dica rei-nome" style="margin:0 0 12px;"></p>
        <div class="rei-linhas"></div>
        <p class="rs-pergunta">Na última série, quantas ainda sobravam?</p>
        <div class="rs-rir" role="group" aria-label="Repetições que sobravam na última série (RIR)"></div>
        <p class="rs-dica"></p>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar rs-voltar">Cancelar</button>
        </div>
      </div>
    `;
    overlay.querySelector(".rei-nome").textContent = nome;
    overlay.querySelectorAll(".rs-dica")[1].textContent = `Meta: ${repsMin}–${repsMax}, parando com ${rirAlvo} sobrando. Se as séries variaram, registre pelo que foi mais comum.`;

    const CAMPOS = [
      { chave: "series", rotulo: "Séries", passo: 1, minimo: 1, formato: (v) => String(v) },
      { chave: "carga", rotulo: "Carga (kg)", passo: passoCarga, minimo: 0, formato: (v) => String(v).replace(".", ",") },
      { chave: "reps", rotulo: "Repetições por série", passo: 1, minimo: 0, formato: (v) => String(v) },
    ];
    const linhasEl = overlay.querySelector(".rei-linhas");
    for (const campo of CAMPOS) {
      const linha = document.createElement("div");
      linha.className = "rs-linha";
      linha.style.marginBottom = "8px";
      linha.innerHTML = `
        <span class="rs-rot"></span>
        <div class="rs-ctl">
          <button type="button" class="rs-menos">−</button>
          <b class="rs-reps" aria-live="polite"></b>
          <button type="button" class="rs-mais">+</button>
        </div>
      `;
      linha.querySelector(".rs-rot").textContent = campo.rotulo;
      linha.querySelector(".rs-menos").setAttribute("aria-label", `Diminuir ${campo.rotulo.toLowerCase()}`);
      linha.querySelector(".rs-mais").setAttribute("aria-label", `Aumentar ${campo.rotulo.toLowerCase()}`);
      const valorEl = linha.querySelector(".rs-reps");
      const desenhar = () => { valorEl.textContent = campo.formato(valores[campo.chave]); };
      desenhar();
      const ajustar = (delta) => {
        const novo = Math.round((valores[campo.chave] + delta * campo.passo) * 100) / 100;
        valores[campo.chave] = Math.max(campo.minimo, novo);
        desenhar();
      };
      linha.querySelector(".rs-menos").addEventListener("click", () => ajustar(-1));
      linha.querySelector(".rs-mais").addEventListener("click", () => ajustar(1));
      linhasEl.appendChild(linha);
    }

    const rirEl = overlay.querySelector(".rs-rir");
    for (const valor of OPCOES_RIR) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "rs-rir-btn";
      botao.textContent = valor === 5 ? "5+" : String(valor);
      botao.setAttribute("aria-label", valor === 0 ? "Nenhuma — falha" : `${valor === 5 ? "5 ou mais" : valor} sobrando`);
      botao.addEventListener("click", () => fechar({ ...valores, rir: valor }));
      rirEl.appendChild(botao);
    }

    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 420 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    let fechada = false;
    function fechar(resultado) {
      if (fechada) return;
      fechada = true;
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 420;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
      });
      resolve(resultado);
    }
    overlay.querySelector(".rs-voltar").addEventListener("click", () => fechar(null));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
  });
}

// Folha "Corrigir série" — tocar numa série já registrada na linha do
// tempo da execução. Corrige carga/reps/RIR ou apaga (desfazer), sem
// precisar ir no histórico do dia.
export function perguntarEdicaoSerie({ numero, carga, reps, rir, incremento }) {
  return new Promise((resolve) => {
    const valores = { carga: carga ?? 0, reps: reps ?? 0 };
    let rirEscolhido = rir;
    const passoCarga = incremento > 0 ? incremento : 1;

    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet resultado-serie-sheet" role="dialog" aria-modal="true" aria-labelledby="eds-titulo">
        <div class="carga-sheet-handle"></div>
        <h3 id="eds-titulo"></h3>
        <div class="eds-linhas"></div>
        <p class="rs-pergunta">Quantas sobravam?</p>
        <div class="rs-rir" role="group" aria-label="Repetições que sobravam (RIR)"></div>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar eds-apagar">Apagar série</button>
          <button type="button" class="carga-sheet-confirmar eds-salvar">Salvar</button>
        </div>
        <button type="button" class="pular-treino-btn eds-cancelar" style="margin:12px auto 0;">Cancelar</button>
      </div>
    `;
    overlay.querySelector("#eds-titulo").textContent = `Corrigir série ${numero}`;

    const linhasEl = overlay.querySelector(".eds-linhas");
    const CAMPOS = [
      { chave: "carga", rotulo: "Carga (kg)", passo: passoCarga, formato: (v) => String(v).replace(".", ",") },
      { chave: "reps", rotulo: "Repetições", passo: 1, formato: (v) => String(v) },
    ];
    for (const campo of CAMPOS) {
      const linha = document.createElement("div");
      linha.className = "rs-linha";
      linha.style.marginBottom = "8px";
      linha.innerHTML = `<span class="rs-rot"></span><div class="rs-ctl"><button type="button" class="rs-menos">−</button><b class="rs-reps"></b><button type="button" class="rs-mais">+</button></div>`;
      linha.querySelector(".rs-rot").textContent = campo.rotulo;
      linha.querySelector(".rs-menos").setAttribute("aria-label", `Diminuir ${campo.rotulo.toLowerCase()}`);
      linha.querySelector(".rs-mais").setAttribute("aria-label", `Aumentar ${campo.rotulo.toLowerCase()}`);
      const valorEl = linha.querySelector(".rs-reps");
      const desenhar = () => { valorEl.textContent = campo.formato(valores[campo.chave]); };
      desenhar();
      const ajustar = (delta) => {
        valores[campo.chave] = Math.max(0, Math.round((valores[campo.chave] + delta * campo.passo) * 100) / 100);
        desenhar();
      };
      linha.querySelector(".rs-menos").addEventListener("click", () => ajustar(-1));
      linha.querySelector(".rs-mais").addEventListener("click", () => ajustar(1));
      linhasEl.appendChild(linha);
    }

    const rirEl = overlay.querySelector(".rs-rir");
    const botoesRir = [];
    for (const valor of OPCOES_RIR) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "rs-rir-btn";
      botao.textContent = valor === 5 ? "5+" : String(valor);
      botao.setAttribute("aria-pressed", String(valor === rirEscolhido));
      botao.addEventListener("click", () => {
        rirEscolhido = valor;
        for (const b of botoesRir) b.classList.toggle("sugerido", b === botao);
        for (const b of botoesRir) b.setAttribute("aria-pressed", String(b === botao));
      });
      if (valor === rirEscolhido) botao.classList.add("sugerido");
      botoesRir.push(botao);
      rirEl.appendChild(botao);
    }

    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 420 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    let fechada = false;
    function fechar(resultado) {
      if (fechada) return;
      fechada = true;
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 420;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => {
        overlay.remove();
      });
      resolve(resultado);
    }
    overlay.querySelector(".eds-salvar").addEventListener("click", () => fechar({ acao: "salvar", carga: valores.carga, reps: valores.reps, rir: rirEscolhido ?? null }));
    overlay.querySelector(".eds-apagar").addEventListener("click", () => fechar({ acao: "apagar" }));
    overlay.querySelector(".eds-cancelar").addEventListener("click", () => fechar(null));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
  });
}

// Mini-série de drop-set (carga menor, sem pausa) ou rest-pause (mesma
// carga, ~15 s de pausa), logo depois de uma série de trabalho. Conta meia
// série no volume e fica fora da progressão (js/engine/volume.js).
export function perguntarMiniSerie({ tipo, carga, incremento, reps }) {
  return new Promise((resolve) => {
    const passoCarga = incremento > 0 ? incremento : 1;
    const arredondar = (v) => Math.max(0, Math.round(Math.round(v / passoCarga) * passoCarga * 100) / 100);
    const valores = {
      carga: tipo === "drop" ? arredondar((carga ?? 0) * 0.8) : (carga ?? 0),
      reps: Math.max(1, Math.round((reps ?? 6) / (tipo === "drop" ? 2 : 3))),
    };

    const overlay = document.createElement("div");
    overlay.className = "carga-sheet-overlay";
    overlay.innerHTML = `
      <div class="carga-sheet resultado-serie-sheet" role="dialog" aria-modal="true" aria-labelledby="mini-titulo">
        <div class="carga-sheet-handle"></div>
        <h3 id="mini-titulo"></h3>
        <p class="rs-dica" style="margin:0 0 12px;"></p>
        <div class="mini-linhas"></div>
        <div class="carga-sheet-acoes">
          <button type="button" class="carga-sheet-cancelar mini-cancelar">Não fiz</button>
          <button type="button" class="carga-sheet-confirmar mini-salvar">Registrar</button>
        </div>
      </div>
    `;
    overlay.querySelector("#mini-titulo").textContent = tipo === "drop" ? "Drop-set" : "Rest-pause";
    overlay.querySelector(".rs-dica").textContent = tipo === "drop"
      ? "Baixou a carga (~20%) e continuou sem descansar. Quantas reps saíram?"
      : "Descansou ~15 s com a mesma carga e fez mais algumas reps. Quantas saíram?";

    const linhasEl = overlay.querySelector(".mini-linhas");
    const CAMPOS = [
      { chave: "carga", rotulo: "Carga (kg)", passo: passoCarga, formato: (v) => String(v).replace(".", ",") },
      { chave: "reps", rotulo: "Repetições", passo: 1, formato: (v) => String(v) },
    ];
    for (const campo of CAMPOS) {
      const linha = document.createElement("div");
      linha.className = "rs-linha";
      linha.style.marginBottom = "8px";
      linha.innerHTML = `<span class="rs-rot"></span><div class="rs-ctl"><button type="button" class="rs-menos">−</button><b class="rs-reps"></b><button type="button" class="rs-mais">+</button></div>`;
      linha.querySelector(".rs-rot").textContent = campo.rotulo;
      linha.querySelector(".rs-menos").setAttribute("aria-label", `Diminuir ${campo.rotulo.toLowerCase()}`);
      linha.querySelector(".rs-mais").setAttribute("aria-label", `Aumentar ${campo.rotulo.toLowerCase()}`);
      const valorEl = linha.querySelector(".rs-reps");
      const desenhar = () => { valorEl.textContent = campo.formato(valores[campo.chave]); };
      desenhar();
      const ajustar = (delta) => {
        valores[campo.chave] = Math.max(0, Math.round((valores[campo.chave] + delta * campo.passo) * 100) / 100);
        desenhar();
      };
      linha.querySelector(".rs-menos").addEventListener("click", () => ajustar(-1));
      linha.querySelector(".rs-mais").addEventListener("click", () => ajustar(1));
      linhasEl.appendChild(linha);
    }

    document.body.appendChild(overlay);
    const sheetEl = overlay.querySelector(".carga-sheet");
    sheetEl.style.transform = "translate3d(0, 100%, 0)";
    animarSpring(sheetEl, { y: sheetEl.getBoundingClientRect().height || 320 }, { y: 0 }, { rigidez: 340, amortecimento: 30 });
    requestAnimationFrame(() => overlay.classList.add("aberta"));

    let fechada = false;
    function fechar(resultado) {
      if (fechada) return;
      fechada = true;
      overlay.classList.remove("aberta");
      const alturaAtual = sheetEl.getBoundingClientRect().height || 320;
      animarSpring(sheetEl, { y: 0 }, { y: alturaAtual }, { rigidez: 420, amortecimento: 36 }).finalizado.then(() => overlay.remove());
      resolve(resultado);
    }
    overlay.querySelector(".mini-salvar").addEventListener("click", () => fechar({ ...valores }));
    overlay.querySelector(".mini-cancelar").addEventListener("click", () => fechar(null));
    overlay.addEventListener("click", (evento) => { if (evento.target === overlay) fechar(null); });
  });
}
