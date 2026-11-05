# ABYSSAL - CONTINUIDADE PARA O PROXIMO AGENTE

Atualizado em: 2026-11-05

Este arquivo e a fonte de continuidade tecnica do projeto. Leia antes de modificar gameplay, multiplayer, mapa, criaturas, skins, bosses, deploy ou fluxo de publicacao.

## 1. Objetivo do projeto

Abyssal e um jogo HTML5/JavaScript com Node.js + Socket.IO, multiplayer em tempo real, deploy no Render e empacotamento Android.

A prioridade geral e:
1. gameplay responsivo e sem sensacao de input lag;
2. servidor autoritativo sem sacrificar a resposta visual local;
3. exploracao que prenda o jogador por risco, curiosidade, progressao e descida;
4. identidade visual e criaturas coerentes com o oceano e o abismo;
5. estabilidade suficiente para publicacao e operacao real.

## 2. Regra de produto para criaturas

Direcao obrigatoria para novas criaturas, monstros, elites, skins e bosses:

- Priorizar fauna marinha abissal real ou fortemente inspirada nela.
- Quando as boas referencias abissais naturais se esgotarem, expandir para fauna marinha de outras zonas, incluindo mesopelagica, batial, pelagica, recifes e superficie.
- Evitar criaturas genericas de fantasia terrestre quando houver um equivalente marinho interessante.
- A anatomia pode ser estilizada e monstruosa, mas deve manter uma leitura biologica/oceanica.
- Bosses devem parecer formas de vida ou lendas marinhas adaptadas ao universo Abyssal, nao personagens aleatorios desconectados do mar.
- Skins podem reinterpretar especies reais com mutacoes, bioluminescencia, pressao, toxinas, eletricidade, blindagem, camuflagem e outras adaptacoes plausiveis para o universo.

Exemplos de referencias fortes para explorar no futuro:
peixe-vibora, peixe-dragao, enguia-pelicano, peixe-ogro, tubarao-charuto, tubarao-duende, quimera, lula-vampira, lula-colossal, isopode-gigante, siphonophora, medusas profundas, pepino-do-mar, caranguejo-yeti, peixe-bolha, peixe-lanterna, peixe-machado, peixe-tripode, peixe-pescador, moraias, raias, mantas, tubaroes, moreias, polvos, lulas, crustaceos e cnidarios.

## 3. Regra de produto para o mapa

Nao voltar ao antigo "quadradao vazio".

A estrutura atual segue uma DESCIDA ABISSAL:
- progressao principal sempre avanca para baixo no eixo Y;
- salas organicas conectadas por corredores;
- desvios laterais opcionais;
- sala de elite opcional;
- sala/evento lateral;
- hub antes da descida profunda;
- poco azul de descida;
- camada inferior separada fisicamente;
- boss sempre no ponto mais profundo;
- vortex de superficie para extracao;
- paredes sao colisao real, nao apenas decoracao;
- monstros e jogadores nao devem atravessar pedra;
- projeteis PvE tambem devem respeitar a geometria;
- PvP continua usando sua arena propria, sem herdar a caverna PvE.

A intencao de retencao e criar decisoes:
- seguir pelo caminho principal;
- arriscar um desvio por elite/recompensa;
- extrair o saque;
- ou descer mais fundo em busca de boss/progressao.

## 4. Arquitetura do mapa implementada

Branch de desenvolvimento:
`abyssal-descending-cave-map`

Base da branch:
`main@2ec03037b23715f579f6744f53c63ba073240c20`

Modulo compartilhado:
`public/abyssal-map.js`

Esse modulo e usado no browser e no servidor. Nao duplicar a geometria em dois lugares.

Funcoes importantes:
- `createLayout(seed, tier)`
- `isWalkable(...)`
- `segmentWalkable(...)`
- `resolveMove(...)`
- `roomAt(...)`
- `navigationTarget(...)`
- `spawnPoint(...)`
- `startSpawn(...)`

O servidor transmite apenas identificacao compacta do mapa:
`{ version, seed, tier }`

O cliente recria a mesma geometria deterministicamente. Nao enviar a lista completa de salas a cada snapshot.

## 5. Integracao cliente/servidor atual

### Servidor

Arquivos:
- `server.js`
- `world-simulation.js`

O servidor:
- cria/recupera o layout por `WorldSimulation.mapLayoutFor(world)`;
- nasce jogadores de co-op na sala inicial;
- valida movimento do jogador contra a caverna;
- mantem o envelope anti-teleporte;
- nasce inimigos dentro de salas reais;
- nasce elites na sala opcional de elite;
- nasce bosses na sala final;
- faz IA navegar pelo grafo de salas/corredores;
- valida transicoes de descida/subida;
- nao permite teleportar pelo poco apenas enviando coordenada falsa.

Evento Socket.IO:
`map-transition`

Transicoes autorizadas:
- `descent`
- `ascend`

O servidor exige proximidade real do portal e destino caminhavel.

### Cliente

Arquivos:
- `public/game.js`
- `public/online.js`
- `public/abyssal-rebuild.css`
- `public/index.html`

