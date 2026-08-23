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

// --- Pausas posturais no expediente ---
//
// O usuário trabalha 9h-18h em frente ao computador e treina 18h30. Oito horas
// sentado por dia é o principal motor de ombros e pescoço pra frente — pesa
// mais que as 4 sessões semanais de deltoide posterior, porque é o que o corpo
// pratica a maior parte do tempo. Estas funções calculam os horários; nada aqui
// dispara nada sozinho.
//
// Honestidade sobre a limitação: um PWA não acorda sozinho pra notificar com o
// app fechado (limitação real, ver js/lib/notificacoes.js). Isto funciona como
// plano do dia e contador — não como alarme confiável em segundo plano.

function paraMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function paraHHMM(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function planejarPausasPosturais({
  inicio = "09:00",
  fim = "18:00",
  intervaloMinutos = 90,
  almocoInicio = "12:00",
  almocoFim = "13:00",
} = {}) {
  const fimMin = paraMinutos(fim);
  const almocoIni = paraMinutos(almocoInicio);
  const almocoF = paraMinutos(almocoFim);
  const horarios = [];

  for (let t = paraMinutos(inicio) + intervaloMinutos; t < fimMin; t += intervaloMinutos) {
    // Durante o almoço não faz sentido lembrar — ele já saiu da cadeira, que é
    // metade do objetivo da pausa.
    if (t >= almocoIni && t < almocoF) continue;
    horarios.push(paraHHMM(t));
  }
  return horarios;
}

export function proximaPausaPostural(horarios, agoraHHMM) {
  const agora = paraMinutos(agoraHHMM);
  return horarios.find((h) => paraMinutos(h) > agora) ?? null;
}

export function pausasPendentes(horarios, agoraHHMM, feitas = 0) {
  const agora = paraMinutos(agoraHHMM);
  const jaVencidas = horarios.filter((h) => paraMinutos(h) <= agora).length;
  return Math.max(0, jaVencidas - feitas);
}
