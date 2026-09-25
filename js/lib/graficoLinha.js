// js/lib/graficoLinha.js
//
// Gráfico de linha simples em SVG (evolução de carga, medidas, testes de
// vôlei). Recebe [{ data: "AAAA-MM-DD", valor }] em ordem cronológica.
function formatarDataCurta(dataIso) {
  const [, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}`;
}

export function criarSvgLinha(pontos) {
  const largura = 320;
  const altura = 140;
  const margem = 24;

  const valores = pontos.map((p) => p.valor);
  const minValor = Math.min(...valores);
  const maxValor = Math.max(...valores);
  const faixa = maxValor - minValor || 1;
  const folga = faixa * 0.1;
  const min = minValor - folga;
  const max = maxValor + folga;

  const escalaX = (i) => margem + (i / Math.max(pontos.length - 1, 1)) * (largura - margem * 2);
  const escalaY = (valor) => altura - margem - ((valor - min) / (max - min)) * (altura - margem * 2);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${largura} ${altura + 20}`);
  svg.setAttribute("width", "100%");
  svg.style.display = "block";

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute(
    "points",
    pontos.map((p, i) => `${escalaX(i)},${escalaY(p.valor)}`).join(" ")
  );
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "var(--accent)");
  polyline.setAttribute("stroke-width", "2");
  svg.appendChild(polyline);

  pontos.forEach((p, i) => {
    const circulo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circulo.setAttribute("cx", escalaX(i));
    circulo.setAttribute("cy", escalaY(p.valor));
    circulo.setAttribute("r", "3");
    circulo.setAttribute("fill", "var(--accent)");
    svg.appendChild(circulo);
  });

  // Com poucos pontos a linha some (1 ponto) ou quase não diz nada (2-4) — o
  // valor precisa aparecer escrito, senão sobra só uma bolinha sem
  // significado nenhum (era o caso do peso/1RM com um único registro).
  if (pontos.length <= 4) {
    pontos.forEach((p, i) => {
      const valorLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      valorLabel.setAttribute("x", escalaX(i));
      valorLabel.setAttribute("y", escalaY(p.valor) - 8);
      valorLabel.setAttribute("font-size", "11");
      valorLabel.setAttribute("font-weight", "700");
      valorLabel.setAttribute("fill", "var(--ink)");
      valorLabel.setAttribute("text-anchor", "middle");
      valorLabel.textContent = Number.isInteger(p.valor) ? p.valor : p.valor.toFixed(1);
      svg.appendChild(valorLabel);
    });
  }

  const passoRotulo = Math.max(1, Math.ceil(pontos.length / 6));
  pontos.forEach((p, i) => {
    if (i % passoRotulo !== 0 && i !== pontos.length - 1) return;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", escalaX(i));
    label.setAttribute("y", altura + 14);
    label.setAttribute("font-size", "9");
    label.setAttribute("fill", "var(--ink-faint)");
    label.setAttribute("text-anchor", "middle");
    label.textContent = formatarDataCurta(p.data);
    svg.appendChild(label);
  });

  return svg;
}
