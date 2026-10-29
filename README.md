# Abyssal — v3.4.0

## Correções desta versão

- A simulação de inimigos, o relógio, o spawn e o dano por contato são executados no servidor Node.js, não no ciclo visual do navegador.
- O servidor mantém o último ponto validado do jogador enquanto a aba está minimizada; os inimigos continuam perseguindo e atacando esse ponto.
- O evento `player-vitals` agora é recebido pelo cliente e sincroniza vida, escudos, invulnerabilidade e fim de mergulho. Ao voltar à aba, o cliente solicita o estado atual do jogador e um snapshot do mundo.
- O cliente não aplica dano de contato nem regeneração local no cooperativo, evitando duplicação e valores de vida divergentes.
- Ao sair o último jogador, a sala personalizada é removida, a simulação para e o registro é excluído do diretório. Se todos os jogadores forem derrotados enquanto conectados, o ticker para e a horda é liberada. Uma nova partida reinicializa o mundo.
- Os ativos HTML/JS/CSS usam query string `v=3.4.0` para evitar clientes com código antigo em cache.

## Atualizar no Render

1. Copie os arquivos deste diretório para a raiz do repositório `Esaneto/Abyssal`, preservando a estrutura `public/`.
2. Execute `npm install` e `npm test`.
3. Inclua `package.json` e `package-lock.json` atualizado no commit, se usado no repositório.
4. Envie para a branch `main` e aguarde o Render ficar `Live`.
5. Não altere nem remova `DATABASE_URL` nem o grupo de ambiente `abyss`; a aplicação continua usando o PostgreSQL do Neon.

## Verificação

Durante uma partida ativa, abra `/health`. A versão deve mostrar `build: 3.4.0`, `backgroundSimulation: server-owned`, `worldTickerActive: true`, `simulation.errors: 0`, `movingEnemies` maior que zero e `latestPositionAgeMs` baixo enquanto o cliente envia posições.

Minimizar o navegador não pausa o loop do servidor. Se a conexão realmente se desconectar ou o usuário sair do mundo, o servidor remove esse jogador; quando o último jogador sai, a sala customizada é destruída e o ticker é desligado. O Render Free ainda pode suspender a instância após inatividade geral conforme as regras da plataforma.

## Testes

Execute `npm test`. Os testes cobrem o módulo de IA, netcode, som, simulação autoritativa, vida/dano no servidor, recebimento de estado e limpeza de salas sem jogadores.
