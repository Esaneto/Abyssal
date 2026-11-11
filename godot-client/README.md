# Abyssal | Exploracao Oceanica em Godot 4

Cliente nativo de testes, em desenvolvimento junto da versao JavaScript. O jogo HTML/JS e o servidor Node.js + PostgreSQL continuam intactos.

## Abrir no Godot 4.7.2 (Windows)
1. Baixe o repositorio atualizado da branch `feat/godot-functional-exploration-parity-20261111` (ou da `main`, depois do merge).
2. Importe `godot-client/project.godot` no Gerenciador de Projetos.
3. Pressione **F5**.

## Controles da Cabine
- **Enter**: entrar/retomar a expedicao
- **L**: abrir/fechar o laboratorio de pesquisas
- **1-6** (com laboratorio aberto): selecionar a tecnologia
- **R**: pesquisar a tecnologia selecionada, se tiver os recursos
- **Esc**: fechar o laboratorio

## Controles do Mar Aberto
- **WASD/setas**: nadar, com arrasto, inercia, corrente e flutuabilidade
- **1**: equipar picareta | **2**: equipar cilindro de amostra reutilizavel
- **Segurar G**: minerar/coletar em depositos proximos (1,9s para minerios, 2,6s para amostras)
- **I**: inventario de exploracao
- **M**: carta de navegacao e setores explorados
- **F**: registrar a fauna mais proxima
- **Tab**: diario de campo, com todas as especies ja registradas recuperadas do save
- **J / K** (diario aberto): consultar o registro anterior / seguinte e seus habitats
- **Esc**: voltar ao submarino e salvar ponto atual

## Paridade implementada nesta etapa
- Fundo e rochas colidiveis em um Mar Aberto de 24.000 x 21.000 unidades
- Sete arcos de pedra navegaveis com geometria visual/colisao/sonar coincidente
- Ciclo de dia/noite, luz dependente de profundidade, sedimentos e algas animadas
- Materiais nativos texturizados por ruido procedural, estratos em rochas/arcos e distancia atmosferica em camadas
- Cabine panoramica com metal, reflexos, lampadas localizadas e piloto de costas equipado com cilindro
- Mergulhador com traje segmentado, nadadeiras articuladas e mascara, sem arma; HUD reposicionado sem sobreposicao de atalhos
- Fauna inspirada em animais reais com escala minima de 40% do mergulhador
- Inventario de minerios, amostras, picareta e cilindro, com coleta validada localmente
- Pesquisas nativas para oxigenio, traje de pressao, lampada, salvamento, amostrador e sonar
- Persistencia **offline do Godot** em `user://abyssal_native_exploration_v1.json` para itens, tecnologias, fauna, mapa, posicao e hora do dia
- Sonar e carta com terreno e exploracao de setores

**Nao e uma migracao de contas nem do multiplayer.** Os dados do Godot sao locais e NAO sao creditados ao servidor Render. Shooter, Fossas, lojas antigas e PvP permanecem fora deste cliente por decisao de escopo.

## Validacao
O workflow `.github/workflows/godot-native-smoke.yml` usa Godot 4.7.2. Ele valida cena, fisica, ferramentas, extracao temporizada, projetos do laboratorio, dados salvos, carta e colisoes dos arcos. Imagens reais sao capturadas sob Xvfb e salvas como artefatos do GitHub Actions.

Veja [paridade funcional e itens pendentes](docs/PARIDADE_FUNCIONAL.md) e [direcao artistica](docs/DIRECAO_ARTISTICA.md).

## Nova direcao visual em codigo nativo
A referencia de Mar Aberto foi convertida em elementos autonomos, nao uma imagem colada sobre o jogo:
- Agua e relevo distante em camadas dinamicas, com cor e luz dependentes da profundidade e do horario.
- Recifes de plataforma continental com poligonos fisicos iguais aos contornos desenhados, corais e cristais.
- Vegetacao, peixes, tartarugas e raias com movimento independente; luz direcional acompanha o mergulhador.
- HUD com estado real do jogador e nove itens do inventario local; somente 1 (picareta) e 2 (cilindro) sao equipaveis.
- Ponte de comando com janelas panoramicas, navegadora em sprite SVG original, tela central e seis areas clicaveis.
- Loja e Fossas aparecem como destinos da versao web, sem funcoes falsas no Godot. Mar Aberto e Laboratorio operam.
- Os screenshots do teste automatizado sao capturas do proprio Godot, nao mockups estaticos.

Arquivos centrais: scripts/native_cabin_art.gd, scripts/native_reef_art.gd, scripts/native_ocean_hud.gd, scripts/ui_art_primitives.gd e assets/art/cabin_navigator.svg.

O estilo e 2D ilustrado/2.5D. O acabamento permanece inferior ao conceito promocional e precisa de avaliacao artistica e FPS nos dispositivos finais.
