import { getAll, put, clearStore } from "./db.js";

const STORES_EXPORTAVEIS = [
  "perfil", "protocolo", "ficha", "exercicios", "dietaBase",
  "historicoSeries", "medidasCorporais", "cargas", "registrosDiarios", "config", "habitos",
  "observacoesTreino",
];

export async function exportarTudo(db) {
  const dados = {};
  for (const nome of STORES_EXPORTAVEIS) {
    dados[nome] = await getAll(db, nome);
  }
  return { versao: "1.0", exportadoEm: new Date().toISOString(), dados };
}

export async function importarTudo(db, backup) {
  if (!backup || typeof backup !== "object" || !backup.dados || typeof backup.dados !== "object") {
    throw new Error("Arquivo de backup inválido.");
  }
  const storesValidas = STORES_EXPORTAVEIS.filter((nome) => Array.isArray(backup.dados[nome]));
  if (storesValidas.length === 0) {
    throw new Error("Arquivo de backup inválido.");
  }

  for (const nome of storesValidas) {
    await clearStore(db, nome);
    for (const registro of backup.dados[nome]) {
      await put(db, nome, registro);
    }
  }
  return { restaurado: true };
}

// Formata as observações livres do fim de sessão (js/data/observacoesTreino.js)
// como um único markdown, mais recente primeiro — pensado pra ser lido fora
// do app, com mais contexto de pesquisa/protocolo do que a IA embutida tem.
export function observacoesTreinoParaMarkdown(observacoes) {
  if (observacoes.length === 0) {
    return "# Observações de treino\n\nNenhuma observação registrada ainda.\n";
  }
  const secoes = observacoes.map((o) => `## ${o.data}\n\n${o.texto}\n`);
  return `# Observações de treino\n\n${secoes.join("\n")}`;
}

export function historicoParaCsv(historicoSeries) {
  const cabecalho = "data,exercicioId,musculo,tipoSerie,carga,reps,rir,serieNumero";
  const linhas = historicoSeries.map((s) =>
    [s.data, s.exercicioId, s.musculo, s.tipoSerie, s.carga, s.reps, s.rir, s.serieNumero ?? ""].join(",")
  );
  return [cabecalho, ...linhas].join("\n");
}
