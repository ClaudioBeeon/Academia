import { getAll, put, clearStore } from "./db.js";

const STORES_EXPORTAVEIS = [
  "perfil", "protocolo", "exercicios", "dietaBase",
  "historicoSeries", "cargas", "registrosDiarios", "config",
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
  for (const nome of STORES_EXPORTAVEIS) {
    const registros = backup.dados[nome];
    if (!Array.isArray(registros)) continue;
    await clearStore(db, nome);
    for (const registro of registros) {
      await put(db, nome, registro);
    }
  }
  return { restaurado: true };
}

export function historicoParaCsv(historicoSeries) {
  const cabecalho = "data,exercicioId,musculo,tipoSerie,carga,reps,rir,serieNumero";
  const linhas = historicoSeries.map((s) =>
    [s.data, s.exercicioId, s.musculo, s.tipoSerie, s.carga, s.reps, s.rir, s.serieNumero ?? ""].join(",")
  );
  return [cabecalho, ...linhas].join("\n");
}
