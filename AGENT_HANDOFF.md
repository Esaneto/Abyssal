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


## 10.1. Pass visual do Codex incorporado ao estado canonico

Commit incorporado:
- `b78a95e31616c7c7069b9ce814263acc8734ef56`
- mensagem: `feat: ocean sinkhole menu and submerged cave scenery`

Esse commit foi feito diretamente na `main` e esta sendo assumido como parte oficial do Abyssal a partir deste ponto.

Mudancas canonicas introduzidas:
- `public/abyssal-rebuild.css`: o portal/menu da Descida Abissal virou um grande sumidouro oceanico inundado, com ajustes de responsividade e posicionamento de HUD/eventos;
- `public/abyssal-rebuild.js`: toda a area visual do gate ficou clicavel e o foco retorna ao botao ao fechar o painel;
- `public/game.js`: salas da caverna passaram a receber bordas minerais, vida bentonica e iluminacao de agua; glifos decorativos antigos de salas/boss foram removidos em favor do ambiente fisico.

Regra de continuidade:
- nao reverter esse pass visual ao estilo de "icones em sala" sem motivo funcional;
- novas melhorias devem partir desse sumidouro e dessa caverna submersa;
- preservar a geometria compartilhada, colisao, tiers, ecologia, recompensas e autoridade de servidor ja implementadas;
- esse commit nao deve ser tratado como experimento isolado ou trabalho externo pendente. Ele faz parte do baseline atual.

O deploy Render `dep-dbm3nsgu01pc738alt9g` publicou esse commit e chegou a status `live`.

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


## 14. Handoff de skins: divergencia visual observada em producao

Observacao do usuario em 2026-11-05:
- o catalogo exibe muitas skins, mas varias parecem compartilhar praticamente o mesmo visual;
- nao assumir que isso significa ausencia de trabalho visual: a main contem renderizacoes especificas e testes de silhueta para varias skins.

Evidencias ja verificadas na main:
- `public/game.js` possui branches visuais especificas para varias skins, incluindo `kraken`, `royal`, `toxic`, `thorn`, `coral`, `bloodmoon`, `reefshark`, `hammerhead` e outras;
- `tests/skin-silhouette-pass.test.cjs` valida que algumas skins mantenham silhuetas realmente distintas;
- `renderShop()` chama `renderCreaturePreview(..., skin)`, que por sua vez chama `drawCreature(..., skin)` passando o objeto completo da skin;
- dentro de `drawCreature()`, skins que possuem `skin.family` podem ser desviadas para `window.drawMarineSpecies` quando esse renderer esta disponivel;
- portanto, o problema relatado pode estar no renderer marinho/family, em um fallback visual compartilhado, em dados de skin que apontam para a mesma familia/silhueta, ou em cache/deploy, e nao necessariamente no renderer legado de `drawCreature()`.

Regra para o proximo agente/Codex:
1. Antes de redesenhar skins do zero, rastrear cada skin do catalogo desde `skinData`/fonte de especie ate `renderCreaturePreview()` e o renderer efetivamente usado.
2. Mapear quais skins entram no caminho legado de `drawCreature()` e quais entram em `window.drawMarineSpecies`.
3. Verificar se skins diferentes compartilham a mesma chave de familia, anatomia-base ou fallback e por isso ficam visualmente iguais.
4. Preservar IDs internos, ownership, precos, Stripe, habilidades e saves. Corrigir somente a identidade visual quando o problema for de renderer.
5. Cada skin deve ter leitura de silhueta propria em tamanho de gameplay, nao apenas mudanca de cor, brilho ou pequenos adornos.
6. Priorizar anatomia marinha real: peixe-pescador, peixe-vibora, peixe-dragao, peixe-machado, barreleye, peixe-ogro, peixe-tripe, peixe-caracol hadal, enguia-pelicano, enguia-cobra, moreias, lulas, polvos, sifonoforos, medusas, raias, tubaroes e outros grupos marinhos coerentes.
7. Nao alterar hitbox, dano, velocidade ou netcode apenas para diferenciar visualmente uma skin.
8. Validar a mesma skin em dois lugares: preview da loja e personagem real em gameplay. Uma skin nao esta concluida se so parece correta no card.
9. Adicionar ou ampliar testes de regressao para impedir que skins distintas voltem a compartilhar a mesma silhueta-base por acidente.
10. Depois da correcao, revisar desktop e mobile. Em escala pequena, diferencas devem continuar legiveis.

Sequencia de investigacao recomendada:
- `public/game.js`: `skinData`, `renderShop()`, `renderCreaturePreview()`, `drawCreature()`;
- localizar a definicao de `window.drawMarineSpecies` e a fonte das skins com `family`;
- comparar visualmente IDs diferentes que hoje parecem clones;
- confirmar se o deploy esta servindo o mesmo SHA da main antes de concluir que o renderer falhou.

Nao fazer:
- nao substituir todas as skins por um unico template com paletas diferentes;
- nao remover as branches visuais ja distintas do renderer legado;
- nao renomear IDs persistidos;
- nao tocar em multiplayer, autoridade de servidor ou fluxo de dano para resolver um problema puramente visual.

