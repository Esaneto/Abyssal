# Abyssal — regras de engenharia do projeto

## Diagnóstico confirmado
- Jogo arcade 2D de sobrevivência/shooter com renderização Canvas 2D em JavaScript.
- Runtime web servido por Node.js 18+, Express e Socket.IO; dependências via npm.
- Modo solo e multiplayer online. O servidor é autoridade para estado de mundo, inimigos, dano e orbes online.
- Simulação compartilhada em `world-simulation.js`; IA e geometria de tentáculos em `public/enemy-ai.js`; rede em `public/online.js` e `public/enemy-netcode.js`; gameplay e render em `public/game.js`.
- Testes usam `node --test`, incluindo `tests/` e `test/`.

## Princípios de arquitetura
1. Preserve o runtime existente. Não migre engine, bundler ou dependências sem uma tarefa explícita.
2. Separe estado, simulação, apresentação e transporte. Nunca trate o cliente como autoridade de combate no modo online.
3. Compartilhe regras de gameplay entre solo e online sempre que a arquitetura atual permitir; não crie uma segunda implementação divergente da IA.
4. Use funções pequenas e nomes explícitos. Não introduza abstrações genéricas para uma única chamada.
5. Respeite o idioma atual da UI (português brasileiro) e mantenha controles acessíveis por teclado, toque e mouse.
6. Não altere variáveis de ambiente, `DATABASE_URL`, o grupo Render `abyss` ou dados persistentes sem autorização explícita.

## Agent routing
- Balanceamento, progressão, sensação de tiro ou economia → `game-designer-balancer.md`.
- Mecânicas, inputs, colisão, inimigos, skills ou rede → `gameplay-developer.md`.
- Sprites, áudio, efeitos, CSS, Canvas e performance de render → `asset-pipeline-specialist.md`.
- Regressões, bugs, testes, travamentos e validação de deploy → `game-qa-debugger.md`.
- Tarefas transversais: planeje com Game Designer, implemente com Gameplay Developer e exija QA antes de integrar.

## Performance
- O loop principal deve evitar criar arrays, objetos, closures, strings de chave e conjuntos temporários por entidade a cada frame. Prefira reutilizar buffers e estruturas já existentes.
- Evite filtros CSS pesados, sombras grandes por partícula e múltiplos loops globais sobre todos os inimigos; reutilize o grid de colisão espacial quando aplicável.
- Limite partículas, projéteis, inimigos, efeitos e animações de menu. Honre `prefers-reduced-motion` e o modo de renderização de baixo desempenho.
- Use `dt` com limites defensivos em simulações; não permita que uma pausa de aba provoque teleporte ou rajadas de dano.
- Não adicione bibliotecas para efeitos que podem ser feitos com Canvas/CSS existentes sem benefício medido.

## Rede e segurança
- Online: servidor decide posição/vida/dano/spawn/XP; cliente envia intenção/inputs e apresenta snapshots interpolados.
- Não permita que resgates, moedas ou compras sejam considerados seguros apenas por validação client-side se forem usados como economia persistente competitiva. Documente limites de localStorage.
- Eventos Socket.IO devem ser validados, limitados e compatíveis com clientes existentes.
- Nunca logue tokens, senhas ou dados sensíveis.

## Testes obrigatórios
1. Faça alterações pequenas e escreva testes de regressão para bugs corrigidos.
2. Execute `npm test` (Node 20 recomendado) e verifique sintaxe dos arquivos alterados.
3. Teste modos solo e online, desktop e mobile, quando a mecânica afetar ambos.
4. Para performance, compare contagens de entidades, alocações evidentes, uso de CPU e comportamento com bosses/efeitos simultâneos.
5. Nunca declare que um deploy está Live sem consultar o estado do deploy. Se não puder executar localmente, declare claramente a limitação.
6. Use branch de feature e PR; não altere `main` diretamente.

## Definition of Done
- Código implementado e revisão de diff concluída.
- Testes relevantes passam; falhas preexistentes são identificadas separadamente.
- UI responsiva e controles acessíveis.
- Solo/online não divergem indevidamente.
- Deploy verificado ou estado pendente comunicado com honestidade.
