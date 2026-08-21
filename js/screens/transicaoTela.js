// js/screens/transicaoTela.js
// Troca de tela ao estilo navegação do iOS: "avancar" empurra a tela nova
// da direita (como abrir um exercício), "voltar" traz a nova de volta pela
// esquerda (como fechar/voltar), "trocarAba" só faz um crossfade (troca de
// aba da barra inferior, sem sensação de hierarquia).
import { animarSpring } from "../lib/spring.js";

const DESLOCAMENTO_PX = 32;

export async function trocarConteudo(container, montarNovaTela, { direcao = "trocarAba" } = {}) {
  const atual = container.firstElementChild;
  const novaTela = await montarNovaTela();

  const saidaX = direcao === "avancar" ? -DESLOCAMENTO_PX * 0.4 : direcao === "voltar" ? DESLOCAMENTO_PX * 0.4 : 0;
  const entradaX = direcao === "avancar" ? DESLOCAMENTO_PX : direcao === "voltar" ? -DESLOCAMENTO_PX : 0;

  // Saída e entrada rodam em paralelo (como o push/pop do iOS) — pra isso, a
  // tela atual sai do fluxo normal (absolute) enquanto some, e a nova já
  // ocupa o espaço no fluxo desde já.
  if (atual) {
    const containerEstiloOriginal = container.style.position;
    if (!containerEstiloOriginal) container.style.position = "relative";
    atual.style.position = "absolute";
    atual.style.inset = "0";
    atual.style.pointerEvents = "none";
    animarSpring(atual, { x: 0, opacity: 1 }, { x: saidaX, opacity: 0 }, { rigidez: 420, amortecimento: 38 }).finalizado.then(() => {
      atual.remove();
      if (!containerEstiloOriginal) container.style.position = "";
    });
  }

  container.appendChild(novaTela);
  animarSpring(novaTela, { x: entradaX, opacity: 0 }, { x: 0, opacity: 1 });

  return novaTela;
}