Criterio de aceite:
- ao abrir o catalogo sem ler os nomes, deve ser possivel distinguir a maioria das skins apenas pela silhueta;
- ao equipar duas skins diferentes, o jogador deve perceber imediatamente mudanca anatomica real, nao apenas cor;
- preview e gameplay devem usar a mesma identidade visual da skin.


## 15. Direcao visual canonica: priorizar o novo design em todo o jogo

Decisao de produto em 2026-11-05:
- o design antigo deve ser considerado ultrapassado;
- qualquer trabalho novo deve priorizar o visual mais recente e coerente com a identidade abissal/marinha atual;
- renderers, componentes, cards, HUDs, menus, criaturas, skins, bosses, efeitos e cenarios antigos devem ser migrados progressivamente para a nova linguagem visual, desde que isso nao quebre gameplay, performance, saves, compras ou netcode.

Regra de implementacao:
1. Quando houver dois caminhos visuais para a mesma entidade, considerar o novo renderer como fonte canonica.
2. O renderer antigo deve permanecer apenas quando necessario para compatibilidade temporaria, nunca como referencia estetica para novas features.
3. Nao criar novas skins, monstros, bosses, menus ou efeitos usando o estilo antigo apenas porque ja existe codigo pronto.
4. Sempre que uma entidade ainda depender do renderer legado, avaliar se pode ser portada para o novo sistema sem alterar sua logica de gameplay.
5. Preservar IDs, ownership, Stripe, progressao, habilidades, hitboxes, dano, velocidade e comportamento de rede durante migracoes visuais.
6. A diferenca entre entidades deve vir de anatomia, silhueta, materiais, locomocao, bioluminescencia e efeitos proprios, nao apenas de troca de cor.
7. O novo visual deve continuar legivel em escala pequena, em desktop e mobile, e nao pode custar regressao relevante de FPS ou aumentar trafego de rede.
8. Se o novo renderer ainda nao cobrir uma entidade, a tarefa correta e expandi-lo, nao reforcar o legado.

Prioridade pratica para o proximo agente:
- consolidar skins no novo renderer;
- depois monstros comuns e elites;
- depois bosses e reliquias;
- depois HUD, cards, menus e feedback visual que ainda destoem;
- por fim remover ou isolar codigo legado que nao seja mais utilizado.

Criterio de aceite visual:
- o jogo deve parecer feito por um unico sistema de arte e nao por camadas de estilos antigos e novos misturados;
- nenhuma skin nova deve parecer uma recoloracao de uma criatura antiga;
- nenhuma tela nova deve herdar layout/ornamentos antigos se ja houver uma linguagem visual nova equivalente.


## 16. Regra permanente de continuidade entre agentes

Toda mudanca estrutural ou visual relevante deve deixar contexto suficiente para o proximo agente continuar sem adivinhar.

Obrigatorio apos alteracoes em gameplay, netcode, mapa, renderer, skins, bosses, UI, deploy, autenticacao, monetizacao ou persistencia:
1. registrar no `AGENT_HANDOFF.md` o que mudou e por que;
2. registrar os arquivos e funcoes principais envolvidos;
3. listar invariantes que nao podem regredir;
4. registrar testes adicionados ou atualizados;
5. registrar riscos conhecidos, pendencias e validacoes ainda nao executadas;
6. quando houver migracao, dizer explicitamente qual sistema e canonico e qual ficou legado;
7. evitar instrucoes vagas como "melhorar depois": indicar o proximo ponto tecnico concreto;
8. nunca apagar contexto antigo ainda relevante apenas para deixar o handoff menor.

Se uma mudanca futura contradizer uma decisao anterior:
- documentar a nova decisao;
- explicar o motivo;
- indicar quais regras antigas foram substituidas;
- preservar compatibilidade ou migrar dados quando necessario.

Objetivo desta regra:
um novo agente deve conseguir ler o repositorio e este handoff e entender o estado real do projeto antes de escrever codigo.

## 17. Correcao do renderer marinho em 2026-11-05

Problema confirmado visualmente no catalogo:
- especies diferentes da mesma familia usavam praticamente a mesma silhueta;
- tubarao-baleia, peregrino, mako, raposa, duende e cobra pareciam o mesmo tubarao com pequenas variacoes;
- a causa estava em `public/marine-renderer.js`, que tinha um unico template para `shark` e outro template generico compartilhado com `fish`.

Correcao aplicada:
- `public/marine-renderer.js` agora usa anatomia especifica por variante para as especies mais distintas;
- tubarao-baleia: corpo robusto, cabeca larga, boca frontal e manchas;
- peregrino: boca filtradora muito aberta e grandes fendas branquiais;
- mako: corpo fusiforme, focinho pontudo e cauda de alta velocidade;
- raposa: lobo superior da cauda extremamente alongado;
- duende: rostro longo e mandibula projetavel;
- cobra: corpo anguilliforme;
- lanterna: forma compacta, olho grande e fotoforos;
- Groenlandia: corpo grosso, lento e focinho rombudo;
- familias ray, eel, squid/octopus, jelly, crustacean, fish, benthic e mollusc tambem receberam diferenciacao anatomica adicional.

Invariante visual novo:
"species identity must come from anatomy first, not color."

Teste:
- `tests/marine-renderer-anatomy.test.cjs`
- impede retorno ao branch generico `case 'shark':case 'fish'`;
- exige marcadores de anatomia especifica para os principais tubaroes;
- exige que o renderer documente explicitamente a regra anatomy-first.

