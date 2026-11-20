# ABYSSAL | AGENT FRAMEWORK (CONTRATO PERMANENTE)
Atualizado em 19/11/2026. Este arquivo define a direção artística e os critérios de integração para todos os próximos agentes.

## Visão aprovada
- Um único menu principal: interior de submarino 2.5D em perspectiva profunda com aproximação de câmera ao selecionar equipamentos. Não criar um segundo menu exterior, menu lateral ou cinco páginas com a mesma janela central.
- Escotilha no piso e primeiro plano: estrutura industrial com textura, travas, abertura mecânica e transição contínua de câmera, bolhas e passagem para a partida. Escolher Solo/Online antes da cutscene. Online depende de ingresso real na sala.
- Cápsula esquerda: trajes reais do mergulhador com inspeção e movimento próprios. O clique leva ao Armário existente. Preview não salva.
- Cápsula direita: Ecos reais do catálogo, contenção e nado de acordo com a espécie. O clique leva à Loja existente. Preview não concede itens.
- Central ao fundo: sonar social circular com cerca de 25% da largura, monitor de Pesquisa com cerca de 75%. Sonar abre Cardumes, Ranking, Avisos e Roleta. Pesquisa abre Mergulhador, Submarino e Ressonância.
- Ressonância: organismo abissal com anatomia volumétrica, núcleo, ramificações assimétricas, tentáculos com espessura e ventosas coerentes. Proibido substituir por curvas de brilho, tentáculos repetidos ou grid de cartões.
- Paleta: metal escuro, vidro espesso, iluminação ciano motivada, detalhes âmbar, sombras físicas. Sem painéis HTML genéricos no lugar de arte final.

## Código e propriedade
- public/abyssal-deep-menu.js: ambiente, câmera, prévias e cutscene, exclusivamente apresentação.
- public/abyssal-deep-menu.css: responsividade, hit targets e transições.
- public/abyssal-exploration-runtime.js: navegação e pesquisa já existentes; fonte única das rotas.
- public/game.js e public/online.js: Solo/Online reais. O servidor continua autoridade online.
- public/avatar-wardrobe.js e public/diver-art.js: aparência e render do mergulhador.
- public/marine-art.js e public/abyssal-curated-skins.js: espécies reais.
- public/offline-sw.js: atualizar cache sempre que incluir scripts/assets.
Não duplicar login, comércio, habilidades, economia, matchmaking ou persistência.

## Etapas obrigatórias de qualquer mudança
1. Ler AGENTS.md, AGENT_FRAMEWORK.md, docs/DEEP_MENU_ARCHITECTURE.md e .agent/rules/GEMINI.md.
2. Auditar o código ativo e mapear dependências de cada alteração, inclusive Android, Windows e cache offline.
3. Criar branch a partir da main estável, sem alterar produção diretamente.
4. Criar composição visual, preferencialmente sobre captura real do jogo, e aprovar silhueta, enquadramento e proporções antes de programar a arte.
5. Implementar em mudanças pequenas e testáveis. Preservar os sistemas vivos.
6. Verificar PC 1440x900 e 1366x768, Android vertical 390x844 e 360x800, safe areas, teclado, toque e Escape/Voltar.
7. Testar convidado, login, Solo, salas Online, loja, compras, Armário sem salvar, Pesquisa, Ressonância, Sonar e retorno da partida.
8. Respeitar prefers-reduced-motion e reduzir animações fora da tela. Não alegar ganho de FPS sem medição.
9. Remover código substituído somente após rastrear referências e ter cobertura; preservar pontes de compatibilidade quando ainda necessárias.
10. Atualizar AGENT_HANDOFF.md com estado implementado/validado/pendente, riscos, reversão e diferenças visuais não resolvidas.

## Definition of Done
- Evidência de capturas REAIS antes/depois em PC e Android, não somente layouts imaginados.
- Node syntax-check, npm test, testes de integração pertinentes, inspeção do diff e service worker coerente.
- Nomear explicitamente testes não executados, falhas preexistentes e limitações de fidelidade visual.
- PR com changelog e aprovação do resultado visual antes do merge na main.
- Declarar quais arquivos foram removidos, quais foram mantidos e por qual motivo. Não afirmar deploy publicado sem verificar.
- Se a arte for procedural ou simplificada, registrar que NÃO é ultrarrealismo final.

## Regra de continuidade
Todo novo agente começa lendo este documento e deve responder primeiro: estado de branch; funções atuais; riscos; arquivos que alterará; testes previstos. Nenhuma nova camada genérica de CSS ou redesign amplo sem uma referência aprovada.


## Arte aprovada: hub fotográfico e painéis animados (20/11/2026)
A **imagem fornecida pelo usuário**, com escotilha central iluminada, cápsula de trajes à esquerda, cápsula de Ecos à direita, Pesquisa e Social ao fundo, é a referência visual vinculante do menu. NÃO reproduzir a cabine por blocos CSS geométricos se as imagens reais já estiverem disponíveis.

Implementação a preservar:
- \`public/abyssal-hub-room.webp\`: fotografia de fundo sem os cinco painéis; a arte mantém perspectivas, iluminação e equipamentos
- \`public/abyssal-hub-panel-{dive,research,social,wardrobe,ecos}.webp\`: cinco painéis independentes, com imagens e texto originais, clicáveis por hit targets da cabine
- \`public/abyssal-deep-menu-reference.css\`: layout fiel da imagem para desktop e paisagem; usa \`deep-art-ready\` somente após carregamento de TODOS os assets
- \`public/abyssal-deep-menu-fidelity.css\` e \`public/abyssal-hub-room-plate.avif\`: fallback fotográfico e composição própria de tela vertical sem distorcer os personagens
- \`public/abyssal-deep-menu-cinematic.css\`: animações, materiais/efeitos procedurais de fallback
- \`public/abyssal-deep-menu.js\`: ações reais de jogo; não reimplementar economia, perfil, loja, autenticação ou sessão

Os painéis devem flutuar suavemente, **cada um com duração e fase diferentes**, com \`transform:translate3d\`, e não animação de \`top/left\`; em reduced motion não devem animar. A animação da escotilha/cutscene deve iniciar Solo real ou Online real, nunca simular uma partida.

**Aceitação visual:** comparar capturas reais de \`deep-ui-after-desktop-cabine.png\` e \`deep-ui-after-mobile-cabine.png\` com a imagem do usuário; conferir sobreposição, corte, vídeo/canvas, botões Solo e Online, ajustes, perfil e navegação. Se não for tão fiel quanto o cenário aprovado, a implementação ainda não está pronta.
