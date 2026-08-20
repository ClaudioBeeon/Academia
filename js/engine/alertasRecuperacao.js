// js/engine/alertasRecuperacao.js
export function avaliarAlertasRecuperacao(checkinsRecentes) {
  const alertas = [];
  const maisRecente = checkinsRecentes[0];

  if (maisRecente?.dorArticularOuTendinea) {
    alertas.push({
      tipo: "dor_articular",
      mensagem: "Você reportou dor articular ou de tendão persistente no último check-in. Considere um deload ou avaliação profissional.",
      principio: "gatilhosDeloadReativo",
    });
  }

  if (maisRecente?.domsPersistente) {
    alertas.push({
      tipo: "doms_persistente",
      mensagem: "Dor muscular do treino anterior ainda presente. Pode ser sinal de recuperação insuficiente.",
      principio: "gatilhosDeloadReativo",
    });
  }

  const ultimosTres = checkinsRecentes.slice(0, 3);
  if (ultimosTres.length === 3 && ultimosTres.every((c) => c.bemEstarBaixo)) {
    alertas.push({
      tipo: "bem_estar_baixo_sustentado",
      mensagem: "Sono, motivação ou humor abaixo do ideal nos últimos 3 check-ins. Considere um deload reativo.",
      principio: "gatilhosDeloadReativo",
    });
  }

  const ultimosDois = checkinsRecentes.slice(0, 2);
  if (ultimosDois.length === 2 && ultimosDois.every((c) => c.qualidadePercebida <= 2)) {
    alertas.push({
      tipo: "qualidade_baixa_sequencia",
      mensagem: "As duas últimas sessões tiveram qualidade percebida baixa. Vale revisar sono, alimentação e volume de treino.",
      principio: "alertas",
    });
  }

  return alertas;
}