Proximos passos recomendados:
1. validar visualmente catalogo e gameplay em desktop e mobile;
2. remover ou reduzir elementos de preview que ainda dominem a silhueta, como anel/orbita decorativa comum;
3. expandir perfis anatomicos para variantes restantes que ainda parecam proximas demais;
4. se duas especies continuarem parecendo o mesmo animal quando vistas apenas como silhueta preta, tratar como bug visual;
5. manter a mesma identidade entre preview da loja e personagem equipado em gameplay.


## 18. Auditoria profunda de conflitos visuais e persistencia em 2026-11-05

A auditoria encontrou problemas que nao eram apenas cosmeticos.

### Problemas confirmados e corrigidos

1. Renderer marinho generico
- causa: `public/marine-renderer.js` usava um template quase unico por familia;
- tubaroes e peixes chegaram a compartilhar o mesmo branch generico;
- correcao: perfis anatomicos por especie/variante e separacao de `shark` e `fish`.

2. Preview uniformizando especies
- causa: `renderCreaturePreview()` desenhava a mesma orbita/anel eliptico em todas as criaturas;
- correcao: remover o anel dominante, usar sombra discreta e escalas de enquadramento por familia/variante;
- invariante: anatomia deve dominar o card.

3. Cache podia esconder a correcao
- causa: `index.html` continuava carregando `marine-renderer.js?v=2` e outras versoes antigas;
- correcao: bump explicito de cache para renderer, species, skin-abilities e game sempre que esses assets mudarem;
- regra: alteracao visual em JS/CSS servido diretamente deve atualizar o query version correspondente no HTML.

4. Ownership de skins marine podia ser apagado
- causa: `save-cosmetics` possuia uma segunda whitelist legada que nao incluia IDs `marine_*`;
- efeito: uma skin marinha comprada podia ser filtrada da propriedade persistida em um save posterior;
- correcao: `save-cosmetics` usa agora `allowedSkinIds`, a whitelist canonica que ja inclui todas as especies de `public/marine-species.js`;
- regra: nunca criar uma segunda whitelist de skins. Toda validacao deve derivar da fonte canonica.

5. Nomes de pagamento divergentes da identidade atual
- `abysscroc` e `armoredgator` ainda apareciam no modulo de pagamento como identidades antigas;
- correcao: pagamento, loja e nomes canonicos foram alinhados para Tubarao-Touro Estuarino e Caranguejo-Ferradura Couracado.

6. Boss roster divergente em habilidades
- `whiteSharkBoss` estava ausente de `BOSS_KINDS` no modulo compartilhado de skin abilities;
- efeito: bonus declarados contra bosses podiam nao aplicar ao Tubarao-branco Colossal;
- correcao aplicada em `skin-abilities.js` e `public/skin-abilities.js`.

7. Cor por familia reforcava clones
- `marine-species.js` dava a mesma cor a todas as especies de uma familia;
- correcao: paleta secundaria varia por especie. Anatomia continua sendo o identificador principal.

### Testes adicionados/atualizados

- `tests/marine-renderer-anatomy.test.cjs`
  - anatomia especifica dos tubaroes;
  - proibicao do branch compartilhado shark/fish;
  - proibicao do antigo anel dominante de preview;
  - verifica versoes atuais de cache.

- `tests/marine-species.test.cjs`
  - especies marinhas nao colapsam para uma cor por familia;
  - `save-cosmetics` deve usar `allowedSkinIds` e preservar ownership `marine_*`.

- `tests/skin-abilities.test.cjs`
  - `whiteSharkBoss` deve ser tratado como boss;
  - cliente e servidor devem continuar usando o mesmo modulo.

- `tests/payments.test.cjs`
  - nomes canonicos das skins pagas permanecem alinhados com a loja.

### Branches visuais antigas: NAO MERGEAR EM BLOCO

Na auditoria, estas branches estavam fortemente divergentes da main:
- `visual-skins-full-redesign-v2`: centenas de commits atras;
- `visual-skins-skills-redesign`: centenas de commits atras;
- `marine-fauna-identity-pass`: divergente;
- `abyssal-skin-silhouette-pass`: divergente;
- `abyssal-rebuild-expedition-skins`: divergente.

Regra:
- nao fazer merge wholesale dessas branches na main atual;
- se houver codigo util nelas, comparar arquivo/commit e fazer cherry-pick ou port manual isolado;
- antes de portar, verificar se a mudanca ja foi superada pelo renderer canonico atual;
- nunca permitir que uma branch antiga restaure whitelists, nomes, cache versions, renderer ou gameplay legado.

### Checklist obrigatorio para futuras skins

Antes de considerar uma skin pronta:
1. ID aceito em `allowedSkinIds`;
2. ownership sobrevive a `save-cosmetics`;
3. se paga, existe em `PAID_SKINS`/checkout;
4. habilidade descrita existe de verdade em `skin-abilities` ou logica autoritativa correspondente;
5. preview e gameplay usam a mesma anatomia;
6. silhueta continua reconhecivel sem cor;
7. cache version foi atualizado;
8. desktop e mobile foram validados;
9. teste de regressao cobre a nova regra;
10. este handoff e atualizado se houver decisao estrutural nova.


## 19. Fechamento da auditoria: testes, cache e copia residual

