// js/engine/progressao.js
//
// Dupla progressão (auditoria 2026-09-24). Substitui a antiga sugestão de
// carga por regressão RIR × carga (js/engine/cargas.js), que tinha o sinal
// invertido e, com o RIR sempre igual ao alvo, virava a média das últimas
// 5 séries — uma série mais leve no meio puxava a carga pra baixo sessão
// após sessão (remada baixa 25→20 kg, puxada 30→22,5 kg nos dados reais).
//
// Regra (ficha.json > progressaoDupla):
// - Base = maior carga de trabalho da última sessão (nunca a média).
// - Todas as séries feitas nessa carga (pelo menos 2, ou a única série da
//   sessão) chegaram ao topo da faixa, com RIR não mais que 1 abaixo do
//   alvo → sobe um incremento e volta pro fundo da faixa. Séries mais leves
//   não travam a subida: no histórico antigo o aquecimento era gravado como
//   série de trabalho (ex.: puxada 10/30/30 kg).
// - Alguma série abaixo do mínimo da faixa em 2 sessões seguidas com a
//   mesma carga → reduz ~5% (pelo menos um incremento).
// - Senão, mantém a carga e busca +1 repetição.
// Sessões de deload (semana 7) são ignoradas: carga igual com volume e
// esforço menores não diz nada sobre progresso.

const FOLGA_RIR_PARA_SUBIR = 1;
const MINIMO_SERIES_NA_BASE = 2;

// Números nas mensagens no formato brasileiro (2,5 kg, não 2.5 kg).
const kg = (valor) => String(valor).replace(".", ",");
const REDUCAO_PERCENTUAL = 0.05;

function seriesDeTrabalho(sessao) {
  return (sessao?.series ?? []).filter((s) => s.tipoSerie !== "aquecimento" && s.carga != null && s.reps != null);
}

function ehSessaoDeDeload(sessao) {
  const trabalho = seriesDeTrabalho(sessao);
  return trabalho.length > 0 && trabalho.every((s) => s.semanaBloco === 7);
}

function arredondarParaIncremento(valor, incremento) {
  if (!(incremento > 0)) return Math.round(valor * 2) / 2;
  return Math.round(Math.round(valor / incremento) * incremento * 100) / 100;
}

function cargaBase(sessao) {
  return Math.max(...seriesDeTrabalho(sessao).map((s) => s.carga));
}

function algumaAbaixoDoMinimo(sessao, carga, faixaMin) {
  return seriesDeTrabalho(sessao).some((s) => s.carga === carga && s.reps < faixaMin);
}

/**
 * `historicoSessoes`: sessões ANTERIORES do mesmo exercício, da mais recente
 * pra mais antiga, cada uma { data, series: [{ carga, reps, rir, tipoSerie, semanaBloco }] }.
 * Devolve { acao, carga, repsAlvo, motivo }, com acao em
 * "primeira_vez" | "aumentar" | "manter" | "reduzir".
 */
export function sugerirProximaCarga({ historicoSessoes = [], faixaMin, faixaMax, rirAlvo, incremento }) {
  const validas = historicoSessoes.filter((s) => seriesDeTrabalho(s).length > 0 && !ehSessaoDeDeload(s));

  if (validas.length === 0) {
    const ultimaQualquer = historicoSessoes.find((s) => seriesDeTrabalho(s).length > 0);
    if (ultimaQualquer) {
      return {
        acao: "manter",
        carga: cargaBase(ultimaQualquer),
        repsAlvo: faixaMin,
        motivo: "Só há sessões de deload registradas — repita a carga de trabalho mais alta.",
      };
    }
    return {
      acao: "primeira_vez",
      carga: null,
      repsAlvo: faixaMin,
      motivo: `Primeira vez: escolha uma carga que te leve a ~${faixaMin} reps parando com ${rirAlvo} sobrando.`,
    };
  }

  const ultima = validas[0];
  const base = cargaBase(ultima);
  const trabalho = seriesDeTrabalho(ultima);
  const semIncremento = !(incremento > 0);

  const naBase = trabalho.filter((s) => s.carga === base);
  const seriesSuficientes = naBase.length >= Math.min(MINIMO_SERIES_NA_BASE, trabalho.length);
  const todasNoTopo = seriesSuficientes && naBase.every(
    (s) => s.reps >= faixaMax && (s.rir == null || s.rir >= rirAlvo - FOLGA_RIR_PARA_SUBIR)
  );
  if (todasNoTopo) {
    if (semIncremento) {
      return {
        acao: "aumentar",
        carga: base,
        repsAlvo: faixaMin,
        motivo: `Você fechou ${faixaMax} em todas as séries — aumente a dificuldade do exercício e volte pra ${faixaMin}.`,
      };
    }
    return {
      acao: "aumentar",
      carga: arredondarParaIncremento(base + incremento, incremento),
      repsAlvo: faixaMin,
      motivo: `Todas as séries chegaram a ${faixaMax} reps com ${kg(base)} kg — sobe ${kg(incremento)} kg e volta pra ${faixaMin}.`,
    };
  }

  const penultima = validas[1];
  if (
    penultima &&
    cargaBase(penultima) === base &&
    algumaAbaixoDoMinimo(ultima, base, faixaMin) &&
    algumaAbaixoDoMinimo(penultima, base, faixaMin) &&
    !semIncremento
  ) {
    const reduzida = Math.min(
      base - incremento,
      Math.floor((base * (1 - REDUCAO_PERCENTUAL)) / incremento) * incremento
    );
    return {
      acao: "reduzir",
      carga: Math.max(incremento, arredondarParaIncremento(reduzida, incremento)),
      repsAlvo: faixaMin,
      motivo: `Abaixo de ${faixaMin} reps em 2 sessões seguidas com ${kg(base)} kg — reduz um pouco e reconstrói.`,
    };
  }

  const menorReps = Math.min(...naBase.map((s) => s.reps));
  const motivo = menorReps >= faixaMax
    ? `Mantém ${kg(base)} kg: bateu ${faixaMax} reps, mas mais perto da falha que o alvo (ou numa série só). Repita com ${rirAlvo} sobrando.`
    : `Mantém ${kg(base)} kg e tenta +1 rep na série que ficou mais baixa (${menorReps}).`;
  return {
    acao: "manter",
    carga: base,
    repsAlvo: Math.min(faixaMax, menorReps + 1),
    motivo,
  };
}

// Capacidade estimada da série: reps feitas + reps que ainda sobravam.
// Base comum para comparar desempenho entre séries/sessões e checar se o
// RIR declarado é coerente.
export function capacidadeDaSerie(serie) {
  if (serie?.reps == null) return null;
  return serie.reps + (serie.rir ?? 0);
}
