// js/screens/sessao.js
import { getAll } from "../data/db.js";
import { getEquipamento } from "../data/equipamento.js";
import { excluirSeriesDoDia, getSeriesDoDia } from "../data/historico.js";
import { getSubstituicoesDoDia, salvarSubstituicao, getAdiamentosDoDia, adiarExercicio, aplicarAjustesSessaoDoDia } from "../data/ajustesSessao.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { prepararSessaoDoDia } from "../engine/contextoSessao.js";
import { getFicha, getInicioDoBloco, definirInicioDoBloco } from "../data/ficha.js";
import { calcularSemanaDoBloco } from "../engine/fichaFixa.js";
import { montarTelaFila } from "./fila.js";
import { montarTelaExecucao } from "./execucao.js";
import { montarTelaRelatorio } from "./relatorio.js";
import { montarTelaCardio } from "./cardioTimer.js";
import { abrirPromptCardio } from "./cardioPrompt.js";
import { getCardioDoDia } from "../data/cardio.js";
import { trocarConteudo } from "./transicaoTela.js";

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarFluxoSessao(db, { onVoltarParaHoje, diaForcado } = {}) {
  const hoje = obterDataLocal();
  const modoPreview = diaForcado != null;
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const [todasAsSeries, ultimoDiaRegistrado, ficha] = await Promise.all([
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getFicha(db),
  ]);

  // O bloco começa no primeiro treino aberto e a partir daí a semana do
  // mesociclo é derivada da data — o usuário não precisa marcar nada.
  let inicioDoBloco = await getInicioDoBloco(db);
  if (!inicioDoBloco && !modoPreview) {
    inicioDoBloco = hoje;
    await definirInicioDoBloco(db, hoje);
  }
  const semanaDoBloco = calcularSemanaDoBloco(inicioDoBloco, hoje);

  // No modo preview (abrindo o card de um dia futuro pra só olhar/testar a
  // fila), a sessão nunca grava o ponteiro de rotação — abrir ou até
  // registrar séries aqui não pode mudar qual dia é "hoje" pro app.
  const diaDaSessao = modoPreview ? diaForcado : determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  let diaPersistido = modoPreview || Boolean(ultimoDiaRegistrado && ultimoDiaRegistrado.data === hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);

  const { exerciciosHoje: exerciciosBase, diaDaFicha } = prepararSessaoDoDia({
    todosExercicios, protocolo, todasAsSeries, hoje, diaInfo, ficha, semanaDoBloco,
  });

  // Substituição ("trocar exercício") e adiamento ("pular pra depois") só
  // valem pra hoje — nunca tocam a ficha. Recalculados sempre a partir de
  // `exerciciosBase` (nunca uns em cima dos outros) sempre que um dos dois
  // muda, senão substituir o substituto ou adiar duas vezes bagunçaria.
  let exerciciosHoje = exerciciosBase;
  async function recarregarAjustesDoDia() {
    const [substituicoes, adiamentos, seriesHoje] = await Promise.all([
      getSubstituicoesDoDia(db, hoje),
      getAdiamentosDoDia(db, hoje),
      modoPreview ? [] : getSeriesDoDia(db, hoje),
    ]);
    const exerciciosComSerieHoje = new Set(seriesHoje.map((s) => s.exercicioId));
    exerciciosHoje = aplicarAjustesSessaoDoDia(exerciciosBase, todosExercicios, substituicoes, adiamentos, exerciciosComSerieHoje);
  }
  if (!modoPreview) await recarregarAjustesDoDia();

  const root = document.createElement("div");
  let estadoAtual = "fila";
  let indiceExercicioAtual = 0;
  let explicacaoJaMostrada = false;
  let telaAtual = null;
  const prsDaSessao = [];
  // Sessão de verdade (não preview): o cronômetro da fila conta a partir
  // daqui e continua atravessando exercícios e cardio até o relatório.
  const inicioSessaoTs = modoPreview ? null : Date.now();

  const persistirDiaSeNecessario = async () => {
    if (!diaPersistido) {
      await registrarDiaDaSessao(db, diaDaSessao, hoje);
      diaPersistido = true;
    }
  };

  // Único portão de saída da sessão pro relatório. Terminar o último
  // exercício e "Concluir sessão" na fila caem os dois aqui — nenhum dos
  // dois pode pular direto pro relatório quando existe cardio prescrito
  // pra hoje e ainda não registrado.
  async function irParaRelatorioOuPerguntarCardio() {
    const cardioDeHoje = modoPreview ? null : diaDaFicha?.cardio;
    if (cardioDeHoje) {
      const jaFeito = (await getCardioDoDia(db, hoje)).length > 0;
      if (!jaFeito) {
        const escolha = await abrirPromptCardio(cardioDeHoje);
        if (escolha === "agora") {
          estadoAtual = "cardio";
          await renderizar("avancar");
          return;
        }
      }
    }
    estadoAtual = "relatorio";
    await renderizar("avancar");
  }

  async function renderizar(direcao = "trocarAba") {
    if (telaAtual && telaAtual._dispose) {
      telaAtual._dispose();
    }

    telaAtual = await trocarConteudo(root, async () => {
      if (estadoAtual === "fila") {
        return montarTelaFila(db, { diaInfo, exerciciosHoje, hoje, diaDaFicha, ficha, semanaDoBloco, inicioSessaoTs }, {
          onExecutar: async (indice) => {
            indiceExercicioAtual = indice;
            estadoAtual = "execucao";
            await renderizar("avancar");
          },
          onFinalizarSessao: irParaRelatorioOuPerguntarCardio,
          onVoltar: onVoltarParaHoje,
          onPular: modoPreview ? null : async () => {
            await registrarDiaDaSessao(db, diaDaSessao, hoje, true);
            if (onVoltarParaHoje) onVoltarParaHoje();
          },
          onReiniciar: async () => {
            await excluirSeriesDoDia(db, exerciciosHoje.map((e) => e.id), hoje);
            await renderizar("trocarAba");
          },
        });
      }

      if (estadoAtual === "execucao") {
        const exercicio = exerciciosHoje[indiceExercicioAtual];
        const mostrarExplicacaoAberta = !explicacaoJaMostrada && Boolean(exercicio.observacoesExecucao);
        if (exercicio.observacoesExecucao) {
          explicacaoJaMostrada = true;
        }
        return montarTelaExecucao(db, {
          exercicio,
          indice: indiceExercicioAtual + 1,
          total: exerciciosHoje.length,
          todosExercicios,
          idsExerciciosHoje: exerciciosHoje.map((e) => e.id),
          protocolo,
          equipamento,
          hoje,
          mostrarExplicacaoAberta,
        }, {
          onFechar: async () => {
            estadoAtual = "fila";
            await renderizar("voltar");
          },
          onProximoExercicio: async () => {
            if (indiceExercicioAtual < exerciciosHoje.length - 1) {
              indiceExercicioAtual++;
              await renderizar("avancar");
            } else {
              await irParaRelatorioOuPerguntarCardio();
            }
          },
          // "Trocar exercício": salva a troca (só hoje) e recarrega no
          // mesmo lugar da fila — o substituto assume o índice de quem
          // saiu, com a mesma prescrição/séries-alvo.
          onExercicioSubstituido: async (exercicioAtualId, novoExercicioId) => {
            await salvarSubstituicao(db, hoje, exercicioAtualId, novoExercicioId);
            await recarregarAjustesDoDia();
            await renderizar("trocarAba");
          },
          // "Pular pra depois": o exercício vai pro fim da fila de hoje —
          // como ele sai do índice atual, o que era o próximo assume esse
          // mesmo índice, então só recarregar e continuar em "execução" já
          // mostra ele.
          onExercicioAdiado: async (exercicioId) => {
            await adiarExercicio(db, hoje, exercicioId);
            await recarregarAjustesDoDia();
            if (indiceExercicioAtual >= exerciciosHoje.length) indiceExercicioAtual = Math.max(0, exerciciosHoje.length - 1);
            await renderizar("avancar");
          },
          onSerieRegistrada: persistirDiaSeNecessario,
          onPrsDetectados: (prs) => { prsDaSessao.push(...prs); },
        });
      }

      if (estadoAtual === "cardio") {
        const cardioDeHoje = diaDaFicha.cardio;
        return montarTelaCardio(db, {
          hoje,
          modalidade: cardioDeHoje.modalidade,
          duracaoMin: cardioDeHoje.duracaoMin,
          aoVoltar: async () => {
            // Volta pra fila em vez de forçar o relatório — a pessoa pode
            // ter desistido de fazer agora, não necessariamente concluído.
            estadoAtual = "fila";
            await renderizar("voltar");
          },
          aoConcluir: async () => {
            estadoAtual = "relatorio";
            await renderizar("avancar");
          },
        });
      }

      if (!modoPreview) {
        await registrarDiaDaSessao(db, diaDaSessao, hoje, true);
        diaPersistido = true;
      }
      return montarTelaRelatorio(db, { hoje, prsDaSessao }, {
        onConcluir: onVoltarParaHoje,
      });
    }, { direcao });
  }

  await renderizar();
  return root;
}