Depois das correcoes da secao 18, a suite revelou dois testes antigos que fixavam literalmente `game.js?v=4.4.8`.
Isso causava falha toda vez que um cache bust legitimo atualizava a versao do asset.

Correcao:
- `tests/cave-map-integration.test.cjs` agora valida que `abyssal-map.js` carregue antes de `game.js` sem depender de versao fixa;
- `tests/expedition-rebuild.test.cjs` faz o mesmo para `abyssal-expedition-rules.js`;
- regra permanente: testes de ordem de scripts devem validar ordem/contrato, nao congelar query-version de outro asset.

Tambem foi removida copia residual de crocodiliano no ingles:
- `abysscroc`: Estuarine Bull Shark / Estuarine charge;
- `armoredgator`: Armored Horseshoe Crab / Telson sweep;
- `game.js` foi invalidado para `v=4.4.11`.

Validacao:
- no commit `53e188318778b031911b892cef05e9a438c68382`, o job `syntax-and-tests` do workflow `Abyssal checks v2` concluiu com sucesso;
- isso inclui `npm test` completo apos as correcoes de renderer, ownership, habilidades, nomes, cache e testes;
- builds Android/Windows sao pipelines separados e podem continuar processando depois da validacao logica. Falha de empacotamento deve ser diagnosticada separadamente e nunca mascarada como falha de gameplay.

Regra adicional:
- ao fazer cache bump, pesquisar testes que fixem a versao literal do asset e substitui-los por verificacao de contrato sempre que o numero em si nao for o requisito.


## 20. Correcao visual apos validacao por captura real em 2026-11-05

O usuario enviou capturas reais do Abyssario e da loja e confirmou duas falhas que os testes anteriores nao detectavam:
- bosses ainda pareciam o renderer antigo;
- muitas skins novas pareciam recoloracoes planas e nao seguiam a linguagem visual do Abyssal.

Correcao estrutural:
- novo arquivo canonico: `public/abyssal-boss-renderer.js`;
- todos os bosses hostis de `BOSS_KINDS` sao desviados por `drawCreature()` para `window.drawAbyssalBoss`;
- o renderer legado de boss permanece apenas como fallback temporario e nao deve receber novas features;
- bosses cobertos: `boss`, `angler`, `maw`, `leviathan`, `whiteSharkBoss`, `kraken`, `devourer`.

Direcao visual dos bosses:
- Polvo-de-aneis-azuis: manto mineral pesado + oito bracos em gancho + aneis de alerta;
- Peixe-pescador: cranio enorme + boca cavernosa + dentes-agulha + ilicio;
- Enguia-pelicano: mandibula articulada enorme + bolsa gular negra;
- Peixe-remo Leviata: corpo em fita extremamente longo + placas segmentadas + crista dorsal escarlate;
- Tubarao-branco Colossal: cranio exagerado + mandibula serrilhada + cicatrizes + linha lateral bioluminescente;
- Kraken: manto em forma de lanca + dois tentaculos alimentares muito mais longos;
- Lula-colossal: manto macico + bracos com ganchos + bico escuro + fotoforos internos.

Skins marinhas:
- `public/marine-renderer.js` agora aplica perfis de lula e polvo por variante, em vez de um unico corpo com mudanca de cor;
- a cor da skin deixou de ser a pintura plana do corpo;
- o corpo usa material escuro com gradiente abissal e a cor passa a funcionar como acento/bioluminescencia;
- ha passe secundario de veios minerais, fotoforos e assimetria de cicatriz;
- manter a regra: silhueta primeiro, material depois, cor por ultimo.

Testes:
- `tests/abyssal-boss-renderer.test.cjs` exige renderer dedicado para todos os bosses e marcadores anatomicos unicos;
- `tests/marine-renderer-anatomy.test.cjs` exige variantes de lulas/polvos e material escuro abissal;
- o job `syntax-and-tests` passou no commit `3b598b48a57118fdf6a4993658a6fc6e4e142721`.

Deploy:
- servico Render: `srv-dbgliuon74is73cqnbag`;
- workspace confirmado: `tea-dbgl4q0u01pc73aep1lg`;
- autoDeploy estava desativado;
- deploy manual com cache limpo disparado para o commit `3b598b48a57118fdf6a4993658a6fc6e4e142721`;
- deploy ID: `dep-dbmba8p42hec73e6l800`.


## 21. Direcao visual corrigida por comparacao real de capturas - 2026-11-05

Esta secao SUPERA parcialmente a secao 20 no que diz respeito aos bosses.

O usuario comparou a loja atual com as skins de assinatura antigas do Abyssal e definiu a referencia visual correta:
- as skins de assinatura como Luz Abissal, Medusa-Coroa Violeta, Ourico Solar, Anemona Toxica, Eco do Peixe-Remo Leviata e Coroa de Espinhos possuem mais identidade visual;
- o objetivo nao e copiar suas formas, e sim preservar o mesmo nivel de volume, textura, contraste, leitura de silhueta e personalidade;
- especies novas nao podem parecer ilustracoes naturais simplificadas, linhas finas ou recolors.

### Bosses que NAO devem ser redesenhados

Preservar o renderer estabelecido para:
- `whiteSharkBoss` - Tubarao Boss;
- `kraken` - Kraken Boss;
- `devourer` - Devorador.

