# App de Treino e Progressão — Design

Data: 2026-08-19
Status: aprovado pelo usuário em chat, seção por seção

## 1. Contexto e objetivo

App pessoal (uso exclusivo do usuário, não é produto), PWA instalável, publicado no
GitHub Pages, para acompanhamento de treino de musculação, progressão de carga,
nutrição e composição corporal. Toda a lógica de treino é derivada do documento
`/base-cientifica-hipertrofia-forca.md` (revisão de evidência científica) — nenhuma
regra de treino deve ser inventada fora desse documento.

O usuário é designer, não programador: não lê nem cola código. Toda edição de
arquivo é feita pelo assistente; explicações usam linguagem simples; comandos de
terminal vêm um por bloco.

## 2. Perfil do usuário (semente do `perfil.json`)

- Homem, 1,70 m, 71 kg, ~20% gordura corporal (único ponto de bioimpedância por
  enquanto — mais pontos entram conforme o usuário enviar novos exames)
- Cintura atual: ~62 cm (medido, ponto de partida — cadastrar como estimativa,
  métrica mais importante para o objetivo de gordura abdominal)
- **Fase atual:** `"definicao"` (déficit/manutenção; prioridade 1 = gordura
  abdominal, prioridade 2 = peito em volume de manutenção). Mudança de fase é
  sugerida a partir da tendência de bioimpedância ao longo do tempo, nunca
  automática nem por data fixa — sempre pede confirmação do usuário.
- Experiência: intermediário (1–3 anos de treino consistente) → volume/RIR
  iniciais conforme seção 15 da pesquisa (10–18 séries/semana, RIR 1–3)
- Disponibilidade: 5 dias/semana, ~45–60 min por sessão (mais nos fins de semana
  se necessário)
- Local de treino: academia completa (halteres, barras, máquinas, cabos/polias)
- Restrições físicas: nenhuma conhecida
- Preferência declarada: não gosta de pegar muito pesado — cargas moderadas,
  RIR-alvo do lado confortável da faixa (2 RIR como padrão, não 0)

## 3. Dieta base (semente do `dieta.json`)

Dieta já seguida quase todos os dias, baixa em carboidrato, concentrada em
proteína magra (intencional — não questionar isso na lógica do app):

| Refeição | Opções |
|---|---|
| Café da manhã | 2 bananas + 4 morangos médios |
| Almoço | 3 bifes de frango |
| Café da tarde | Opção A: whey — **ou** Opção B: 1 banana + 3 morangos |
| Janta | Opção A: 3 ovos cozidos — **ou** Opção B: omelete — **ou** Opção C: 1 pão + 2 ovos mexidos/fritos |

Requisito estrutural: uma refeição pode ter **múltiplas opções válidas**; o
usuário marca qual usou no dia em vez de o app presumir sempre a primeira.
Quantidades são aproximadas (sem peso exato) — estimar com base em porções
médias e sinalizar sempre como estimativa, nunca como valor exato.

**Checagem de adequação nutricional (3 eixos, ver seção 8 abaixo):** calorias
totais vs. meta, gordura (~0,5–1 g/kg/dia como piso razoável, essa dieta é muito
baixa nisso), fibra/variedade de micronutrientes (essa dieta não tem vegetais —
sinalizar como lacuna). O app só **sinaliza com explicação simples do porquê**,
nunca reescreve a dieta nem prescreve substituições — sempre recomenda conversar
com nutricionista para ajustes reais. Estimativa própria do usuário: essa dieta
fica entre ~1.100–1.400 kcal/dia, provavelmente bem abaixo da manutenção — é
esperado que a checagem dispare aviso assim que o cálculo for implementado.

## 4. Repositório

- GitHub: `https://github.com/ClaudioBeeon/Academia` (remote já conectado,
  branch `main` rastreando `origin/main`)
- Existe uma subpasta `Academia/Academia` com outro clone git do mesmo repo,
  aparentemente criada por engano — **não mexer nela sem confirmação explícita
  do usuário**, é dado dele até segunda ordem.

## 5. Arquitetura técnica (Abordagem A — aprovada)

Vanilla JS puro, módulos ES nativos (`<script type="module">`), **sem etapa de
build**, sem framework de UI. Deploy no GitHub Pages é publicar a pasta
diretamente — sem CI, sem bundler, sem hashes de build.

- IndexedDB acessado via lib `idb` (vendorizada localmente como arquivo único,
  nunca via CDN — precisa funcionar offline).
