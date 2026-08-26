// js/engine/cadencia.js
//
// Cadência = quantos segundos cada fase da repetição dura. A ficha sempre
// descreveu isso em prosa ("1s puxando · 3s voltando"), que serve pra ler
// mas não pra um guia visual seguir. Aqui a prosa vira número, o usuário
// pode sobrescrever por exercício, e o total é limitado.
//
// O teto de 8s por repetição vem da base científica do projeto
// (base-cientifica-hipertrofia-forca.md): faixas de 0,5 a 8 segundos por
// repetição produzem hipertrofia semelhante, e cadências acima de ~10s
// prejudicam por reduzirem a carga que dá pra usar. 8s é a borda de cima da
// faixa equivalente — passar disso começa a custar carga sem entregar mais.

export const TOTAL_MAXIMO_SEGUNDOS = 8;
export const FASE_MINIMA_SEGUNDOS = 0.5;

export const CADENCIA_PADRAO = {
  concentrica: 2,
  pausaTopo: 0,
  excentrica: 3,
  pausaBase: 0,
  verboSubida: "subindo",
  verboDescida: "descendo",
};

function extrairSegundos(trecho) {
  const achado = String(trecho).match(/(\d+(?:[.,]\d+)?)\s*s\b/);
  return achado ? Number(achado[1].replace(",", ".")) : null;
}

function extrairVerbo(trecho) {
  const achado = String(trecho).match(/\d+(?:[.,]\d+)?\s*s\s+([a-zà-ú]+)/i);
  return achado ? achado[1].toLowerCase() : null;
}

// Lê a prosa da ficha. A ordem dos trechos é o que identifica cada fase — o
// verbo sozinho seria ambíguo, já que "abrindo" aparece tanto como subida
// ("1s abrindo · 2s voltando") quanto como descida ("1s fechando · 3s abrindo").
// Devolve null pra isometria e pra qualquer texto fora do formato.
export function interpretarTempo(texto) {
  if (typeof texto !== "string") return null;
  if (/isometria/i.test(texto)) return null;

  const trechos = texto.split("·").map((t) => t.trim()).filter(Boolean);
  if (trechos.length < 2) return null;

  const concentrica = extrairSegundos(trechos[0]);
  const excentrica = extrairSegundos(trechos[1]);
  if (concentrica == null || excentrica == null) return null;

  const cadencia = {
    concentrica,
    pausaTopo: 0,
    excentrica,
    pausaBase: 0,
    verboSubida: extrairVerbo(trechos[0]) ?? CADENCIA_PADRAO.verboSubida,
    verboDescida: extrairVerbo(trechos[1]) ?? CADENCIA_PADRAO.verboDescida,
  };

  // Terceiro trecho é sempre uma espera: "aperto" é no pico da contração
  // (topo), "pausa embaixo" é na posição alongada (base).
  if (trechos[2]) {
    const segundos = extrairSegundos(trechos[2]) ?? 0;
    if (/embaixo|baixo|alongad/i.test(trechos[2])) cadencia.pausaBase = segundos;
    else cadencia.pausaTopo = segundos;
  }

  return cadencia;
}

export function totalDaRepeticao(cadencia) {
  if (!cadencia) return 0;
  return (cadencia.concentrica ?? 0) + (cadencia.pausaTopo ?? 0)
    + (cadencia.excentrica ?? 0) + (cadencia.pausaBase ?? 0);
}

// Diz se dá pra usar a cadência como está — a UI de edição usa isso pra
// bloquear o salvamento e explicar o motivo, em vez de aceitar e alterar o
// número por baixo do usuário.
export function validarCadencia(cadencia) {
  if (!cadencia) return { valida: false, motivo: "Cadência não informada." };

  const fases = [
    ["concentrica", cadencia.concentrica],
    ["excentrica", cadencia.excentrica],
  ];
  for (const [nome, valor] of fases) {
    if (!(valor >= FASE_MINIMA_SEGUNDOS)) {
      return { valida: false, motivo: `A fase ${nome === "concentrica" ? "de subida" : "de descida"} precisa de pelo menos ${FASE_MINIMA_SEGUNDOS}s.` };
    }
  }
  for (const nome of ["pausaTopo", "pausaBase"]) {
    if ((cadencia[nome] ?? 0) < 0) return { valida: false, motivo: "As pausas não podem ser negativas." };
  }

  const total = totalDaRepeticao(cadencia);
  if (total > TOTAL_MAXIMO_SEGUNDOS) {
    return {
      valida: false,
      motivo: `A repetição ficaria com ${total}s. O limite é ${TOTAL_MAXIMO_SEGUNDOS}s — acima disso a cadência começa a custar carga sem entregar mais resultado.`,
    };
  }
  return { valida: true, motivo: null };
}

