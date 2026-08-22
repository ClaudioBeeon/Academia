// js/engine/lembretes.js
//
// Lógica pura de lembretes periódicos (adendo seção Sugestões, Parte 1):
// reavaliação de fase e fotos/medidas a cada 2 semanas. Nunca decide nada
// sozinho — só calcula quando é hora de avisar; a decisão real (trocar de
// fase, etc.) é sempre do usuário.

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const SEMANAS_SUGERIDAS_REAVALIACAO = 7; // meio da faixa 6-8 semanas
const DIAS_INTERVALO_FOTOS_MEDIDAS = 14;

function diferencaEmDias(dataIsoInicio, dataIsoFim) {
  const inicio = new Date(`${dataIsoInicio}T00:00:00`);
  const fim = new Date(`${dataIsoFim}T00:00:00`);
  return Math.round((fim - inicio) / MS_POR_DIA);
}

export function calcularDataReavaliacaoSugerida(dataInicioFase) {
  const data = new Date(`${dataInicioFase}T00:00:00`);
  data.setDate(data.getDate() + SEMANAS_SUGERIDAS_REAVALIACAO * 7);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function devePedirReavaliacaoFase(dataReavaliacao, hoje) {
  if (!dataReavaliacao) return false;
  return hoje >= dataReavaliacao;
}

export function deveLembrarFotosMedidas(ultimaDataRegistrada, hoje, diasIntervalo = DIAS_INTERVALO_FOTOS_MEDIDAS) {
  if (!ultimaDataRegistrada) return true;
  return diferencaEmDias(ultimaDataRegistrada, hoje) >= diasIntervalo;
}

// Usuário já usa creatina e só quer o lembrete diário até marcar — sem dose
// nem horário, só o check binário (adendo seção Sugestões, Parte 1).
export function deveLembrarCreatina(habitoHoje) {
  return habitoHoje?.creatina !== true;
}