- Nenhuma dependência de rede em tempo de execução, exceto chamadas explícitas
  à API do Gemini (camada de IA, opcional).

## 6. Estrutura de arquivos

```
/index.html
/manifest.json
/sw.js
/css/
/js/
  /engine/          ← motor de domínio puro (ver seção 7)
    progressao.js
    volume.js
    rir.js
    deload.js
    cargas.js
    nutricao.js
  /screens/          ← uma tela = um módulo (ver seção 8)
  /data/             ← acesso a IndexedDB (via idb) + import/export JSON
  /ai/               ← camada de IA, isolada (ver seção 9)
  /vendor/idb.js
/docs/
  base-cientifica-hipertrofia-forca.md
  superpowers/specs/ ← specs de design (este arquivo)
/data/
  perfil.json
  protocolo.json
  exercicios.json
  dieta.json
/CHANGELOG-PROTOCOLO.md
/.gitignore          ← inclui .env e qualquer arquivo de chave
```

Arquivos em `/data/` são **template/estrutura inicial**: na primeira abertura,
o app lê esses JSONs e semeia o IndexedDB. Depois disso, o IndexedDB é a fonte
viva dos dados de uso (histórico, amostras de carga, registros diários). Os
arquivos em `/data/` só mudam quando o usuário pede uma atualização de regra
(ex.: novo resultado de bioimpedância, novo estudo) — nunca automaticamente
pelo uso do app. Mudanças em `protocolo.json` sobem a `versao` e são registradas
em `CHANGELOG-PROTOCOLO.md` com o motivo. Histórico de treino nunca é
reescrito — só o protocolo evolui.

## 7. Motor de domínio (`/js/engine/`)

Módulos puros: recebem dados (histórico, protocolo, perfil) e devolvem decisões
+ o princípio/seção da pesquisa que as justifica (ex.:
`{ decisao: "+2 séries peito", principio: "P1", secao: "22.4" }`). Nunca tocam
DOM nem IndexedDB diretamente — chamados pela camada de dados/UI, nunca o
inverso. Isso os torna testáveis isoladamente.

- `progressao.js` — progressão dupla (regra 22.3)
- `volume.js` — volume semanal fracionado (1,0 direto / 0,5 indireto) vs.
  faixa-alvo (22.2, 22.4, P1)
- `rir.js` — validação cruzada de RIR declarado (22.5)
- `deload.js` — gatilhos reativos de deload (seção 14, 22.4, P12)
- `cargas.js` — memória de esforço por exercício + sugestão por semelhança
  para exercícios novos (estrutura do `cargas.json` descrita no prompt
  original)
- `substituicao.js` — botão "Substituir hoje" na tela de registro: filtra
  `exercicios.json` por mesmo músculo primário + mesmo padrão de movimento e
  retorna 2–3 alternativas **instantaneamente, sem IA, funciona offline**. É
  a base sempre disponível; a IA (`sugerirSubstituicaoExercicio`, seção 9)
  é só um complemento opcional que adiciona explicação em texto quando
  online — o botão nunca espera a IA para funcionar.
- `nutricao.js` — Mifflin-St Jeor, meta adaptativa por tendência de peso
  (média móvel), os 3 eixos de checagem da seção 3 acima, piso calórico de
  segurança

## 8. Camada de UI / PWA

- Uma tela = um módulo em `/js/screens/`, renderiza a si mesma. Sem componente
  genérico reutilizável — desnecessário para o tamanho do app.
- Navegação por **abas fixas na parte inferior**: Treino / Divisão / Evolução /
  Dieta / Config. Sem router de URL.
- `sw.js`: app shell com lista explícita de arquivos (HTML/CSS/JS/ícones),
  estratégia network-falling-back-to-cache. Dados reais vivem no IndexedDB, não
  em rede.
- `manifest.json`: ícones, `display: standalone`, orientação portrait.
- Wake Lock API no cronômetro de descanso, com fallback silencioso se não
  suportado. Sem tentativa de manter contador rodando em tela bloqueada/
  notificação no iOS (limitação de plataforma, não vale o esforço).
- Construção **por níveis** (1 → 2 → 3, conforme prompt original), cada nível
  mostrado funcionando antes de avançar para o próximo.
- **Protótipos visuais:** quando a estrutura de abas/telas estiver definida
  (antes de implementar de verdade), **avisar o usuário e esperar ele mandar
  referências visuais de estilo** (apps/telas que ele gosta) antes de gerar
  qualquer protótipo. Só depois disso, gerar **3 protótipos mobile estáticos**
  (HTML/CSS, sem lógica funcional) usando os skills `hallmark`/`impeccable`,
  para o usuário escolher o estilo visual antes da implementação real — evita
  gastar tokens implementando 3 versões funcionais completas.

