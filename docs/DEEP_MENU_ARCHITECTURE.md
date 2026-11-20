# REVISÃO: 20/11/2026, A CABINE NÃO PODE SER UM PRINT
A referência fornecida pelo usuário é SOMENTE guia de composição, luz, proporções e linguagem visual. A camada fotográfica anterior reutilizava recortes da própria referência e ocultava renderizadores ativos, contrariando a exigência de uma interface verdadeira. O código agora carrega `public/abyssal-deep-menu-native.css` após a base/cinematic e não importa as camadas `reference.css` e `fidelity.css`. Cápsulas, visor de pesquisa, sonar e escotilha são objetos independentes, com câmera transform, CSS 2.5D, animações dessincronizadas e os sprites reais das bibliotecas do Abyssal. Não reintroduzir UI como plano de fundo.

# DEEP MENU 2.5D | ARQUITETURA, CONTINUIDADE E LIMITES

## Natureza da entrega
Primeira implementação do menu único com profundidade por camadas CSS e prévias Canvas. É implementação funcional/procedural em branch de desenvolvimento, não arte final ultrarrealista. Requer capturas reais e revisão antes do merge.

## Fluxos e responsabilidades
- Escotilha: abre escolha Solo ou Online. Solo só chama o playBtn original depois da animação. Online usa AbyssalOnline.connectAndJoin e aguarda abyssal-room-joined para disparar bolhas. Nunca simular handshake.
- Trajes: prévia Canvas usa AbyssalDiverArt e AbyssalAvatarBase; abertura via AbyssalCockpitNavigation.select('perfil') e routeCommand('wardrobe'). Salvar permanece no Armário.
- Ecos: prévia Canvas usa AbyssalMarineArt e AbyssalCuratedSkins; abertura via select('arsenal') e routeScreen('shopScreen'). Não compra e não concede.
- Sonar: select('social'), com funcionalidades reais de Cardumes, Ranking, Avisos e Roleta.
- Pesquisa: select('laboratorio'), com abas de Mergulhador, Submarino e Ressonância.
- Conta e ajustes: usam as rotas anteriores do cockpit.

## Estado visual
overview -> aproximação por foco -> detalhe. Escape/Voltar -> overview. Hatch: overview -> escolha de modo -> destravamento/descida -> gameplay. A transição flutua sobre body, não depende de a cabine permanecer visível ao iniciar a partida.

## Compatibilidade
A navegação exterior antiga, seus IDs e componentes permanecem temporariamente no código como pontes para login, testes e inicialização. Não aparecem como segundo menu normal. Não remover sem auditoria das referências de scripts, eventos, cache, Android e Windows.

## Limitações conhecidas
- Câmera e escotilha em CSS 2.5D; realismo fotográfico requer texturas/arte em camadas aprovadas, iluminação e oclusão mais detalhadas.
- É necessária execução em navegador e APK para comparar enquadramentos e evitar colisão com regras CSS legadas.
- Ainda não há certificação de desempenho/CI, nem aprovação visual final da Ressonância.
- O projeto mantém a árvore antiga funcional; não improvisar tentáculos SVG genéricos em seu lugar.

## Critérios para promoção à main
1. Validar Node syntax-check, npm test e capturas reais do novo menu PC/Android.
2. Abrir e fechar cada sistema sem perder dados, foco, estado ou render.
3. Confirmar fluxo Solo/Online, incluindo erro de conexão e room-joined.
4. Confirmar que a aparência da cápsula não salva automaticamente e os Ecos não alteram saldo.
5. Conferir update-manager, service worker e testadores Play.
6. Revisar Diff e aprovar a arte final.