Esses tres foram aprovados visualmente pelo usuario.
No maximo corrigir defeito pontual de contorno, proporcao, clipping ou brilho. Nao substituir sua anatomia nem identidade.

A partir desta revisao, `drawCreature()` envia ao novo `window.drawAbyssalBoss` somente:
- `boss`;
- `angler`;
- `maw`;
- `leviathan`.

### Bosses que foram refeitos

`public/abyssal-boss-renderer.js` foi simplificado para conter apenas os quatro bosses que ainda precisavam de redesign:
- Polvo-de-aneis-azuis Colossal: massa compacta, manto mineral, bracos grossos e aneis luminosos integrados ao tecido;
- Peixe-Pescador Abissal: cabeca dominante, cranio blindado, boca enorme, dentes-agulha e isca luminosa;
- Enguia-Pelicano Colossal: corpo em fita e mandibula articulada que domina a cabeca;
- Peixe-Remo Leviata: corpo colossal em fita, placas, crista dorsal e fotoforos.

### Redesign das 100 especies marinhas

`public/marine-renderer.js` foi reconstruido como renderer canonico de skins marinhas.

Contrato visual:
1. silhueta/anatomia identifica a especie;
2. corpo escuro organico/mineral identifica o universo Abyssal;
3. cor serve como bioluminescencia secundaria, nao pintura plana;
4. detalhes internos criam volume: olhos, boca, dentes, placas, nervuras, espinhos, membranas, fotoforos e cicatrizes;
5. cada familia tem variantes anatomicas proprias;
6. nenhuma enguia pode regredir para uma linha colorida com uma cabeca;
7. preview e gameplay continuam usando o mesmo renderer.

Familias cobertas:
- tubaroes;
- raias;
- enguias/moreias/congros;
- lulas;
- polvos;
- medusas;
- crustaceos;
- peixes;
- bentonicos;
- moluscos.

### Presenca no card

`renderCreaturePreview()` tambem foi corrigido:
- especies marinhas agora ocupam mais area do card, aproximando seu peso visual das skins de assinatura;
- foi corrigida uma expressao ternaria ambigua do scale de tubaroes;
- familias longas continuam com escala reduzida apenas quando necessario para evitar clipping.

### Invariantes

Nao alterar para resolver arte:
- hitbox;
- dano;
- habilidade;
- ownership;
- preco;
- Stripe;
- save;
- netcode;
- movimento.

Nao reintroduzir:
- corpo inteiro pintado pela cor da skin;
- uma unica anatomia por familia;
- enguias como linhas finas;
- boss comum ampliado;
- orbita decorativa dominante no preview;
- renderer novo sobre `whiteSharkBoss`, `kraken` ou `devourer`.

Testes relevantes:
- `tests/marine-renderer-anatomy.test.cjs`;
- `tests/abyssal-boss-renderer.test.cjs`.

Cache atual apos este pass:
- `marine-renderer.js?v=6`;
- `abyssal-boss-renderer.js?v=2`;
- `game.js?v=4.4.14`.

Toda futura alteracao visual deve atualizar este handoff e os testes correspondentes.


## 22. Arte por especie: Kraken/Tubarao Boss/Devorador como referencia canonica - 2026-11-05

Decisao de produto apos nova comparacao visual:
- Kraken Boss, Tubarao Boss e Devorador sao a referencia principal de identidade artistica do jogo;
- o objetivo nao e copiar a forma desses tres, mas copiar o nivel de autoria visual: silhueta propria, expressao, camada interna, contraste, brilho localizado e leitura imediata;
- nenhuma especie marinha pode parecer apenas uma variacao de cor ou um desenho naturalista simplificado.

Pesquisa anatomica usada como criterio:
- tubarao-raposa: lobo superior da cauda extremamente alongado;
- tubarao-baleia: cabeca larga, boca frontal e padrao de pontos/barras;
- enguia-pelicano: boca e bolsa gular expansivel dominando a cabeca;
- peixe-tripe: raios de nadadeira extremamente alongados usados como apoio;
- vampire squid: membranas entre os bracos criando uma capa;
- outras especies seguem o mesmo principio: converter o traço biologico mais reconhecivel em assinatura visual Abyssal.

### Fonte canonica dos perfis

`public/marine-species.js` agora possui `visualProfiles` com 100 perfis unicos.
Cada especie recebe:
- `art.key`: assinatura visual unica;
- `art.tone`: tom dominante da especie.

Exemplos:
- `thresher-whip`;
- `pelican-gape`;
- `vampire-cloak`;
- `tripod-stilts`;
- `blue-rings`;
- `mantis-hammer`;
- `scalyfoot-armor`.

Regra:
- nunca remover `art.key` nem voltar a derivar identidade apenas de `family` + `variant`;
- cada nova especie futura precisa receber uma chave de arte propria.

### Linguagem de cor

O renderer marinho nao usa mais gradiente-vinheta como material principal.
`public/marine-renderer.js` usa um unico tom dominante em multiplas opacidades:
- massa escura;
- preenchimento translucido do mesmo tom;
- contorno do mesmo tom mais claro;
- brilho localizado do mesmo tom;
- fotoforos e marcas internas derivadas do mesmo tom.

