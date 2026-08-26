// js/screens/transicaoTela.js
// Troca de tela ao estilo navegação do iOS: "avancar" empurra a tela nova
// da direita (como abrir um exercício), "voltar" traz a nova de volta pela
// esquerda (como fechar/voltar), "trocarAba" só faz um crossfade (troca de
// aba da barra inferior, sem sensação de hierarquia).
import { animarSpring } from "../lib/spring.js";

const DESLOCAMENTO_PX = 32;

export async function trocarConteudo(container, montarNovaTela, { direcao = "trocarAba" } = {}) {
  const atual = container.firstElementChild;
  // Qualquer nó que não seja um elemento (texto solto, por exemplo) nunca é
  // animado nem removido pela lógica abaixo — limpa isso aqui pra não
  // acumular lixo no container a cada troca de tela.
  for (const no of [...container.childNodes]) {
    if (no !== atual) no.remove();
  }
  const novaTela = await montarNovaTela();

  const saidaX = direcao === "avancar" ? -DESLOCAMENTO_PX * 0.4 : direcao === "voltar" ? DESLOCAMENTO_PX * 0.4 : 0;
  const entradaX = direcao === "avancar" ? DESLOCAMENTO_PX : direcao === "voltar" ? -DESLOCAMENTO_PX : 0;

  // Saída e entrada rodam em paralelo (como o push/pop do iOS) — pra isso, a
  // tela atual sai do fluxo normal (absolute) enquanto some, e a nova já
  // ocupa o espaço no fluxo desde já.
  if (atual) {
    const containerEstiloOriginal = container.style.position;
    if (!containerEstiloOriginal) container.style.position = "relative";

    // Mede a posição/tamanho ANTES de anexar a tela nova — algumas telas
    // (fila/execução/cardio) mudam o padding do container e escondem a
    // barra de abas assim que entram no DOM, via `body:has()`, e isso
    // acontece na hora, antes de qualquer animação começar. Se a tela que
    // está saindo continuasse presa com `inset:0` (relativo ao container),
    // esse padding mudando por baixo dela faria ela pular de tamanho no
    // mesmo instante — o "pisca antes de deslizar" que se via na troca pra
    // fila. Fixar a caixa em pixels, medida antes da mudança, deixa a tela
    // que está saindo imune ao que acontece com o container depois dela.
    const retangulo = atual.getBoundingClientRect();
    const retanguloContainer = container.getBoundingClientRect();
    atual.style.position = "absolute";
    atual.style.top = `${retangulo.top - retanguloContainer.top}px`;
    atual.style.left = `${retangulo.left - retanguloContainer.left}px`;
    atual.style.width = `${retangulo.width}px`;
    atual.style.height = `${retangulo.height}px`;
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
