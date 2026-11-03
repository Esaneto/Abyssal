# Abyssal — v3.5.9

## Objetivo desta versão

Esta revisão prioriza a regra básica do cooperativo: todos os jogadores de uma sala veem as mesmas criaturas nas posições autoritativas do servidor, e dano por contato só acontece quando a simulação confirma uma colisão real.

- O servidor é a única fonte de verdade para existência, posição, vida, ataques, morte e orbes de XP dos inimigos.
- Pacotes de movimento são enviados a cada 100 ms (10 Hz). Snapshots completos confiáveis funcionam como ressincronização periódica a cada 30 s; eventos críticos (spawn, contato, dano, coleta e remoção) também são confiáveis e ordenados antes de seus eventos dependentes.
- O cliente interpola entre snapshots, não cria inimigos para representar dano e não executa uma segunda IA divergente no modo online.
- O dano por contato de jogadores visíveis exige amostra de posição recente, aplica uma predição curta da movimentação e usa uma margem conservadora no raio de colisão para evitar dano fantasma por coordenadas antigas. O atacante é incluído em snapshot crítico confiável antes do evento de vida.
- Para uma aba minimizada, a simulação segue usando a última posição conhecida. Ao retornar à aba, o cliente solicita um snapshot e as vitals atuais do servidor.
- A movimentação de monstros e a lógica de perseguição usam o mesmo módulo compartilhado do modo solo.
- O zoom móvel é 0,42, o zoom de PC 0,78 e o botão de menu é **MERGULHAR ONLINE**.
- O XP cooperativo é representado por orbes autoritativos; todos veem o mesmo orbe e somente o jogador escolhido pelo servidor recebe a XP.
- Ao sair o último jogador, a sala deixa de simular e seus dados de mundo são limpos.

## Atualizar no Render

1. Extraia o ZIP e copie os arquivos para a raiz do repositório `Esaneto/Abyssal`, preservando `public/` e `tests/`.
2. Na raiz, execute `npm install` e `npm test`.
3. Faça commit/push para a branch `main` e espere o Render ficar `Live`.
4. Não apague nem altere `DATABASE_URL` nem o grupo de ambiente `abyss`; esta atualização não cria outro banco.

## Verificar depois do deploy

Durante uma partida com pelo menos um jogador vivo, `/health` deve mostrar `build: 3.5.9`, `persistence: postgres`, `simulation.errors: 0`, `activePlayers > 0`, `worldTickerActive: true` e `movingEnemies > 0`. Em `activeRoomDetails`, `latestPositionAgeMs` deve ser baixo enquanto o cliente está visível e enviando posições. `/api/rooms` mostra as salas disponíveis.

Para validar o combate sem acionar dano fantasma, use duas sessões na mesma sala: mova um jogador enquanto o outro observa; as duas telas devem mostrar os mesmos IDs/posições autoritativas aproximadas, suavizadas pela interpolação. Espere uma criatura realmente encostar para confirmar o dano. Um evento de dano não deve criar nem reposicionar artificialmente uma criatura.

## Notas de rede e combate

- Pacotes de movimento usam frequência de 10 Hz e podem ser voláteis; snapshots completos e eventos críticos são confiáveis. As atualizações possuem `worldId` e `snapshotSeq`, para evitar que um pacote antigo reverta um mais novo. Os dados de posição do jogador são amostras voláteis de última posição; um pacote perdido não bloqueia o próximo.
- Antes de `player-vitals` por ataque, o servidor publica um snapshot crítico contendo a criatura atacante em sua coordenada real. Eventos por socket mantêm a ordem de emissão.
- O servidor registra `simulation.combat.lastPlayerHit`, com ID/tipo e geometria do contato, além da idade da posição do jogador. Para jogador visível, um heartbeat antigo demais faz o servidor pular o ataque em vez de usar uma coordenada ultrapassada; para uma aba explicitamente minimizada, a posição conhecida continua válida para o combate de fundo.
- O cliente só mostra efeitos na criatura que já existe no snapshot autoritativo. Não cria clones, não move o monstro para a posição do dano e não altera X/Y a partir do evento `player-vitals`.
- Ao entrar em uma sala já em andamento, o snapshot inicial sincroniza a quantidade de bosses derrotados, o ciclo atual, o progresso temporal da barra e a existência de um boss ativo.
- A Cadeia de Arcos tem alcance, dano máximo, recarga e limite de oito alvos validados no servidor, com a força de alcance limitada aos três aprimoramentos disponíveis.
- O limite de entidades mantém a carga previsível: até 400 inimigos totais na arena, com no máximo quatro bosses simultâneos.

## Validação

Execute `npm install` e `npm test`. Os testes automatizados cobrem perseguição do servidor, igualdade de coordenadas por sala, ordem snapshot→dano, snapshots antigos, colisão com coordenada recente, dano ao minimizar, orbes de XP e remoção de salas vazias. O teste de transporte é simulado; ele não substitui uma partida real no Render com dois navegadores. Se o problema aparecer após a publicação, consulte `/health` enquanto a partida estiver ativa e verifique `simulation.errors`, `movingEnemies`, `latestPositionAgeMs` e `simulation.combat.lastPlayerHit`.
