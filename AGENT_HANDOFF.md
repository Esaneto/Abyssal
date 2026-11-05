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
