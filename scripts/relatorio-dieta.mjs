// scripts/relatorio-dieta.mjs
//
// Puxa a dieta dos últimos N dias direto do Supabase e imprime um relatório
// em markdown comparando o que foi comido com a meta calórica/proteica —
// mesmos motores determinísticos da tela Dieta do app (js/engine/nutricao.js,
// js/data/dieta.js), então os números batem com o que a pessoa viu no
// celular. Pensado pra rodar sob pedido, não como automação silenciosa.
//
//   node scripts/relatorio-dieta.mjs        # últimos 4 dias
//   node scripts/relatorio-dieta.mjs 7      # últimos 7 dias
import { clientAutenticado } from "./_supabaseSessao.mjs";
import { calcularTotalDoDia } from "../js/data/dieta.js";
import { calcularTMB, calcularMetaCalorica, calcularMetaProteina } from "../js/engine/nutricao.js";

function ultimosNDias(n) {
  const datas = [];
  const agora = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(agora);
    d.setDate(d.getDate() - i);
    datas.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return datas.reverse();
}

async function buscarStore(client, storeName, { porChave } = {}) {
  let query = client.from("sync_records").select("*").eq("store_name", storeName).eq("deleted", false);
  if (porChave) query = query.eq("record_key", porChave);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao buscar ${storeName}: ${error.message}`);
  return data ?? [];
}

async function main() {
  const n = Number(process.argv[2]) || 4;
  const datas = ultimosNDias(n);
  const client = await clientAutenticado();

  const [perfilRows, dietaBaseRows, registrosRows] = await Promise.all([
    buscarStore(client, "perfil", { porChave: "1.0" }),
    buscarStore(client, "dietaBase", { porChave: "1.0" }),
    buscarStore(client, "registrosDiarios"),
  ]);

  const perfil = perfilRows[0]?.data;
  const dietaBase = dietaBaseRows[0]?.data;
  if (!perfil || !dietaBase) {
    console.log("Perfil ou dieta base ainda não sincronizados — abra o app uma vez conectado e tente de novo.");
    return;
  }

  const { sexo, peso_kg: pesoKg, altura_cm: alturaCm, idade } = perfil.dadosBasicos ?? {};
  const fase = perfil.fase?.atual ?? "definicao";
  const tmb = calcularTMB({ sexo, pesoKg, alturaCm, idade });
  const metaCalorica = tmb ? calcularMetaCalorica({ tmb, fase }) : null;
  const metaProteina = pesoKg ? calcularMetaProteina({ pesoKg, fase }) : null;

  const registroPorData = new Map(registrosRows.map((r) => [r.record_key, r.data]));
  const alimentosPessoais = dietaBase.listaAlimentosPessoal ?? [];

  const linhas = [];
  linhas.push(`# Dieta — últimos ${n} dias`);
  linhas.push("");
  if (metaCalorica && metaProteina) {
    linhas.push(`**Meta calórica:** ${metaCalorica.meta_kcal} kcal (piso de segurança: ${metaCalorica.piso_kcal} kcal)${metaCalorica.emCalibracao ? " — ainda em calibração" : ""}`);
    linhas.push(`**Meta de proteína:** ${metaProteina.min_g}–${metaProteina.max_g}g · **Fase:** ${fase}`);
  } else {
    linhas.push("_Não foi possível calcular a meta (faltam dados básicos no perfil, como idade)._");
  }
  linhas.push("");
  linhas.push("| Data | kcal | % da meta | Proteína | Carbo | Gordura | Refeições marcadas |");
  linhas.push("|---|---|---|---|---|---|---|");

  for (const data of datas) {
    const registro = registroPorData.get(data);
    const selecoes = registro?.refeicoes ?? {};
    const { total, detalhePorRefeicao } = calcularTotalDoDia(dietaBase, selecoes, data);
    const marcadas = detalhePorRefeicao.filter((d) => d.confirmada);
    const temExtra = alimentosPessoais.some((a) => a.adicionadoEm === data);
    const semRegistro = marcadas.length === 0 && !temExtra;

    if (semRegistro) {
      linhas.push(`| ${data} | — | — | — | — | — | nenhuma |`);
      continue;
    }

    const pctMeta = metaCalorica?.meta_kcal > 0 ? Math.round((total.kcal / metaCalorica.meta_kcal) * 100) : null;
    linhas.push(
      `| ${data} | ${Math.round(total.kcal)} | ${pctMeta != null ? pctMeta + "%" : "—"} | ${Math.round(total.proteina_g)}g | ${Math.round(total.carboidrato_g)}g | ${total.gordura_g.toFixed(1)}g | ${marcadas.map((d) => d.nome).join(", ") || "—"}${temExtra ? " + extra" : ""} |`
    );
  }
  linhas.push("");

  console.log(linhas.join("\n"));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
