# ABYSSAL - CONTINUIDADE PARA O PROXIMO AGENTE

Atualizado em: 2026-11-05

Este arquivo e a fonte de continuidade tecnica do projeto. Leia antes de modificar gameplay, multiplayer, mapa, criaturas, skins, bosses, deploy ou fluxo de publicacao.

## 1. Objetivo do projeto

Abyssal e um jogo HTML5/JavaScript com Node.js + Socket.IO, multiplayer em tempo real, deploy no Render e empacotamento Android.

Prioridades:
1. gameplay responsivo, sem input lag perceptivel;
2. servidor autoritativo sem sacrificar resposta visual local;
3. exploracao que prenda por risco, curiosidade, progressao e descida;
4. identidade visual e criaturas coerentes com oceano e abismo;
5. estabilidade suficiente para publicacao e operacao real.

## 2. Regra de produto para criaturas

Direcao obrigatoria para novas criaturas, monstros, elites, skins e bosses:

- Priorizar fauna marinha abissal real ou fortemente inspirada nela.
- Quando as boas referencias abissais se esgotarem, expandir para fauna mesopelagica, batial, pelagica, recifes, superficie e estuarios marinhos.
- Evitar fantasia terrestre quando houver equivalente marinho interessante.
- A anatomia pode ser monstruosa, mas precisa manter leitura biologica/oceanica.
- Skins podem reinterpretar especies reais com bioluminescencia, pressao, toxinas, eletricidade, blindagem, camuflagem e outras adaptacoes do universo Abyssal.
- IDs internos de skins compradas nao devem ser renomeados sem migracao de conta. A identidade visual e o nome de exibicao podem mudar mantendo o ID.

A revisao de 2026-11-05 substituiu os quatro casos claramente fora da direcao marinha sem quebrar IDs/ownership:
- `abysscroc` -> Tubarao-Touro Estuarino;
- `armoredgator` -> Caranguejo-Ferradura Couracado;
- `greensnake` -> Moreia Esmeralda Colossal;
- `electriceel` -> Raia-Eletrica Abissal.

Outras identidades foram reforcadas:
- Medusa-Coroa Violeta;
- Ourico Solar;
- Anemona Toxica;
- Nautilo Soberano;
- Lula-Vampira Carmesim;
- Peixe-Olho-de-Barril;
- reliquias dos bosses com nomes coerentes com a fauna.

Bosses agora sao apresentados como:
- Cefalopode Calcificado;
- Peixe-Pescador Abissal;
- Enguia-Pelicano Colossal;
- Peixe-Remo Leviata;
- Tubarao-Branco;
- Lula-Kraken das Fossas;
- Lula-Colossal do Vazio.

Os IDs, stats, hitboxes, ownership, Stripe e habilidades existentes foram preservados.

## 3. Regra de produto para o mapa

Nao voltar ao antigo "quadradao vazio".

A estrutura segue uma DESCIDA ABISSAL:
- progressao principal sempre avanca para baixo no eixo Y;
- salas organicas conectadas por corredores;
- desvios laterais opcionais;
- sala de elite opcional;
- sala/evento lateral;
- hub antes da descida profunda;
- poco azul de descida;
- camada inferior separada fisicamente;
- boss no ponto mais profundo;
- sigilo do boss abre a camada seguinte depois da vitoria;
- vortex de superficie permite extracao;
- paredes sao colisao real;
- monstros, jogadores e projeteis PvE respeitam pedra;
- PvP mantem arena propria.

A intencao e sempre criar decisoes:
- seguir o caminho principal;
- arriscar elite/cache;
- entrar no eco lateral;
- extrair;
- ou reunir o grupo no sigilo e descer para outra camada.

## 4. Estado atual da arquitetura do mapa

PR base ja mergeado:
- PR #182: `feat: replace empty expedition rectangle with descending abyssal cave`
- merge commit: `5344feef85962a11c6c14e68006b1c33c833a883`

PR de continuidade JA MERGEADO:
- PR #183: `feat: deepen Abyssal cave retention with ecology, branches and tiers`
- merge commit: `0362eccfcbf234ca59ee3cf5afdda82869a1bd65`
- branch de trabalho: `abyssal-cave-retention-tiers`
- base original: `main@5344feef85962a11c6c14e68006b1c33c833a883`