## 9. Camada de IA (`/js/ai/`)

- Provedor: **Google Gemini** (gratuito, multimodal — lê texto e imagem).
- Isolada em `/js/ai/`, nunca importada pelo `/js/engine/`. Só a UI chama a IA,
  sempre depois que o motor determinístico já decidiu tudo. IA nunca decide
  séries, carga, RIR, deload ou meta calórica.
- Chave de API colada na tela de Configurações, salva só em `localStorage`,
  nunca em arquivo nem commitada. `.env` e afins no `.gitignore` desde o
  primeiro commit.
- Funções isoladas por caso de uso, todas com fallback gracioso (offline/sem
  chave/erro → estado "IA indisponível agora", nunca tela quebrada):
  - `interpretarComida(textoOuImagem)` — aceita texto livre OU foto (Gemini
    multimodal), sempre mostra o que entendeu para o usuário confirmar antes
    de salvar; confirmado vira alimento pessoal resolvido localmente depois,
    sem nova chamada de IA
  - `explicarRevisaoSemanal(numerosEDecisoes)` — só transforma números/decisões
    já tomadas pelo motor em texto legível, não decide nada
  - `sugerirSubstituicaoExercicio(exercicio, motivo)` — complemento opcional
    ao botão determinístico "Substituir hoje" (ver `substituicao.js`, seção
    7): adiciona explicação em texto de por que a alternativa é parecida,
    quando online. Nunca é pré-requisito para a substituição funcionar.
  - `responderPerguntaHistorico(pergunta, dados)` — sempre citando números
    reais, nunca inventando
  - `ajudarCadastro(entradaLivre)` — ex.: estruturar dieta a partir de foto/texto
  - `explicarExecucao(exercicio)` — ao clicar num exercício, gera dicas de
    execução (amplitude, posição do braço, controle na fase de volta/
    negativa, erros comuns) a partir dos dados do exercício
    (`exercicios.json`). Gerado **uma vez por exercício e salvo no
    IndexedDB** atrelado a ele — cliques seguintes são instantâneos, sem nova
    chamada de API, e funcionam offline após a primeira geração.

## 10. Testes e tratamento de erros

- Motor de domínio (`/js/engine/`) é puro → testável isoladamente com testes
  simples em JS (sem framework pesado), cobrindo principalmente progressão,
  volume e validação de RIR.
- Erros de IA nunca derrubam a tela — sempre um estado visível "IA indisponível
  agora".
- Erros/perda de dados do IndexedDB (ex.: iOS limpando por inatividade) →
  aviso claro sugerindo importar o último backup JSON, nunca erro técnico cru.
- Antes de marcar qualquer nível como pronto: testar de verdade no navegador
  (preview), caminho principal e casos de borda — não confiar só na leitura do
  código.

## 11. Guarda-corpos obrigatórios (do prompt original, reafirmados aqui)

- Nunca exigir progressão de carga a cada sessão
- Nunca tratar dor muscular como métrica de sucesso
- Nunca prometer perda de gordura localizada
- Nunca aceitar déficit calórico abaixo do piso de segurança sem aviso
- Nunca tratar RIR declarado como exato (sempre validação cruzada 22.5)
- Nunca aumentar volume no teto da faixa sem progresso — sugerir revisão de
  exercícios/sono/alimentação em vez disso
- IA nunca decide séries/carga/RIR/deload/meta calórica, nunca altera
  `protocolo.json` sozinha

## 12. Ordem de construção

1. `perfil.json`, `protocolo.json`, `exercicios.json`, `dieta.json` — mostrar em
   texto legível para o usuário conferir antes de programar telas
2. 3 protótipos visuais mobile estáticos → usuário aprova um estilo
3. Nível 1 completo e funcionando → mostrar, esperar retorno
4. Nível 2 completo e funcionando → mostrar, esperar retorno
5. Nível 3 completo e funcionando → mostrar, esperar retorno
6. Camada de IA (Gemini) ligada aos pontos de uso definidos

## 13. Itens em aberto (não bloqueiam o início, decidir quando chegar lá)

- Ícones do `manifest.json` (gerar placeholder simples, usuário troca depois)
- Modelo exato do Gemini a usar (ex.: `gemini-2.5-flash` vs. outro) — decidir na
  etapa de implementação da camada de IA, considerando custo/limite gratuito
