# Abyssal v3.1.1 — perseguição contínua e heartbeat de posição

Esta versão reestrutura a simulação de inimigos para o cooperativo reutilizar as mesmas regras de perseguição e estatísticas do modo solo.

## Alterações centrais

- `public/enemy-ai.js` é a fonte compartilhada do catálogo de criaturas, velocidade base, sorteio de inimigos, pontos de spawn/vórtices e movimento de perseguição.
- `world-simulation.js` controla a simulação autoritativa por sala: horda contínua, no máximo 50 criaturas (até 4 bosses), escolha do jogador mais próximo, velocidades/caminhos em unidades do mundo e snapshots.
- Coordenadas de jogador e inimigo agora são sempre unidades do mundo `3600 × 2200` (não normalizadas entre 0 e 1). Velocidade e interpolação também usam unidades do mundo por segundo. Isso remove a conversão duplicada que dificultava sincronizar movimento.
- O servidor inicia o loop de 20 ticks por segundo apenas enquanto houver pelo menos uma sala ocupada.
- Quando todos saem de uma sala criada, o objeto da sala e sua simulação/inimigos são descartados imediatamente e a linha correspondente é excluída do diretório PostgreSQL. A sala estática `MAR-ABERTO` fica disponível como entrada padrão, mas seu mundo é reiniciado e não simula quando vazia.
- Uma sala criada mas nunca ocupada expira em 30 segundos. O diretório PostgreSQL só contém salas ocupadas; listagens não enviam senha nem hash.
- Ao reiniciar/deployar o serviço, as linhas antigas do diretório de salas são apagadas porque sockets e simulações não sobrevivem ao processo. Contas, moedas e rankings ficam no `abyssal_state` e não são apagados.
- `/health` informa `build`, `world.engine`, `world.coordinateSystem`, `worldTickerActive`, `simulation.movingEnemies`, `simulation.errors`, `roomsPendingDeletion` e detalhes seguros por sala: contagem de inimigos, ticks, updates de posição recebidos e idade da última posição (sem nicknames, senhas ou IDs de conta).

## Instalar/testar

Requer Node.js 18 ou superior.

```bash
npm install
npm test
npm start
```

Abra `http://localhost:3000`. Para cooperativo, conecte duas sessões, autentique duas contas e entre na mesma sala. Os monstros devem aparecer nos vórtices e avançar em direção ao jogador mais próximo. Ao sair das duas sessões, `/health` deve mostrar `activeRooms: 0`, `activePlayers: 0`, `simulation.totalEnemies: 0` e `worldTickerActive: false`.

## Render + Neon

Mantenha a variável de ambiente `DATABASE_URL` existente no Render. Não coloque a connection string no repositório. O serviço é desenhado para uma única instância do Render, pois as sessões Socket.IO e os mundos autoritativos ficam no processo ativo. O diretório de salas usa PostgreSQL para publicação de metadados, mas não implementa replicação do motor de mundo entre várias instâncias.

## Propriedades da simulação

- Mundo fixo: 3600 × 2200 unidades.
- Spawns iniciais em três vórtices distintos; novos mobs continuam surgindo de pontos de corrente nas bordas.
- Cada tick move todas as criaturas em direção ao jogador online mais próximo usando `AbyssalEnemyAI.moveTowardTarget`, a mesma função do solo.
- O cliente envia a posição do jogador com heartbeat independente do loop de renderização (100 ms) e confirmação do servidor, mantendo apenas um pacote de posição em trânsito. Os snapshots de inimigos são enviados em intervalos voláteis para evitar filas de estados antigos.
- A simulação não avança se não houver jogadores; no servidor, o ticker é desligado quando todas as salas ficam vazias.

## Testes de backend

`npm test` executa os testes da IA compartilhada, da simulação, do ciclo de vida de salas e um teste dos handlers reais de `server.js` com adaptadores de transporte simulados. Este último verifica que uma segunda sessão vê e entra na sala, recebe snapshots com inimigos em movimento e que a sala/ticker são removidos quando os dois jogadores saem. O teste usa `DATA_DIR` temporário e não apaga os dados locais existentes.

## Segurança e persistência

As salas privadas ficam listadas apenas com metadados públicos (`isPrivate`); senhas e hashes não são transmitidos. A autenticação, moedas e rankings permanecem no PostgreSQL do Neon por meio da variável `DATABASE_URL`.


## Correções v3.1.1 — foco nos monstros parados online

- O cliente envia a posição do jogador por um heartbeat independente do loop de renderização (100 ms), consultando o estado atual do jogador diretamente.
- Há no máximo um pacote de posição confirmado em voo; isso evita acumular posições antigas em conexões lentas. O servidor responde com ACK e atualiza os contadores de diagnóstico.
- A IA compartilhada faz as criaturas continuarem circulando dentro do alcance de ataque depois de alcançar o jogador; elas não congelam quando chegam ao ponto de contato. Essa lógica vale tanto para o solo quanto para o cooperativo.
- O endpoint `/health` mostra o tempo desde a última posição do jogador e o contador de pacotes recebidos; o handler `player-position` confirma o recebimento por ACK.
- O nome em jogo do boss vermelho foi padronizado para **O Coração Partido**, igual ao alerta e ao catálogo.

### Verificação

Execute `npm test` e `npm start`. Durante uma partida online, `/health` deve reportar `build: "3.1.1"`, `simulation.errors: 0`, `movingEnemies` maior que zero e `latestPositionAgeMs` baixo (normalmente menos de 1.500 ms, dependendo da conexão). `positionUpdates` deve continuar aumentando mesmo se o ciclo visual estiver temporariamente reduzido.

O diretório de salas e as contas usam a configuração PostgreSQL já existente (`DATABASE_URL`). Não altere nem publique essa variável.