Modulo compartilhado:
- `public/abyssal-map.js`
- VERSION atual: 2

Nao duplicar geometria entre browser e servidor.

Funcoes importantes:
- `createLayout(seed, tier)`
- `roomProfile(...)`
- `isWalkable(...)`
- `segmentWalkable(...)`
- `resolveMove(...)`
- `roomAt(...)`
- `navigationTarget(...)`
- `spawnPoint(...)`
- `startSpawn(...)`

O servidor transmite apenas identidade compacta:
`{ version, seed, tier }`

Tier 0 preserva o layout original do PR #182. Tiers posteriores usam o mesmo seed de expedicao mais o numero do tier para variar lateralmente o desenho sem inverter a ordem descendente em Y.

## 5. Ecologia, densidade e risco/recompensa

`public/abyssal-map.js` contem `ROOM_PROFILES` com risco, teto de densidade, recompensa e sinal por sala.

`public/abyssal-expedition-rules.js` contem:
- `ROOM_ECOLOGY`;
- `SIDE_ENCOUNTERS`;
- `zoneForRoom(...)`;
- `roomWeights(...)`;
- `chooseCommonKindForRoom(...)`;
- `roomDensityCap(...)`;
- `roomRewardMultiplier(...)`;
- `eliteRoomBonusValue(...)`;
- `sideEncounterFor(seed,tier)`.

A fauna comum agora depende da profundidade fisica da sala e do tier, nao apenas de bosses derrotados.

O spawn normal respeita teto de densidade das salas ativas. Quando as salas atingem o teto, nao existe fallback que vaze novos mobs por fora da regra.

O desvio lateral `event` resolve exatamente um encontro deterministico por tier:
- `resonance_cache`: tesouro/cache de XP;
- `viper_nest`: emboscada;
- `pressure_vent`: armadilha de pressao com elites.

A sala `elite` concede um cache extra uma vez por tier.

Cliente e servidor usam seed/tier para chegar ao mesmo encontro sem enviar estrutura pesada pela rede.

## 6. Progressao entre camadas

Depois de derrotar o boss da camada:
- nao nasce outro boss naquela mesma camada;
- o sigilo final passa a oferecer `next-tier`;
- no solo, o jogador decide quando descer;
- no co-op, o servidor exige que todos os jogadores vivos estejam reunidos no sigilo;
- o servidor valida boss derrotado, ausencia de boss vivo, proximidade e grupo pronto;
- ao descer, `mapTier` incrementa;
- inimigos/orbes da camada antiga sao limpos;
- o layout e regenerado deterministicamente;
- todos os jogadores vivos nascem juntos no inicio da nova camada;
- prediction/reconciliation nao e substituida por teleporte cliente-autoritativo.

Evento Socket.IO:
`map-transition`

Transicoes:
- `descent`
- `ascend`
- `next-tier`

## 7. Regras de multiplayer que NAO podem regredir

Preservar:
- movimento local imediato;
- servidor autoritativo;
- client-side prediction;
- server reconciliation;
- envelope anti-teleporte;
- Q/E com resposta visual imediata;
- dano/HP autoritativo;
- ordem correta de validacao de posicao antes de pickup/efeito PvP;
- paredes bloqueando movimento e projeteis;
- sem clamps gigantes permissivos.

Nao reintroduzir espera de round-trip para mover o jogador.

A transicao de tier e uma excecao discreta e validada pelo servidor, assim como os portais existentes. Ela nao muda o modelo normal de movimento.

## 8. Reconexao e manutencao

O restore de deploy salva `room.world` inteiro por serializacao JSON e restaura o mesmo mundo dentro da janela de 5 minutos.

Isso preserva:
- `mapSeed`;
- `mapTier`;
- `bossesDefeated`;
- `sideEncounterResolvedTier`;
- `eliteRewardClaimedTier`;
- inimigos/orbes e demais campos serializaveis do mundo.

Ha teste explicito em `tests/cave-map-integration.test.cjs` cobrindo que a rota de deploy resume continue preservando o mundo deterministico.

Nao trocar esse restore por uma recriacao vazia do mapa.

