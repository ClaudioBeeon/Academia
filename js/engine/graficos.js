// js/engine/graficos.js
function estimativa1RM(serie) {
  return serie.carga * (1 + serie.reps / 30);
}

export function calcularProgressao1RM(seriesDoExercicio) {
  const porDia = new Map();
  for (const serie of seriesDoExercicio) {
    if (serie.tipoSerie === "aquecimento") continue;
    const valor = estimativa1RM(serie);
    const atual = porDia.get(serie.data);
    if (atual === undefined || valor > atual) {
      porDia.set(serie.data, valor);
    }
  }
  return [...porDia.entries()]
    .map(([data, carga1RM]) => ({ data, carga1RM }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function semanaISO(dataStr) {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const diaSemana = (data.getUTCDay() + 6) % 7; // segunda=0 ... domingo=6
  data.setUTCDate(data.getUTCDate() - diaSemana + 3); // quinta-feira da mesma semana ISO
  const primeiraQuinta = new Date(Date.UTC(data.getUTCFullYear(), 0, 4));
  const diffDias = (data - primeiraQuinta) / 86400000;
  const numeroSemana = 1 + Math.round(diffDias / 7);
  return `${data.getUTCFullYear()}-W${String(numeroSemana).padStart(2, "0")}`;
}

export function calcularVolumeSemanalPorMusculo(todasAsSeries, semanas = 8) {
  const porSemanaEMusculo = new Map();
  const semanasOrdenadas = new Set();

  for (const serie of todasAsSeries) {
    if (serie.tipoSerie === "aquecimento") continue;
    const semana = semanaISO(serie.data);
    semanasOrdenadas.add(semana);
    const chave = `${semana}|${serie.musculo}`;
    porSemanaEMusculo.set(chave, (porSemanaEMusculo.get(chave) ?? 0) + (serie.contribuicao ?? 0));
  }

  const ultimasSemanas = [...semanasOrdenadas].sort().slice(-semanas);
  const ultimasSemanasSet = new Set(ultimasSemanas);

  const resultado = {};
  for (const [chave, volume] of porSemanaEMusculo.entries()) {
    const [semana, musculo] = chave.split("|");
    if (!ultimasSemanasSet.has(semana)) continue;
    if (!resultado[musculo]) resultado[musculo] = [];
    resultado[musculo].push({ semana, volume });
  }

  for (const lista of Object.values(resultado)) {
    lista.sort((a, b) => a.semana.localeCompare(b.semana));
  }

  return resultado;
}
