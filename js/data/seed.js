import { get, put, putAll, getAll } from "./db.js";

const DATA_FILES = {
  perfil: "data/perfil.json",
  protocolo: "data/protocolo.json",
  exercicios: "data/exercicios.json",
  dieta: "data/dieta.json",
};

export async function seedIfNeeded(db, fetchImpl = globalThis.fetch) {
  const [perfil, protocolo, exercicios, dieta] = await Promise.all([
    fetchImpl(DATA_FILES.perfil).then((r) => r.json()),
    fetchImpl(DATA_FILES.protocolo).then((r) => r.json()),
    fetchImpl(DATA_FILES.exercicios).then((r) => r.json()),
    fetchImpl(DATA_FILES.dieta).then((r) => r.json()),
  ]);

  const currentConfig = await get(db, "config", "seedVersion");
  if (currentConfig && currentConfig.valor === protocolo.versao) {
    return { seeded: false };
  }

  await put(db, "perfil", perfil);
  await put(db, "protocolo", protocolo);
  await put(db, "dietaBase", dieta);
  const existentes = await getAll(db, "exercicios");
  const observacoesExistentes = new Map(existentes.map((e) => [e.id, e.observacoesExecucao]));
  const exerciciosMesclados = exercicios.exercicios.map((seedExercicio) => {
    const observacaoExistente = observacoesExistentes.get(seedExercicio.id);
    return observacaoExistente
      ? { ...seedExercicio, observacoesExecucao: observacaoExistente }
      : seedExercicio;
  });
  await putAll(db, "exercicios", exerciciosMesclados);
  await put(db, "config", { chave: "seedVersion", valor: protocolo.versao });

  return { seeded: true };
}
