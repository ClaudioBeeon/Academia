// js/data/postura.js
//
// Fotos de perfil pra acompanhar a correção postural (ombros e pescoço pra
// frente). Existe porque a auditoria de 2026-08-23 deixou a postura como
// prioridade declarada e o app não tinha NENHUMA forma de saber se o trabalho
// estava funcionando — 10,5 séries semanais de deltoide posterior sem nada que
// mostrasse resultado em 8 semanas.
//
// Guarda a imagem como Blob no IndexedDB, não como base64: Blob ocupa ~33% menos
// e não passa pelo custo de serializar string gigante a cada leitura. Nada sai
// do dispositivo — não há upload em lugar nenhum do app.

import { getAll, put, del } from "./db.js";

export async function getFotosPostura(db) {
  const todas = await getAll(db, "fotosPostura");
  return todas.sort((a, b) => a.data.localeCompare(b.data));
}

export function registrarFotoPostura(db, { data, blob, observacao = "" }) {
  return put(db, "fotosPostura", { data, blob, observacao });
}

export function excluirFotoPostura(db, id) {
  return del(db, "fotosPostura", id);
}

// Primeira e última foto — é a comparação que importa. Postura muda devagar:
// comparar com a semana passada não mostra nada, comparar com o começo mostra.
export function primeiraEUltima(fotos) {
  if (fotos.length === 0) return { primeira: null, ultima: null, semanasEntre: 0 };
  const primeira = fotos[0];
  const ultima = fotos.length > 1 ? fotos[fotos.length - 1] : null;
  const semanasEntre = ultima
    ? Math.round((new Date(`${ultima.data}T00:00:00`) - new Date(`${primeira.data}T00:00:00`)) / (7 * 86400000))
    : 0;
  return { primeira, ultima, semanasEntre };
}

// Sugere nova foto a cada 4 semanas. Mais frequente que isso é ruído: a
// literatura de exercício corretivo mede mudança em 6-8 semanas.
const SEMANAS_ENTRE_FOTOS = 4;

export function diasAteProximaFoto(fotos, hojeISO) {
  if (fotos.length === 0) return 0;
  const ultima = fotos[fotos.length - 1];
  const diasDesde = Math.floor(
    (new Date(`${hojeISO}T00:00:00`) - new Date(`${ultima.data}T00:00:00`)) / 86400000
  );
  return Math.max(0, SEMANAS_ENTRE_FOTOS * 7 - diasDesde);
}
