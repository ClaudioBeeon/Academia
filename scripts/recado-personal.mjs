// scripts/recado-personal.mjs
//
// Escreve o recado do "personal" de um exercício direto no servidor — usado
// pela análise do treino (Claude) pra deixar a orientação da PRÓXIMA vez que
// o exercício for feito. O app baixa os recados ao abrir
// (js/data/recadosPersonal.js) e mostra na folha "Seu personal"; o recado
// vence sozinho quando o exercício é feito de novo (js/engine/personal.js).
// Usa a sessão salva por scripts/supabase-login.mjs — nunca pede senha.
//
//   node scripts/recado-personal.mjs <exercicioId> "texto do recado"
//   node scripts/recado-personal.mjs --listar
//   node scripts/recado-personal.mjs --apagar <exercicioId>
import { readFile } from "node:fs/promises";
import { clientAutenticado } from "./_supabaseSessao.mjs";

const STORE = "recadosPersonal";

async function idsDoCatalogo() {
  const catalogo = JSON.parse(await readFile(new URL("../data/exercicios.json", import.meta.url), "utf8"));
  return new Map(catalogo.exercicios.map((e) => [e.id, e.nome]));
}

async function main() {
  const [primeiro, segundo] = process.argv.slice(2);
  const client = await clientAutenticado();
  const { data: { user } } = await client.auth.getUser();
  const catalogo = await idsDoCatalogo();

  if (primeiro === "--listar") {
    const { data, error } = await client.from("sync_records").select("record_key,data,deleted").eq("user_id", user.id).eq("store_name", STORE);
    if (error) throw error;
    const ativos = data.filter((linha) => !linha.deleted);
    if (ativos.length === 0) console.log("Nenhum recado.");
    for (const linha of ativos) console.log(`${linha.data.escritoEm.slice(0, 10)}  ${catalogo.get(linha.record_key) ?? linha.record_key}\n    ${linha.data.texto}`);
    return;
  }

  const apagar = primeiro === "--apagar";
  const exercicioId = apagar ? segundo : primeiro;
  const texto = apagar ? null : segundo;
  if (!exercicioId || (!apagar && !texto?.trim())) {
    console.error('Uso: node scripts/recado-personal.mjs <exercicioId> "texto" | --listar | --apagar <exercicioId>');
    process.exit(1);
  }
  if (!catalogo.has(exercicioId)) {
    console.error(`Exercício "${exercicioId}" não existe em data/exercicios.json.`);
    process.exit(1);
  }

  const agora = new Date().toISOString();
  const { error } = await client.from("sync_records").upsert({
    user_id: user.id,
    store_name: STORE,
    record_key: exercicioId,
    deleted: apagar,
    data: apagar ? {} : { exercicioId, texto: texto.trim(), escritoEm: agora },
    storage_path: null,
    updated_at: agora,
  }, { onConflict: "user_id,store_name,record_key" });
  if (error) throw error;
  console.log(`${apagar ? "Apagado" : "Salvo"}: ${catalogo.get(exercicioId)}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
