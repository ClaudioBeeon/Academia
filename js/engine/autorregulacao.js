// js/engine/autorregulacao.js
//
// Cruza hábitos diários (sono, álcool, creatina) com os alertas de
// desempenho já existentes, pra apontar a causa mais provável antes de
// assumir déficit calórico (adendo seção Sugestões, Parte 2). Nunca decide
// nada sozinho — só explica, sempre com base nos dados registrados.
// Sono e álcool são apontados antes de déficit por serem mais fáceis de
// corrigir rápido, sem precisar reavaliar a dieta toda.

const DIAS_JANELA_PADRAO = 3;
const DIAS_SEM_CREATINA_PARA_MENCIONAR = 3;

export function apontarCausaProvavelDesempenho({ habitosRecentes = [], houveDeficitConsistente = false } = {}) {
  const janela = habitosRecentes.slice(0, DIAS_JANELA_PADRAO);

  if (janela.some((h) => h.sonoOntem === "ruim")) {
    return {
      causa: "sono",
      mensagem: "Sono ruim nos últimos dias é o fator mais provável — antes de mexer em volume ou dieta, vale priorizar recuperar o sono.",
    };
  }

  if (janela.some((h) => h.alcool)) {
    return {
      causa: "alcool",
      mensagem: "Consumo de álcool recente reduz síntese proteica nas 24h seguintes — provável fator, antes de mexer em volume ou dieta.",
    };
  }

  if (houveDeficitConsistente) {
    return {
      causa: "deficit",
      mensagem: "Déficit calórico consistente é o motivo mais provável — não é falta de esforço, é o corpo com menos energia disponível pra recuperar.",
    };
  }

  return null;
}

// Só se aplica a estagnação de força (efeito da creatina é mais sobre
// desempenho/força que estética) — nunca à hipertrofia em si, e sempre como
// fator auxiliar, sem exagerar a importância.
export function avaliarFatorCreatina({ habitosRecentes = [], estagnacaoForca = false } = {}) {
  if (!estagnacaoForca) return null;
  const diasSemCreatina = habitosRecentes.filter((h) => h.creatina === false).length;
  if (diasSemCreatina < DIAS_SEM_CREATINA_PARA_MENCIONAR) return null;

  return {
    causa: "creatina",
    mensagem: "Vários dias sem creatina registrada podem estar contribuindo pra estagnação de força — é um fator auxiliar, não determinante.",
  };
}
