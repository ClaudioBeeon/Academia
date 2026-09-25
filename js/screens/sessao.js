// js/screens/sessao.js
import { getAll } from "../data/db.js";
import { getEquipamento } from "../data/equipamento.js";
import { excluirSeriesDoDia, getSeriesDoDia } from "../data/historico.js";
import {
  getSubstituicoesDoDia, salvarSubstituicao, getAdiamentosDoDia, adiarExercicio, aplicarAjustesSessaoDoDia,
  getPuladosDoDia, pularExercicioHoje, desfazerPuloHoje, getExtrasDoDia, adicionarExtraHoje,
  getSupersetsDoDia, criarSupersetHoje, desfazerSupersetHoje,
} from "../data/ajustesSessao.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { prepararSessaoDoDia } from "../engine/contextoSessao.js";
import { getFicha, getInicioDoBloco, definirInicioDoBloco } from "../data/ficha.js";
import { calcularSemanaDoBloco } from "../engine/fichaFixa.js";
import { avaliarEstadoDoTreino } from "../engine/estadoTreino.js";
import { musculosTreinadosRecentemente } from "../engine/recuperacaoMuscular.js";
import { getCheckinsRecentes } from "../data/checkin.js";
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

export async function montarFluxoSessao(db, { onVoltarParaHoje, onMinimizar, diaForcado } = {}) {
  const hoje = obterDataLocal();
  const modoPreview = diaForcado != null;
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const [todasAsSeries, ultimoDiaRegistrado, ficha, checkinsRecentes] = await Promise.all([
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getFicha(db),
    getCheckinsRecentes(db),
  ]);
  // Queda de desempenho segura a série extra das semanas 4–6 (a ficha pede
  // isso; antes nenhum alerta chegava até a montagem da sessão).
  const { fadigaDetectada } = avaliarEstadoDoTreino({ todasAsSeries, checkinsRecentes, hoje });

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
    todosExercicios, protocolo, todasAsSeries, hoje, diaInfo, ficha, semanaDoBloco, fadigaDetectada,
  });

  // Ciclo rotativo: o dia de hoje pode repetir músculo treinado ontem (ex.:
  // dia 5 → dia 1, peito nos dois). Só avisa na fila, nunca bloqueia.
  const musculosTreinadosHaPouco = modoPreview ? [] : musculosTreinadosRecentemente({
    todasAsSeries,
    catalogo: todosExercicios,
    hoje,
    musculosDeHoje: [...new Set(exerciciosBase.map((e) => e.musculoPrimario))],
  });

  // Substituição ("trocar exercício") e adiamento ("pular pra depois") só
  // valem pra hoje — nunca tocam a ficha. Recalculados sempre a partir de
  // `exerciciosBase` (nunca uns em cima dos outros) sempre que um dos dois
  // muda, senão substituir o substituto ou adiar duas vezes bagunçaria.
  let exerciciosHoje = exerciciosBase;
  async function recarregarAjustesDoDia() {
    const [substituicoes, adiamentos, seriesHoje, pulados, extras, supersets] = await Promise.all([
      getSubstituicoesDoDia(db, hoje),
      getAdiamentosDoDia(db, hoje),
      modoPreview ? [] : getSeriesDoDia(db, hoje),
      getPuladosDoDia(db, hoje),
      getExtrasDoDia(db, hoje),
      getSupersetsDoDia(db, hoje),
    ]);
    const exerciciosComSerieHoje = new Set(seriesHoje.map((s) => s.exercicioId));
    exerciciosHoje = aplicarAjustesSessaoDoDia(exerciciosBase, todosExercicios, substituicoes, adiamentos, exerciciosComSerieHoje, { pulados, extras, supersets });
  }
  if (!modoPreview) await recarregarAjustesDoDia();

  const root = document.createElement("div");
  let estadoAtual = "fila";
  let indiceExercicioAtual = 0;
  let explicacaoJaMostrada = false;
  // Descanso que a próxima tela de execução deve começar sozinha — usado no
  // superset (depois do exercício B, o descanso acontece já na tela do A).
  let descansoPendenteSegundos = 0;
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
        return montarTelaFila(db, { diaInfo, exerciciosHoje, hoje, diaDaFicha, ficha, semanaDoBloco, inicioSessaoTs, musculosTreinadosHaPouco, todosExercicios }, {
          onTreinoRapido: modoPreview ? null : async (ids) => {
            for (const id of ids) await pularExercicioHoje(db, hoje, id);
            await persistirDiaSeNecessario();
            await recarregarAjustesDoDia();
            await renderizar("trocarAba");
          },
          onAdicionarExtra: modoPreview ? null : async (id) => {
            await adicionarExtraHoje(db, hoje, id);
            await recarregarAjustesDoDia();
            await renderizar("trocarAba");
          },
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
          onDesfazerPulo: modoPreview ? null : async (exercicioId) => {
            await desfazerPuloHoje(db, hoje, exercicioId);
            await recarregarAjustesDoDia();
            await renderizar("trocarAba");
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
          semanaDoBloco,
          descansoInicialSegundos: (() => { const d = descansoPendenteSegundos; descansoPendenteSegundos = 0; return d; })(),
          outrosExerciciosHoje: exerciciosHoje.filter((e) => e.id !== exercicio.id && !e.puladoHoje).map((e) => ({ id: e.id, nome: e.nome })),
        }, {
          // Superset: vai direto pro par (sem descanso depois do A; com o
          // descanso do B já rodando na tela do A).
          onIrParaExercicio: async (exercicioId, { descansoSegundos = 0 } = {}) => {
            const indice = exerciciosHoje.findIndex((e) => e.id === exercicioId);
            if (indice < 0) return;
            indiceExercicioAtual = indice;
            descansoPendenteSegundos = descansoSegundos;
            await renderizar("avancar");
          },
          onCriarSuperset: async (outroId) => {
            const atualId = exerciciosHoje[indiceExercicioAtual].id;
            await criarSupersetHoje(db, hoje, atualId, outroId);
            await recarregarAjustesDoDia();
            indiceExercicioAtual = Math.max(0, exerciciosHoje.findIndex((e) => e.id === atualId));
            await renderizar("trocarAba");
          },
          onDesfazerSuperset: async () => {
            const atualId = exerciciosHoje[indiceExercicioAtual].id;
            await desfazerSupersetHoje(db, hoje, atualId);
            await recarregarAjustesDoDia();
            indiceExercicioAtual = Math.max(0, exerciciosHoje.findIndex((e) => e.id === atualId));
            await renderizar("trocarAba");
          },
          onFechar: async () => {
            estadoAtual = "fila";
            await renderizar("voltar");
          },
          onProximoExercicio: async () => {
            // Pula os marcados como "não vou fazer hoje".
            let proximo = indiceExercicioAtual + 1;
            while (proximo < exerciciosHoje.length && exerciciosHoje[proximo].puladoHoje) proximo++;
            if (proximo < exerciciosHoje.length) {
              indiceExercicioAtual = proximo;
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
          // "Não vou fazer hoje": marca só pra hoje e volta pra fila, que
          // já mostra o próximo pendente.
          onExercicioPulado: modoPreview ? null : async (exercicioId) => {
            await pularExercicioHoje(db, hoje, exercicioId);
            await persistirDiaSeNecessario();
            await recarregarAjustesDoDia();
            estadoAtual = "fila";
            await renderizar("voltar");
          },
          onSerieRegistrada: persistirDiaSeNecessario,
          onPrsDetectados: (prs) => { prsDaSessao.push(...prs); },
          onMinimizarSessao: onMinimizar,
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
      return montarTelaRelatorio(db, { hoje, prsDaSessao, inicioSessaoTs }, {
        onConcluir: onVoltarParaHoje,
      });
    }, { direcao });
  }

  await renderizar();
  return root;
}