Isso segue a leitura do Kraken, que cria profundidade com um conjunto restrito de cores e fortes variacoes de luz/transparencia.

Regra:
- nao reintroduzir `createLinearGradient` ou `createRadialGradient` no renderer marinho como atalho generico;
- gradientes especificos so podem voltar quando forem parte essencial da identidade de uma especie e nao um efeito compartilhado.

### Assinatura visual por especie

`signatureArt()` contem um `case` explicito para cada uma das 100 chaves de arte.

Essas assinaturas adicionam traços biologicos que permanecem reconheciveis em miniatura:
- listras;
- manchas;
- caudas;
- rostros;
- espinhos;
- membranas;
- olhos desiguais;
- bocas expansivas;
- aneis;
- fotoforos;
- pernas;
- placas;
- tentaculos;
- bracos filtradores;
- conchas e armaduras.

Criterio de regressao:
se duas especies puderem ser confundidas ao esconder nome/preco, o renderer ainda esta errado.

### Testes

`tests/marine-renderer-anatomy.test.cjs` agora verifica:
- ausencia de gradientes genericos;
- perfis de arte unicos;
- presenca de um `case` de assinatura para cada uma das 100 especies;
- cache atual do renderer;
- familias e anatomias criticas.

`tests/marine-species.test.cjs` verifica:
- 100 `art.key` unicos;
- diversidade de tons dentro de cada familia;
- proibicao de retorno a recolors genericos.

O workflow `Abyssal checks v2` passou no commit:
`7ba078f38af381636db4120fb11a6b446f688637`.

Cache apos este pass:
- `marine-species.js?v=5`;
- `marine-renderer.js?v=7`.

Preservar sem redesign:
- `whiteSharkBoss`;
- `kraken`;
- `devourer`.


## 23. Habilidades por especie, raridade, filtros e bosses autoritativos - 2026-11-05

Esta secao complementa e prevalece sobre regras anteriores que tratavam as 100 especies apenas como passivos por familia.

### Paleta visual por especie

`public/marine-species.js` e a fonte canonica de identidade.
Cada especie possui:
- `art.key` unico;
- `art.tone`;
- `art.palette.base`;
- `art.palette.shadow`;
- `art.palette.rim`;
- `art.palette.glow`;
- `art.palette.accent`;
- `art.palette.eye`;
- `rarity` canonica.

A direcao anterior estritamente monocromatica foi substituida.
O renderer pode e deve usar gradientes internos para modelar volume, desde que sejam construidos a partir da paleta individual da especie e nao sejam a mesma vinheta generica aplicada a todas.

Regra visual:
- silhueta propria;
- cor-base propria;
- sombra propria;
- cor secundaria de contraste;
- glow localizado;
- assinatura biologica/fantastica unica.

Kraken Boss, Tubarao Boss e Devorador continuam como referencias de qualidade e nao devem ser redesenhados.

### Habilidades unicas das 100 especies

Novo modulo canonico:
`public/marine-abilities.js`

Ele define 100 perfis, um para cada `marine_*`.
Cada perfil possui:
- id de habilidade;
- titulo unico;
- tipo de geometria;
- cooldown;
- dano;
- raio;
- quantidade de feixes;
- raridade;
- cor;
- descricao.

Tipos atuais:
- dash;
- cone;
- aura;
- multi;
- lance;
- sweep;
- armor;
- pulse;
- chain;
- veil;
- mark;
- trap;
- pull;
- grasp;
- rage;
- blast;
- spines.

`public/game.js` executa essas habilidades automaticamente durante a partida.
Elas causam dano real via `dealEnemyDamage()`, portanto usam o fluxo autoritativo de dano online ja existente.
O mesmo evento envia `sendSkinAbility` para que outros clientes vejam o efeito.

Regra:
habilidade escrita sem efeito fisico e sem efeito visual e bug.

### Bosses que receberam mecanica autoritativa

Preservar visuais e mecanicas aprovadas de:
- `whiteSharkBoss`;
- `kraken`;
- `devourer`.

Os quatro bosses abaixo usam o renderer novo e agora tambem possuem habilidades fisicas no servidor:

`boss`
- `neuro-ring`;
- pulso neurotoxico radial;
- dano real + neurotoxina;
- telegraph vermelho/ciano.

`angler`
- `lure-pulse`;
- isca hipnotica;
- atracao fisica + dano;
- telegraph dourado e feixe da isca.

`maw`
- `gulper-chomp`;
- mordida/bolsa gular expansiva;
- dano radial;
- mandibula e onda violeta/magenta.

`leviathan`
- `pressure-lance`;
- onda de pressao linear;
- dano por geometria de segmento;
- feixes turquesa/vermelho.

Arquivos autoritativos:
- `world-simulation.js`;
- `server.js`;
- `public/online.js`;
- `public/game.js`.

O servidor transmite `boss-ability-visual` e `player-vitals` com `reason:'boss-ability'`.
Nao devolver esses danos ao cliente como logica local no multiplayer.

### Raridade canonica

Raridades de especies marinhas:
1. `common`;
2. `uncommon`;
3. `rare`;
4. `epic`;
5. `legendary`;
6. `mythic`.

A propriedade `species.rarity` e canonica.
`public/marine-abilities.js` deve consumi-la, nao manter classificacao concorrente.

