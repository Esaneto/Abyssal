# Abyssal v3.0.3 — movimento compartilhado e fallback online

## Correções desta versão

- Foi criado `public/enemy-ai.js`, um único algoritmo de perseguição utilizado pelo modo solo e pela simulação autoritativa do servidor online. Ambos usam o mesmo cálculo de direção, velocidade, fase e limites.
- O servidor online agora calcula movimento através desse módulo comum e envia `movingEnemyCount`, `tickCount` e timestamp nos snapshots para diagnóstico.
- O cliente suaviza as posições autoritativas por interpolação entre snapshots.
- Se o cliente detectar que vários snapshots consecutivos mantêm os monstros parados longe de qualquer mergulhador, ativa temporariamente o mesmo algoritmo local de perseguição do solo. Quando os snapshots voltam a demonstrar movimento real, o cliente sai do fallback e retoma a interpolação autoritativa.
- Os sprites, a vida, os surgimentos e as derrotas continuam recebendo estado do servidor; o fallback serve para evitar uma tela estática se a simulação de rede estiver parada.
- Os arquivos JS/CSS/Favicon usam cache bust `3.0.3` para evitar mistura entre versões antigas e novas.

## Instalação

1. Extraia o ZIP.
2. Copie os arquivos mantendo a estrutura `public/` e substituindo os equivalentes no repositório.
3. Execute `npm install` na raiz; inclua o `package-lock.json` atualizado no commit, se ele existir no repositório.
4. Faça commit/push na branch `main` do GitHub e aguarde o Render terminar o deploy.
5. Não altere a variável `DATABASE_URL` nem o grupo `abyss` do Render.

## Verificação

- `/health` deve mostrar `build: "3.0.3"`, `persistence: "postgres"` e `simulation.errors: 0`.
- Com uma sala ativa, `simulation.movingEnemies` deve ser maior que zero enquanto houver monstros se aproximando de jogadores.
- Teste com duas sessões reais na mesma sala. A simulação server-side é autoritativa; o fallback de cliente é uma proteção visual para snapshots sem movimento, e não substitui um diagnóstico do servidor se `simulation.errors` estiver aumentando.