// Rede de segurança pra dado que já está salvo (vindo de backup antigo, de
// sync, ou de uma edição manual do JSON). Corta o excedente da fase mais
// longa em vez de recusar, porque aqui não existe usuário pra avisar.
export function normalizarCadencia(cadencia) {
  const base = { ...CADENCIA_PADRAO, ...(cadencia ?? {}) };
  const limpa = {
    ...base,
    concentrica: Math.max(FASE_MINIMA_SEGUNDOS, Number(base.concentrica) || CADENCIA_PADRAO.concentrica),
    excentrica: Math.max(FASE_MINIMA_SEGUNDOS, Number(base.excentrica) || CADENCIA_PADRAO.excentrica),
    pausaTopo: Math.max(0, Number(base.pausaTopo) || 0),
    pausaBase: Math.max(0, Number(base.pausaBase) || 0),
  };

  let excedente = totalDaRepeticao(limpa) - TOTAL_MAXIMO_SEGUNDOS;
  if (excedente <= 0) return limpa;

  // Tira primeiro das pausas — elas são o extra, as fases de movimento são o
  // exercício em si.
  for (const chave of ["pausaBase", "pausaTopo"]) {
    if (excedente <= 0) break;
    const corte = Math.min(limpa[chave], excedente);
    limpa[chave] -= corte;
    excedente -= corte;
  }

  // Se ainda sobra, encolhe subida e descida JUNTAS, proporcionalmente. Tirar
  // tudo de uma fase só não fecha a conta (ela trava no mínimo e o total
  // continua estourado) e ainda destruiria a proporção entre as duas, que é
  // justamente o que dá o caráter da cadência.
  if (excedente > 0) {
    const soma = limpa.concentrica + limpa.excentrica;
    const disponivel = Math.max(FASE_MINIMA_SEGUNDOS * 2, soma - excedente);
    const concentrica = Math.max(FASE_MINIMA_SEGUNDOS, arredondar(limpa.concentrica * (disponivel / soma)));
    limpa.concentrica = concentrica;
    limpa.excentrica = Math.max(FASE_MINIMA_SEGUNDOS, arredondar(disponivel - concentrica));
  }
  return limpa;
}

function arredondar(n) { return Math.round(n * 10) / 10; }

// Cadência final de um exercício: o que a ficha prescreve, com o ajuste do
// usuário por cima quando existe.
export function cadenciaDoExercicio(exercicio, ajusteDoUsuario = null) {
  const daFicha = exercicio?.cadencia
    ?? interpretarTempo(exercicio?.prescricao?.tempo ?? exercicio?.tempo)
    ?? CADENCIA_PADRAO;
  return normalizarCadencia({ ...daFicha, ...(ajusteDoUsuario ?? {}) });
}

// Regenera a prosa a partir dos números, pra tela nunca mostrar um texto que
// contradiz o que a bolinha está fazendo.
export function textoDaCadencia(cadencia) {
  const c = normalizarCadencia(cadencia);
  const formatar = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
  const partes = [
    `${formatar(c.concentrica)}s ${c.verboSubida}`,
    `${formatar(c.excentrica)}s ${c.verboDescida}`,
  ];
  if (c.pausaTopo > 0) partes.push(`${formatar(c.pausaTopo)}s de aperto no topo`);
  if (c.pausaBase > 0) partes.push(`${formatar(c.pausaBase)}s de pausa embaixo`);
  return partes.join(" · ");
}

// Fases na ordem cronológica real do movimento, prontas pro guia visual
// consumir. A prosa da ficha lista o aperto por último, mas ele acontece
// entre subir e descer.
export function fasesDaCadencia(cadencia) {
  const c = normalizarCadencia(cadencia);
  const fases = [{ chave: "concentrica", rotulo: capitalizar(c.verboSubida), segundos: c.concentrica }];
  if (c.pausaTopo > 0) fases.push({ chave: "pausaTopo", rotulo: "Segure", segundos: c.pausaTopo });
  fases.push({ chave: "excentrica", rotulo: capitalizar(c.verboDescida), segundos: c.excentrica });
  if (c.pausaBase > 0) fases.push({ chave: "pausaBase", rotulo: "Pausa embaixo", segundos: c.pausaBase });
  return fases;
}

function capitalizar(texto) {
  const t = String(texto ?? "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
