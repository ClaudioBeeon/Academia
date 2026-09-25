// js/engine/resumoSemana.js
//
// Resumo dos últimos 7 dias contra os 7 anteriores (card da tela Início):
// quantos treinos e séries, quais exercícios subiram de carga, recordes de
// carga da semana e quais músculos da ficha ficaram sem série direta.
// Motor puro — só conta o que foi registrado, nunca decide nada.
function somarDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ehTrabalho = (s) => !s.tipoSerie || s.tipoSerie === "normal";

export function resumirSemana({ todasAsSeries = [], catalogo = [], musculosDaFicha = [], hoje }) {
  const inicio = somarDias(hoje, -6);
  const inicioAnterior = somarDias(hoje, -13);
  const trabalho = todasAsSeries.filter(ehTrabalho);
  const semana = trabalho.filter((s) => s.data >= inicio && s.data <= hoje);
  const anterior = trabalho.filter((s) => s.data >= inicioAnterior && s.data < inicio);
  const nomePorId = new Map(catalogo.map((e) => [e.id, e]));

  const subiram = [];
  let recordes = 0;
  const exerciciosDaSemana = [...new Set(semana.map((s) => s.exercicioId))];
  for (const id of exerciciosDaSemana) {
    const maxSemana = Math.max(...semana.filter((s) => s.exercicioId === id).map((s) => s.carga ?? 0));
    const antes = trabalho.filter((s) => s.exercicioId === id && s.data < inicio);
    if (antes.length === 0 || !(maxSemana > 0)) continue;
    const ultimaData = antes.reduce((max, s) => (s.data > max ? s.data : max), antes[0].data);
    const maxUltimaSessao = Math.max(...antes.filter((s) => s.data === ultimaData).map((s) => s.carga ?? 0));
    const maxDeSempre = Math.max(...antes.map((s) => s.carga ?? 0));
    if (maxSemana > maxUltimaSessao) subiram.push({ nome: nomePorId.get(id)?.nome ?? id, de: maxUltimaSessao, para: maxSemana });
    if (maxSemana > maxDeSempre) recordes++;
  }

  const musculosTreinados = new Set(semana.map((s) => nomePorId.get(s.exercicioId)?.musculoPrimario ?? s.musculo));
  const semTreinoDireto = musculosDaFicha.filter((m) => !musculosTreinados.has(m));

  return {
    treinos: new Set(semana.map((s) => s.data)).size,
    treinosAnterior: new Set(anterior.map((s) => s.data)).size,
    series: semana.length,
    seriesAnterior: anterior.length,
    subiram: subiram.sort((a, b) => a.nome.localeCompare(b.nome)),
    recordes,
    semTreinoDireto,
  };
}
