// js/engine/medidas.js
export function prepararSerieTemporal(linhas, campo) {
  return linhas
    .filter((linha) => linha[campo] != null)
    .map((linha) => ({ data: linha.data, valor: linha[campo] }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