## 9. Testes relevantes

Arquivos principais:
- `tests/abyssal-map.test.cjs`
- `tests/cave-map-integration.test.cjs`
- `tests/cave-world-simulation.test.cjs`
- `tests/cave-retention-tiers.test.cjs`
- `tests/cave-navigation-performance.test.cjs`

Cobrem:
- progressao descendente;
- variacao lateral deterministica por tier;
- boss na profundidade final;
- hub/landing separados por portal;
- colisao;
- spawns e navegacao;
- ecologia por sala;
- densidade superior/inferior;
- encontros laterais deterministas;
- cache de elite;
- transicao de tier em grupo;
- restore de seed/tier no deploy;
- navegacao com 400 entidades.

O workflow `Abyssal checks v2` passou no commit:
`cb5264355bb601a58a754400d6aa1205c8c16f6d`

Esse SHA passou toda a suite antes do merge. O PR #183 foi mergeado em `0362eccfcbf234ca59ee3cf5afdda82869a1bd65` e esse mesmo commit foi implantado no Render com status `live`.

Antes de mergear alteracao relevante:
1. aguardar `Abyssal checks v2`;
2. investigar qualquer falha;
3. nao afrouxar teste de seguranca so para ficar verde;
4. conferir sintaxe de `server.js`, `world-simulation.js`, `public/game.js`, `public/online.js`, `public/abyssal-map.js` e `public/abyssal-expedition-rules.js`.


## 10. Deploy atual no Render

Servico:
- nome: `Abyssal`;
- branch: `main`;
- commit de codigo implantado: `0362eccfcbf234ca59ee3cf5afdda82869a1bd65`;
- deploy: `dep-dbm3htrm8hqs73eklmf0`;
- status confirmado: `live`;
- build concluido sem vulnerabilidades de npm reportadas;
- servidor iniciou com PostgreSQL ativo e sem logs de nivel error logo apos o deploy.

IMPORTANTE: em 2026-11-05 o servico estava com `autoDeploy: no` e `autoDeployTrigger: off`. Nao assumir que push/merge em `main` entra no ar automaticamente. Depois de qualquer mudanca de codigo destinada a producao, verificar a configuracao atual do Render e, se o auto-deploy continuar desligado, disparar o deploy manualmente e confirmar o commit implantado.

## 11. O que foi concluido da lista antiga

Concluidos no PR #183:
1. densidade por sala/profundidade;
2. recompensa especifica de elite;
3. evento/tesouro/armadilha lateral;
4. multiplas camadas/tier;
5. sinalizacao de risco/recompensa;
6. fauna por profundidade fisica;
7. revisao sistematica da identidade marinha atual;
8. teste de performance com 400 entidades;
10. preservacao de seed/layout no reconnect/deploy resume.

Permanece como validacao operacional:
9. teste real multiusuario pos-deploy com pelo menos dois clientes reais, especialmente:
   - reconciliacao perto de paredes;
   - Q/E atravessando corredores;
   - reunir grupo no sigilo;
   - troca para `next-tier`;
   - reconnect durante uma expedicao em tier > 0.

Nao remover nem mascarar esse item como "feito" sem executar dois clientes reais.

## 12. Procedimento para o proximo agente

1. Abrir este arquivo primeiro.
2. Conferir PR/commit mais recente relacionado a cave/tier.
3. Ler `public/abyssal-map.js` e `public/abyssal-expedition-rules.js`.
4. Ler os cinco testes de cave listados acima.
5. Verificar workflow mais recente.
6. Preservar cliente preditivo + servidor autoritativo.
7. Nao substituir a caverna por retangulo decorado.
8. Continuar a fauna marinha.
9. Ao encontrar falha, classificar como logica, teste desatualizado, performance ou divergencia cliente/servidor antes de corrigir.
10. Atualizar este arquivo quando uma decisao arquitetural mudar.

## 13. Principio de produto

O problema original era um mapa principal grande, vazio e sem motivo para explorar.

A pergunta para toda nova feature de mapa continua sendo:
"isso cria uma decisao, uma descoberta, um risco, uma recompensa ou um motivo concreto para continuar a descida?"

Se a resposta for nao, provavelmente e decoracao e nao resolve retencao.