Skins antigas usam `SHOP_SPECIAL_RARITY` em `public/game.js` enquanto nao forem migradas para um catalogo canonico proprio.

### Filtros da loja

A loja agora possui:
- busca textual;
- filtro de raridade;
- filtro de familia;
- filtro por possuido / nao possuido.

IDs:
- `shopSearchInput`;
- `shopRarityFilter`;
- `shopFamilyFilter`;
- `shopOwnershipFilter`;
- `shopFilterSummary`.

`renderShop()`:
- filtra antes de renderizar;
- ordena por raridade do menos raro ao mais raro;
- usa nome como desempate;
- mostra badge de raridade em cada card;
- exibe a descricao da habilidade unica para skins marinhas.

Nao voltar a renderizar `skinData` diretamente sem passar pelo filtro/ordenacao.

### Arquivos de estilo e cache

Assets apos este pass:
- `style.css?v=4.3.9`;
- `marine-species.js?v=7`;
- `marine-abilities.js?v=3`;
- `marine-renderer.js?v=8`;
- `abyssal-boss-renderer.js?v=3`;
- `game.js?v=4.4.15`;
- `online.js?v=4.4.3`.

Ao alterar qualquer um desses arquivos servidos diretamente, atualizar seu query-version correspondente.

### Testes novos/importantes

- `tests/marine-abilities-runtime.test.cjs`;
- `tests/marine-renderer-anatomy.test.cjs`;
- `tests/marine-species.test.cjs`;
- `tests/abyssal-boss-renderer.test.cjs`.

Protegem:
- 100 habilidades unicas;
- raridade;
- filtros;
- ordenacao;
- dano fisico;
- replicacao visual;
- habilidades de bosses;
- paletas completas;
- preservacao do trio aprovado;
- identidade de cor dos quatro bosses refeitos.

### Regra para agentes futuros

Nao simplificar por conveniencia:
- 100 especies para um unico bonus de familia;
- uma unica cor por familia;
- uma unica geometria de habilidade;
- efeitos apenas textuais;
- bosses apenas com descricao sem telegraph;
- loja sem ordenacao ou filtros.

Se uma nova especie for adicionada, ela exige no mesmo commit:
1. `art.key`;
2. paleta completa;
3. raridade;
4. habilidade;
5. efeito fisico;
6. efeito visual;
7. teste correspondente;
8. atualizacao deste handoff quando houver nova regra estrutural.


## 24. Coleções x famílias, economia por raridade, presença visual e pressão inimiga - 2026-11-05

Esta seção substitui qualquer interpretação anterior que tratava "Assinatura Abyssal" como família biológica exclusiva.

### Coleção e família são dimensões diferentes

A loja agora distingue:
- coleção;
- família biológica;
- raridade;
- tipo de desbloqueio.

`SKIN_TAXONOMY` em `public/game.js` é a fonte canônica para skins legadas.

Exemplos:
- Medusa-Coroa Violeta: família `jelly`, coleção `signature`;
- Lula-Vampira Carmesim: família `squid`, coleção `signature`;
- Manta do Nada: família `ray`, coleção `signature`;
- Peixe-Olho-de-Barril: família `fish`, coleção `signature`;
- Náutilo Soberano: família `mollusc`, coleção `signature`;
- Moréia Esmeralda Colossal: família `eel`, coleções `signature` e `mission`.

Uma skin pode e deve aparecer simultaneamente:
- em sua coleção;
- em sua família biológica.

Não voltar a um único campo de categoria mutuamente exclusivo.

### Missões e promoções

`greensnake` é recompensa de 100% de progressão:
- raridade `colossal`;
- `unlockType:'mission'`;
- não pode ser comprada por moedas ou Stripe;
- continua sendo concedida pela conclusão da progressão.

`electriceel`:
- coleção `promo`;
- desbloqueada por código;
- não deve aparecer como compra de 0 moedas.

Cards de missão e promoção exibem:
- RECOMPENSA DE MISSÃO;
- CÓDIGO PROMOCIONAL.

### Economia por raridade

Espécies marinhas usam economia canônica em `public/marine-species.js`.

Moedas-base antes dos ajustes por família/variante:
- common: 2.400;
- uncommon: 6.500;
- rare: 12.500;
- epic: 24.000;
- legendary: 42.000;
- mythic: 68.000.

Regra:
- common a epic: compra por moedas abissais;
- legendary e mythic: premium;
- skins de missão/evento podem ser high tier sem compra.

Premium marinho:
- legendary: R$ 9,90;
- mythic variante 8: R$ 14,90;
- mythic variante 9: R$ 19,90.

Skins legadas lendárias convertidas para premium:
- Náutilo Soberano: R$ 9,90;
- Lula-Vampira Carmesim: R$ 10,90;
- Peixe-Olho-de-Barril: R$ 11,90;
- Carcereiro das Fossas: R$ 12,90.

Os preços server-side e Stripe precisam permanecer alinhados com a UI.

### Presença visual das skins

`drawSkinPresenceAura()` aumenta presença visual por raridade:
- aura maior;
- glow mais forte;
- contorno energético;
- partículas orbitais nos tiers altos.

Aplicado:
- jogador local;
- jogadores remotos.

`renderMarineAbilityVisual()` amplia o efeito visual com base na raridade.
Violeta e Tóxica também receberam áreas, partículas e camadas visuais maiores.

