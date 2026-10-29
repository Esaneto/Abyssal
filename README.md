# Abyssal v3.3.0 — movimento cooperativo reconstruído

Esta versão ataca o problema de inimigos visualmente imóveis com duas camadas: simulação autoritativa no servidor e predição de apresentação no cliente usando a mesma IA compartilhada do modo solo.

## O que mudou

- `public/enemy-ai.js` é a regra comum de perseguição e órbita para o modo solo e o servidor. Os inimigos perseguem o jogador mais próximo, e as órbitas têm faixas distintas para não virarem uma massa imóvel no centro.
- `world-simulation.js` controla surgimento, relógio, movimento, vida e snapshots do cooperativo. Se uma criatura ativa produzir um passo de movimento zero por estado inválido ou regressão, há uma recuperação de movimento usando a mesma escolha de alvo e deslocamento em unidades do mundo.
- `public/enemy-netcode.js` reconcilia snapshots sem realimentar as posições visuais. O primeiro snapshot posiciona a criatura; os seguintes atualizam vida, tipo, cor e identidade, mas preservam o `x/y` local. Isso evita um bug onde o renderizador reaplicava o ponto de spawn em todo quadro.
- Tanto solo quanto cooperativo executam `AbyssalEnemyAI.moveTowardTarget` em cada atualização visual. O watchdog mede a qualidade do movimento autoritativo apenas para diagnóstico: ele nunca desliga a movimentação local. O servidor continua autoritativo sobre spawns, HP, mortes e recompensas.
- `public/online.js` envia a posição do jogador por pacote volátil a cada 80 ms. O pacote mais recente substitui o antigo; não existe bloqueio esperando um ACK antes de enviar outra posição. Isso segue o uso documentado de eventos voláteis do Socket.IO para dados de posição, nos quais a próxima amostra é mais útil que uma fila de amostras antigas.
- O servidor rejeita sequências de posição antigas, confirma recebimentos e mede a idade da posição mais antiga entre jogadores ativos no `/health`.
- O motor continua tendo autoridade sobre a criação/remoção de inimigos e dano/vida. A predição visual é contínua e não depende de snapshots de posição; os snapshots são usados para reconciliar os atributos autoritativos e retirar monstros derrotados.
- Quando não há jogadores, as salas vazias deixam de simular e o ticker global é desligado. O diretório de sala não guarda estado de partidas de maneira durável.
- O nome do boss vermelho é **Aberração Abissal**.

## Testar localmente

Node.js 18 ou superior:

```bash
npm install
npm test
npm start
```

Abra `http://localhost:3000`. Para testar o cooperativo, use duas sessões de navegador, autentique contas diferentes e entre na mesma sala. Os monstros devem surgir dos vórtices e continuar perseguindo o jogador mais próximo. Deixe o personagem parado: os monstros devem permanecer em movimento/órbita.

## Indicadores em produção

Durante uma partida online ativa, abra `/health`:

- `build` deve ser `3.3.0`.
- `clientReportedMovingEnemies` deve ser maior que zero durante uma partida se a IA visual local está avançando monstros.
- `clientPredictingPlayers` deve corresponder ao número de jogadores ativos que estão usando predição visual.
- `simulation.errors` deve ser `0`.
- `simulation.movingEnemies` deve ser maior que zero.
- `activePlayers` e `activeRooms` devem ser maiores que zero durante a partida.
- `latestPositionAgeMs` em cada sala ativa deve ficar baixo; `stalePositionPlayers` deve ser zero em condições normais.
- Se não há jogadores conectados, `activePlayers: 0`, `activeRooms: 0`, `totalEnemies: 0` e `worldTickerActive: false` são resultados esperados, e não evidência de falha de movimento.

## Render + Neon

Mantenha a variável `DATABASE_URL` existente. Não coloque a string de conexão no repositório e não remova o grupo de ambiente `abyss`. As contas e rankings continuam no PostgreSQL; salas e simulação em andamento ficam na memória da instância e terminam após um deploy/reinício. O jogo assume uma única instância Render porque os mundos e sessões Socket.IO são locais à instância.

## Observação técnica

Socket.IO usa eventos voláteis para dados que podem ser descartados se o transporte estiver ocupado — útil para posições — e os callbacks de confirmação são usados apenas como diagnóstico, nunca como trava do fluxo de posições. Browsers também podem reduzir `requestAnimationFrame` e timers em abas ocultas; por isso o servidor tem seu próprio tick e a predição visual não depende apenas do quadro de renderização para receber as amostras do servidor.

## Diagnóstico v3.3.0

A rota `/health` agrega `clientReportedEnemies`, `clientReportedMovingEnemies`, `clientPredictingPlayers` e `clientMotionAgeMs` por sala. Esses campos são amostras declaradas pelo cliente a cada heartbeat; servem para separar travamento visual local de travamento na simulação do servidor. Durante uma sala ativa, `latestPositionAgeMs` e `clientMotionAgeMs` devem permanecer baixos.


## Correções de combate — v3.3.0

- O servidor confirma cada impacto com vida restante e `damageRevision`; o cliente aplica a confirmação e ignora snapshots antigos que tentariam restaurar HP anterior.
- O endpoint `/health` mantém métricas para impactos aplicados/rejeitados, último motivo de rejeição e surgimento de bosses.
- O surgimento de boss acontece ao cruzar o prazo de 60 segundos; caso o spawn falhe por um estado inconsistente, o servidor tenta novamente em 3 segundos em vez de esperar mais um minuto.
- Bosses fora da tela recebem um marcador direcional com o título **ABERRAÇÃO ABISSAL** para o boss vermelho.
- As habilidades de combate e melhorias persistentes têm motivos sonoros sintetizados individualmente; os sons de habilidades contínuas usam intervalos específicos para evitar repetição excessiva.

### Diagnóstico de dano online
Durante a partida, confira `/health` → `simulation.combat`. `appliedHits` deve aumentar quando houver impactos aceitos. Se `rejectedHits` aumentar, `lastDamageReason` informa se o jogador não está numa sala, se a mensagem é inválida ou se o ID do inimigo já não existe.
