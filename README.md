# Abyssal — v3.4.2

## Objetivos desta versão

- O mundo cooperativo tem uma única fonte de verdade: o servidor cria, move, ataca, recebe dano e remove as mesmas entidades que todos os clientes recebem por snapshots. Nenhum navegador simula outra cópia dos inimigos.
- O evento que confirma um ataque nunca cria nem teletransporta monstros. Ele apenas destaca o inimigo existente; posições e existência continuam vindo dos snapshots autoritativos.
- O zoom do celular foi afastado de 0,52 para 0,42; PC permanece em 0,78. As unidades do mapa são compartilhadas e a câmera segue o personagem.
- O botão do menu foi renomeado para **MERGULHAR ONLINE**. Os query strings de HTML/CSS/JS usam `v=3.4.2` para invalidar cache antigo.
- O XP usa orbes: em solo, o cliente cria e coleta o orbe; no cooperativo, o servidor cria e move os mesmos orbes que todos veem e escolhe um único jogador para recebê-lo. O valor e o raio dependem da força do inimigo; bosses deixam orbes com muito mais XP e maior tamanho.
- No cooperativo, todos os clientes recebem a mesma posição autoritativa de cada orbe e o mesmo evento de remoção. Somente o jogador que o servidor determinar como coletor recebe `shared-xp-award`.

## Atualizar no Render

1. Extraia o ZIP e copie os arquivos para a raiz do repositório `Esaneto/Abyssal`, preservando `public/` e `tests/`.
2. Na raiz, execute `npm install` e `npm test`.
3. Faça commit/push para a branch `main` e espere o Render ficar `Live`.
4. Não apague nem altere `DATABASE_URL` nem o grupo de ambiente `abyss`; esta atualização não cria outro banco.

## Verificar

Durante uma partida online, `/health` deve mostrar `build: 3.4.2`, `persistence: postgres`, `simulation.errors: 0`, `activePlayers > 0` e `movingEnemies > 0`. `/api/rooms` mostra as salas disponíveis. Para testar XP em duas sessões, derrote um monstro, confirme que ambas veem o mesmo orbe se movendo, depois recolha-o com apenas um jogador: o orbe deve desaparecer para os dois e somente o coletor deve evoluir.

## Comportamento de XP

O servidor atribui a coleta de orbes do cooperativo por posição real dos jogadores no tick de simulação. Se dois jogadores estiverem no raio no mesmo tick, vence o mais próximo, com desempate determinístico por ID. Isso impede que o mesmo orbe dê XP a vários jogadores. Orbes expiram após 25 segundos e têm uma quantidade limitada para conter o uso de memória.

Os testes locais não substituem a validação final no Render com duas conexões reais. O servidor continua autoritativo sobre o mundo; a interpolação do cliente apenas suaviza a renderização e não altera os valores reais de X/Y usados para colisão.