Regra:
raridade alta precisa parecer visualmente rara em gameplay, não apenas no badge da loja.

### Inimigos mais ameaçadores

`drawEnemyThreatAura()`:
- inimigos comuns têm leitura de ameaça mais clara;
- elites recebem aura maior, brilho e partículas orbitais.

Pressão física foi fortalecida de forma espelhada em solo e servidor:
- comum: dano x1,07, velocidade x1,03;
- elite: dano x1,18, velocidade x1,08, HP x1,12.

Não aumentar hitbox como atalho de dificuldade.
Mudanças físicas futuras precisam permanecer iguais em `public/game.js` e `world-simulation.js`.

### Filtros da loja

A lista inclui agora:
- Coleção · Assinatura Abyssal;
- Coleção · Relíquias;
- Desbloqueadas por missão;
- Promocionais;
- todas as famílias biológicas.

A filtragem usa `skinShopCategories(skin)` e `categories.has(familyFilter)`.

### Testes

Atualizados/criados para proteger:
- coleções sem esconder família biológica;
- Assinatura Abyssal separada de Relíquias;
- Moréia Esmeralda como missão + colossal;
- escalada de preço por raridade;
- legendary/mythic premium;
- preços Stripe;
- efeitos passivos de raridade;
- pressão física equivalente entre solo e servidor.

CI:
- workflow `Abyssal checks v2`;
- job `syntax-and-tests` verde no commit `58995ce283f5c2ecad6971e33b2a6ae99e93cbf1`.

Cache atual:
- `style.css?v=4.3.10`;
- `marine-species.js?v=8`;
- `marine-abilities.js?v=3`;
- `marine-renderer.js?v=8`;
- `abyssal-boss-renderer.js?v=3`;
- `game.js?v=4.4.16`;
- `online.js?v=4.4.3`.


## 25. Rebuild visual por massa e expressão, não por detalhe superficial - 2026-11-05

Motivo:
- nova captura mostrou que as espécies marinhas ainda pareciam derivadas de um mesmo molde, apesar de já terem perfis de cor e detalhes próprios;
- o problema visual real estava na prioridade do renderer: corpo-base primeiro, pequenos detalhes depois;
- a referência canônica continua sendo a linguagem das Assinaturas Abyssal, Kraken Boss, Tubarão Boss e Devorador.

Correção aplicada em `public/marine-renderer.js`:
- novo `signatureMassPass()`;
- executado antes de `signatureArt()`;
- adiciona massa corporal, cabeça, olhos, boca, núcleo, coroas, espinhos, membranas, caudas e apêndices exagerados por família/variante;
- todas as 10 famílias passam pelo mass pass:
  - shark;
  - ray;
  - eel;
  - squid;
  - octopus;
  - jelly;
  - crustacean;
  - fish;
  - benthic;
  - mollusc.

Princípio:
- expressão e massa vêm antes de marcações decorativas;
- olhos e bocas devem ser legíveis em preview;
- silhueta deve continuar diferente mesmo em escala pequena;
- padrões luminosos entram depois da anatomia;
- se duas espécies da mesma família parecerem o mesmo corpo com cor diferente, isso é regressão.

Exemplos explícitos do novo pass:
- tubarão-raposa recebe lobo caudal exagerado;
- tubarão-duende recebe rostro frontal muito maior;
- tubarão-baleia recebe cabeça/massa frontal grande e pontos luminosos;
- peregrino recebe boca frontal muito maior;
- enguia-pelicano recebe massa de mandíbula/bolsa gular;
- lulas de braços longos recebem braços visivelmente desproporcionais;
- polvo de anéis azuis recebe anéis mais fortes sobre um manto mais presente;
- peixe-tripé recebe pernas/radios muito mais longos;
- crustáceos ganham carapaça, olhos duplos e apêndices/claws maiores conforme espécie;
- bentônicos e moluscos recebem núcleo/forma central mais forte e apêndices próprios.

Cor:
- `public/marine-species.js` agora gera paletas mais saturadas e contrastadas;
- base preserva mais o tom original;
- sombra ficou quase preta;
- rim light mais claro;
- glow mais saturado;
- accent usa uma segunda cor mais contrastante;
- não voltar para pastel lavado.

Preview:
- `renderCreaturePreview()` foi ampliado por família;
- espécies agora ocupam mais área do card, aproximando o peso visual das Assinaturas Abyssal.

Cache após este pass:
- `marine-species.js?v=9`;
- `marine-renderer.js?v=9`;
- `game.js?v=4.4.17`.

Testes:
- `tests/marine-renderer-anatomy.test.cjs` exige:
  - `signatureMassPass()`;
  - execução antes de `signatureArt()`;
  - todas as famílias cobertas;
  - marcadores explícitos de silhuetas exageradas;
  - escalas novas de preview;
  - versões atuais de cache.

Validação:
- workflow `Abyssal checks v2`;
- job `syntax-and-tests` concluiu com sucesso no commit `8bb03538e82d213928bb3caaa6738df72a384a39`.

Regra para futuros agentes:
- não resolver diferença entre espécies apenas com mais padrões, glow ou mudança de cor;
- primeiro alterar massa, cabeça, olhos, boca, apêndices, cauda e proporções;
- só depois aplicar assinatura cromática.