O cliente:
- carrega `abyssal-map.js` antes de `game.js`;
- reconstrui o mapa a partir do seed recebido;
- usa a mesma geometria para colisao local;
- renderiza caverna escura, salas, corredores, sinais e portais;
- usa F no PC para interagir com portal;
- mostra botao contextual no mobile;
- envia transicao online ao servidor para validacao;
- no solo executa a mesma transicao local;
- usa o vortex de superficie para extracao;
- reutiliza o fluxo existente de finalizacao online em vez de criar uma segunda rotina de salvamento.

## 6. Regras de multiplayer que NAO podem regredir

A mudanca imediatamente anterior, ja mergeada em main, foi:
`fix: reject impossible movement before authoritative PvP pickups`
merge base atual:
`2ec03037b23715f579f6744f53c63ba073240c20`

Regras:
- movimento local precisa responder imediatamente;
- servidor continua autoritativo;
- nao reintroduzir espera por round-trip para mover o proprio jogador;
- reconciliacao deve corrigir fraude/colisao sem congelar input;
- Q/E e habilidades precisam ter feedback visual imediato, com confirmacao do servidor;
- movimento impossivel/teleporte deve ser rejeitado;
- no PvP, coleta e efeitos nao podem ser resolvidos antes da validacao de posicao/parede;
- nao trocar o envelope anti-teleporte por clamps gigantes permissivos;
- testes antigos que "teleportavam" jogadores foram corrigidos para caminhar em passos validos.

## 7. Comportamento especial de encontros

- Elite e opcional: se nasceu na sala `elite`, fica defendendo a propria sala ate o jogador entrar nela.
- Boss nasce na sala `boss`.
- Boss nao pode atravessar o poco para perseguir jogador que ainda nao desceu.
- Hub e landing nao possuem corredor fisico normal entre si.
- A unica passagem e a transicao pelo poco/vortex.
- Isso e intencional e faz parte da estrutura de risco/progressao.

## 8. Testes adicionados

Arquivos:
- `tests/abyssal-map.test.cjs`
- `tests/cave-map-integration.test.cjs`
- `tests/cave-world-simulation.test.cjs`

Cobrem:
- progressao principal sempre descendente;
- boss como sala mais profunda;
- variacao lateral por seed sem inverter profundidade;
- hub e landing separados por portal;
- colisao de parede;
- spawns comuns/elite/boss;
- grafo de navegacao;
- compartilhamento do mapa por seed;
- integracao cliente/servidor;
- validacao de portal;
- separacao do mapa PvP.

Antes de mergear qualquer alteracao relevante:
1. executar/aguardar o workflow `Abyssal checks v2`;
2. investigar qualquer falha;
3. nao "corrigir" teste afrouxando uma regra de seguranca sem entender a causa;
4. conferir sintaxe de `server.js`, `world-simulation.js`, `public/game.js`, `public/online.js` e `public/abyssal-map.js`.

## 9. Pontos que ainda devem ser avaliados depois desta PR

Nao assumir que estes itens ja estao concluídos so porque o mapa base existe:

1. Balanceamento de densidade por sala e profundidade.
2. Recompensa especifica da sala de elite.
3. Eventos/tesouros/armadilhas no desvio lateral.
4. Progressao entre multiplas camadas/tier de mapa.
5. Sinalizacao mais forte de "risco x recompensa" antes do desvio.
6. Fauna distribuida por zona de profundidade, e nao apenas por RNG global.
7. Revisao sistematica de todos os monstros/skins/bosses para a direcao biologica marinha definida acima.
8. Teste de performance com 400 inimigos dentro da nova navegacao.
9. Teste real multiusuario apos deploy, principalmente reconciliacao perto de paredes e uso de Q/E enquanto atravessa corredores.
10. Confirmar que reconexao/manutencao preserva o seed/layout da expedicao restaurada.

## 10. Procedimento para o proximo agente

Ao iniciar um novo chat/agente:

1. Abrir este arquivo primeiro.
2. Ler `public/abyssal-map.js`.
3. Ler os tres testes de cave map.
4. Verificar a branch/main e o ultimo PR relacionado a "descending cave".
5. Conferir o workflow mais recente antes de alterar codigo.
6. Preservar cliente preditivo + servidor autoritativo.
7. Nao substituir a caverna por um retangulo decorado.
8. Continuar a direcao de fauna marinha descrita na secao 2.
9. Se encontrar uma falha, identificar se e logica, teste antigo, performance ou divergencia cliente/servidor antes de aplicar patch.
10. Atualizar este arquivo quando uma decisao arquitetural importante mudar.

## 11. Contexto de produto que motivou a mudanca

O problema original era que o mapa principal ainda parecia um quadrado grande, vazio e sem motivo para explorar. A mudanca nao e cosmetica: a exploracao deve criar curiosidade, escolha, risco e vontade de continuar descendo.

O principio para decidir novas features de mapa e:
"isso cria uma decisao, uma descoberta, um risco, uma recompensa ou um motivo concreto para continuar a descida?"

Se a resposta for nao, provavelmente e apenas decoracao e nao resolve o problema de retencao.
