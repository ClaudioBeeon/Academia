// js/screens/cardsAcompanhamento.js
//
// Cards de acompanhamento do treino: "Sinais do treino" (alertas de queda de
// desempenho, estagnação, recuperação e sugestão de deload) e "Resumo da
// semana". Ficavam na tela Início e foram pra aba Treinos (01/10/2026, a
// pedido do dono): a Início é pra começar o treino do dia; acompanhar a
// semana é leitura de outra hora.
import { SEMANA_DELOAD } from "../engine/fichaFixa.js";

// Resumo dos últimos 7 dias contra os 7 anteriores. Fechado por padrão —
// é leitura de acompanhamento, não algo pra agir na hora.
const NOME_MUSCULO_CURTO = {
  peito: "peito", costas: "costas", biceps: "bíceps", triceps: "tríceps", ombro: "ombro lateral",
  deltoide_posterior: "deltoide posterior", quadriceps: "quadríceps", posterior_coxa: "posterior de coxa",
  gluteo: "glúteo", panturrilha: "panturrilha", abdomen: "abdômen", antebraco: "antebraço", ombro_anterior: "ombro anterior",
};

export function montarCardResumoSemana(resumo) {
  if (resumo.treinos === 0 && resumo.treinosAnterior === 0) return null;
  const kg = (v) => String(v).replace(".", ",");
  const card = document.createElement("details");
  card.className = "exercise-card resumo-semana-card";
  card.innerHTML = `
    <summary class="exercise-head"><div><div class="exercise-name">Resumo da semana</div><div class="exercise-meta"></div></div></summary>
    <div class="resumo-semana-corpo" style="padding:0 18px 18px;"></div>
  `;
  card.querySelector(".exercise-meta").textContent =
    `${resumo.treinos} treino${resumo.treinos === 1 ? "" : "s"} · ${resumo.series} séries (semana anterior: ${resumo.treinosAnterior} · ${resumo.seriesAnterior})`;
  const corpo = card.querySelector(".resumo-semana-corpo");
  const linha = (texto) => {
    const p = document.createElement("p");
    p.className = "prev-hint";
    p.style.padding = "0 0 8px";
    p.textContent = texto;
    corpo.appendChild(p);
  };
  if (resumo.subiram.length > 0) {
    linha(`Subiu de carga: ${resumo.subiram.map((x) => `${x.nome} (${kg(x.de)} → ${kg(x.para)} kg)`).join(", ")}.`);
  } else {
    linha("Nenhuma carga subiu nesta semana — normal em semanas de ganhar repetição.");
  }
  if (resumo.recordes > 0) linha(`Recorde de carga em ${resumo.recordes} exercício${resumo.recordes === 1 ? "" : "s"}.`);
  if (resumo.semTreinoDireto.length > 0) {
    linha(`Sem série direta nos últimos 7 dias: ${resumo.semTreinoDireto.map((m) => NOME_MUSCULO_CURTO[m] ?? m).join(", ")}.`);
  }
  return card;
}

// Alertas do treino (auditoria 2026-09-24): os motores de queda de
// desempenho, estagnação e recuperação existiam mas nenhuma tela mostrava.
// Só aparece quando há algo a dizer. Nunca aplica nada sozinho — o deload
// antecipado só acontece se a pessoa confirmar.
export function montarCardAlertasTreino(estado, todosExercicios, semanaDoBloco, aoIniciarDeload) {
  const nomePorId = new Map(todosExercicios.map((e) => [e.id, e.nome]));
  const linhas = [];
  for (const a of estado.alertasDesempenho) linhas.push(`${nomePorId.get(a.exercicioId) ?? a.exercicioId}: ${a.mensagem}`);
  for (const a of estado.alertasVolume) {
    if (a.tipo === "sem_progressao_exercicio") linhas.push(`${nomePorId.get(a.exercicioId) ?? a.exercicioId}: ${a.mensagem}`);
  }
  for (const a of estado.alertasRecuperacao) linhas.push(a.mensagem);
  if (estado.causaProvavel) linhas.push(estado.causaProvavel.mensagem);
  const sugerirDeload = estado.sugestaoDeload.sugerir && semanaDoBloco !== SEMANA_DELOAD;
  if (linhas.length === 0 && !sugerirDeload) return null;

  const card = document.createElement("section");
  card.className = "exercise-card card-alertas-treino";
  card.innerHTML = `
    <div class="exercise-head">
      <div>
        <div class="exercise-name">Sinais do treino</div>
        <div class="exercise-meta"></div>
      </div>
    </div>
    <div class="alertas-corpo" style="padding:0 18px 18px;"></div>
  `;
  card.querySelector(".exercise-meta").textContent = sugerirDeload
    ? `Sugestão de deload: ${estado.sugestaoDeload.motivos.join(", ")}`
    : `${linhas.length} ponto${linhas.length === 1 ? "" : "s"} de atenção`;
  const corpo = card.querySelector(".alertas-corpo");
  for (const texto of linhas.slice(0, 5)) {
    const p = document.createElement("p");
    p.className = "prev-hint";
    p.style.padding = "0 0 8px";
    p.textContent = texto;
    corpo.appendChild(p);
  }
  if (estado.fadigaDetectada && semanaDoBloco >= 4 && semanaDoBloco < SEMANA_DELOAD) {
    const p = document.createElement("p");
    p.className = "prev-hint";
    p.style.padding = "0 0 8px";
    p.textContent = "Por causa da queda de desempenho, a série extra de peito e bíceps desta semana foi suspensa.";
    corpo.appendChild(p);
  }
  if (sugerirDeload) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "swap-pill";
    botao.style.width = "100%";
    botao.textContent = "Fazer deload agora";
    botao.addEventListener("click", aoIniciarDeload);
    corpo.appendChild(botao);
  }
  return card;
}
