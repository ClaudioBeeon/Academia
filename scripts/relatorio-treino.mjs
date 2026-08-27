// scripts/relatorio-treino.mjs
//
// Puxa o treino de uma data direto do Supabase (sem precisar exportar nada
// no app) e imprime um relatório em markdown — pensado pra rodar sob
// pedido ("olha o relatório de hoje") em vez de qualquer automação
// silenciosa. Reaproveita os mesmos motores determinísticos da tela de
// relatório do app (js/engine/sessao.js, js/engine/calorias.js), então os
// números batem com o que a pessoa viu no celular.
//
//   node scripts/relatorio-treino.mjs            # hoje
//   node scripts/relatorio-treino.mjs 2026-08-25 # uma data específica
import { clientAutenticado } from "./_supabaseSessao.mjs";
import { calcularEstatisticasSessao } from "../js/engine/sessao.js";
import { estimarCaloriasDaSessao } from "../js/engine/calorias.js";

function dataAlvo() {
  const arg = process.argv[2];
  if (arg) return arg;
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

async function buscarStore(client, storeName, { porCampo, porChave } = {}) {
  let query = client.from("sync_records").select("*").eq("store_name", storeName).eq("deleted", false);
  if (porCampo) query = query.eq(`data->>${porCampo.nome}`, porCampo.valor);
  if (porChave) query = query.eq("record_key", porChave);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao buscar ${storeName}: ${error.message}`);
  return data ?? [];
}

function formatarMinutos(minutos) {
  if (minutos == null) return "não estimável (só uma série sincronizada, ou nenhuma)";
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h > 0 ? `~${h}h${String(m).padStart(2, "0")}min` : `~${m}min`;
}

async function main() {
  const data = dataAlvo();
  const client = await clientAutenticado();

  const [historicoRows, cardioRows, observacaoRows, habitoRows, exerciciosRows, perfilRows] = await Promise.all([
    buscarStore(client, "historicoSeries", { porCampo: { nome: "data", valor: data } }),
    buscarStore(client, "registrosCardio", { porCampo: { nome: "data", valor: data } }),
    buscarStore(client, "observacoesTreino", { porChave: data }),
    buscarStore(client, "habitos", { porChave: data }),
    buscarStore(client, "exercicios"),
    buscarStore(client, "perfil", { porChave: "1.0" }),
  ]);

  const seriesDoDia = historicoRows.map((r) => r.data);
  const registrosCardioDoDia = cardioRows.map((r) => r.data);
  const nomePorExercicio = new Map(exerciciosRows.map((r) => [r.data.id, r.data.nome]));
  const pesoKg = perfilRows[0]?.data?.dadosBasicos?.peso_kg;
  const observacao = observacaoRows[0]?.data?.texto ?? null;
  const habito = habitoRows[0]?.data ?? null;

  if (seriesDoDia.length === 0 && registrosCardioDoDia.length === 0) {
    console.log(`# Relatório — ${data}\n\nNenhum treino sincronizado pra essa data ainda. Se acabou de treinar, abra o app uma vez (a sincronização roda ao voltar pro primeiro plano) e tente de novo.`);
    return;
  }

  const stats = calcularEstatisticasSessao(seriesDoDia);
  const calorias = pesoKg > 0 ? estimarCaloriasDaSessao({ totalSeries: stats.totalSeries, pesoKg, registrosCardioDoDia }) : null;

  // Duração é uma estimativa por proxy: intervalo entre o updated_at da
  // primeira e da última série sincronizada nesse dia — não é o
  // início/fim real da sessão (o app não grava isso, só a data — ver
  // comentário no topo de js/engine/calorias.js), mas costuma ficar perto,
  // já que a sincronização sobe cada série pouco depois de registrada.
  let duracaoMinutos = null;
  if (historicoRows.length >= 2) {
    const timestamps = historicoRows.map((r) => new Date(r.updated_at).getTime());
    duracaoMinutos = (Math.max(...timestamps) - Math.min(...timestamps)) / 60000;
  }

  const linhas = [];
  linhas.push(`# Relatório — ${data}`);
  linhas.push("");
  linhas.push(`**Duração estimada:** ${formatarMinutos(duracaoMinutos)} (proxy: intervalo entre a 1ª e a última série sincronizada — não é medição real)`);
  linhas.push(`**Séries:** ${stats.totalSeries} · **Volume total:** ${stats.volumeTotal} kg · **Exercícios:** ${stats.exerciciosTreinados}`);
  linhas.push(`**Músculos:** ${stats.musculosTreinados.join(", ") || "—"}`);
  if (calorias) linhas.push(`**Calorias (estimativa por MET):** musculação ${calorias.musculacao} kcal + cardio ${calorias.cardio} kcal = ${calorias.total} kcal`);
  linhas.push("");

  linhas.push("## Séries por exercício");
  const porExercicio = new Map();
  for (const s of seriesDoDia) {
    if (!porExercicio.has(s.exercicioId)) porExercicio.set(s.exercicioId, []);
    porExercicio.get(s.exercicioId).push(s);
  }
  for (const [exercicioId, series] of porExercicio) {
    const nome = nomePorExercicio.get(exercicioId) ?? exercicioId;
    linhas.push(`- **${nome}**: ${series
      .sort((a, b) => (a.serieNumero ?? 0) - (b.serieNumero ?? 0))
      .map((s) => `${s.carga}kg×${s.reps} (RIR ${s.rir}${s.tipoSerie === "aquecimento" ? ", aquecimento" : ""})`)
      .join(", ")}`);
  }
  linhas.push("");

  if (registrosCardioDoDia.length > 0) {
    linhas.push("## Cardio");
    for (const c of registrosCardioDoDia) {
      linhas.push(`- ${c.modalidade}, ${c.duracaoMinutos ?? "?"} min, intensidade percebida ${c.intensidadePercebida ?? "?"}/5`);
    }
    linhas.push("");
  }

  if (habito) {
    const partes = [];
    if (habito.sonoOntem) partes.push(`sono de ontem: ${habito.sonoOntem}`);
    if (habito.creatina != null) partes.push(`creatina: ${habito.creatina ? "sim" : "não"}`);
    if (habito.alcool != null) partes.push(`álcool: ${habito.alcool ? "sim" : "não"}`);
    if (partes.length > 0) {
      linhas.push("## Hábitos do dia");
      linhas.push(`- ${partes.join(" · ")}`);
      linhas.push("");
    }
  }

  linhas.push("## Observação registrada no app");
  linhas.push(observacao ?? "_Nenhuma observação registrada nessa data._");

  console.log(linhas.join("\n"));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
