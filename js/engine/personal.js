// js/engine/personal.js
//
// A conversa do "personal" ao abrir um exercício: junta numa fala só o que o
// app já sabe — a carga do dia (dupla progressão, js/engine/progressao.js),
// a prescrição da ficha (séries, faixa, quantas sobrando, falha só na
// última, ritmo, descanso, cuidado) e o aquecimento — mais o recado escrito
// pela análise do treino (Claude, scripts/recado-personal.mjs), que vale só
// pra próxima vez que o exercício for feito. Motor puro: nada de DOM nem banco.

function kg(valor) {
  return `${String(Math.round(valor * 100) / 100).replace(".", ",")} kg`;
}

function sobrando(rir) {
  const n = Math.round(rir);
  if (n <= 0) return "até a falha";
  return n === 1 ? "1 repetição sobrando" : `${n} repetições sobrando`;
}

// O recado é escrito depois de olhar um treino, pensando no próximo: vence
// assim que o exercício é feito de novo depois dele. Com horário nas séries
// (registradaEm, gravado desde 24/09/2026) compara o instante; sem, a data.
export function recadoValido(recado, ultimaSessaoAnterior) {
  if (!recado?.texto) return false;
  if (!ultimaSessaoAnterior) return true;
  const horarios = (ultimaSessaoAnterior.series ?? []).map((s) => s.registradaEm).filter(Number.isFinite);
  if (horarios.length > 0) return Date.parse(recado.escritoEm) > Math.max(...horarios);
  return String(recado.escritoEm).slice(0, 10) >= ultimaSessaoAnterior.data;
}

export function montarOrientacaoPersonal({ sugestao, cfg, totalSeries, prescricao = {}, aquecimento = [], recado = null }) {
  const itens = [];
  const potencia = Boolean(prescricao?.potencia);

  if (potencia) {
    itens.push({
      titulo: "Carga de hoje",
      destaque: sugestao?.carga > 0 ? kg(sugestao.carga) : null,
      texto: "Leve de propósito: aqui o que conta é a velocidade. Se todas saírem rápidas e fáceis, sobe um furo na próxima.",
    });
  } else {
    itens.push({
      titulo: "Carga de hoje",
      destaque: sugestao?.acao === "primeira_vez" || !(sugestao?.carga > 0) ? "Primeira vez" : kg(sugestao.carga),
      texto: sugestao?.motivo ?? "",
    });
  }

  const faixa = cfg.repsMin === cfg.repsMax ? `${cfg.repsMax}` : `${cfg.repsMin}–${cfg.repsMax}`;
  const textoSeries = potencia
    ? "Todas no máximo de velocidade. Se uma repetição sair lenta, a série acabou."
    : `Pare cada série com ${sobrando(cfg.rirAlvo)}. ${prescricao?.falhaNaUltimaSerie ? "Só a última vai até a falha." : "Nenhuma até a falha."}`;
  itens.push({ titulo: "Séries", destaque: `${totalSeries} × ${faixa}`, texto: textoSeries });

  if (aquecimento.length > 0) {
    itens.push({
      titulo: "Antes da 1ª série",
      destaque: null,
      texto: `Aquecimento: ${aquecimento.map((p) => `${kg(p.peso)} × ${p.reps}`).join(" → ")}. Ao registrar, marque "Foi aquecimento".`,
    });
  } else if (!potencia) {
    itens.push({
      titulo: "Antes da 1ª série",
      destaque: null,
      texto: "Use a 1ª série pra acertar a execução, com a mesma carga das outras: movimento inteiro, sem pressa.",
    });
  }

  const descanso = `Descanso de ${cfg.descansoSegundos} s entre as séries.`;
  itens.push({ titulo: "Ritmo", destaque: null, texto: prescricao?.tempo ? `${prescricao.tempo}. ${descanso}` : descanso });

  if (prescricao?.atencao) itens.push({ titulo: "Cuidado", destaque: null, texto: prescricao.atencao });

  const data = recado?.texto ? new Date(recado.escritoEm) : null;
  return {
    recado: recado?.texto
      ? { texto: recado.texto, data: `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}` }
      : null,
    itens,
  };
}
