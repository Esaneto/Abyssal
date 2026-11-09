# Abyssal: arquitetura de exploração (2026-11-09)

## Objetivo

Separar a exploração submarina das mecânicas antigas de arena/compras sem apagar
contas, PostgreSQL, Stripe, moedas, skins ou o PvP. Documento-fonte do usuário:
"ABYSSAL — TRANSFORMAÇÃO COMPLETA DO MENU E DA EXPERIÊNCIA DE JOGO".

## Componentes criados

- `public/abyssal-exploration-config.js`: parâmetros e definições imutáveis de
  modos, habitats, recursos, pesquisa e física simplificada de gás/pressão.
- `public/abyssal-research-system.js`: transações puras de estudo, escalonamento
  de custos, condições de acesso e migração segura de habilidades adquiridas.
- `public/abyssal-expedition-hub.js` + CSS: nova entrada visual com Solo e Online
  à esquerda, prévia do Mar Aberto à direita e acesso à base. Preserva handlers
  existentes, diálogos das Fossas e PvP na navegação online.
- `tests/exploration-config.test.js`, `tests/research-system.test.js`:
  regressões de configuração, pré-requisitos e preservação das compras.

## Regras de manutenção

1. Modificar nomes, habitat, raridade, custo, equipamento ou requisito em
   `abyssal-exploration-config.js` antes de alterar qualquer interface.
2. Não duplicar fórmulas em `game.js` e `server.js`. Ambos devem importar o mesmo
   módulo da pasta `public` (UMD/CommonJS).
3. Operações com materiais, recompensas e pesquisa no modo Online DEVEM ser
   transações autoritativas do servidor, persistidas no perfil. Nunca confiar
   num inventário informado pelo cliente.
4. Nunca subtrair compras anteriores de `metaUpgrades`: usar
   `AbyssalResearchSystem.migrateLegacy(levels,metaUpgrades)` ao migrar.
5. Q/E (pulse/dash) e habilidades passivas devem ser desbloqueadas via pesquisa,
   mas só desativar a compra antiga e restringir Ressonância DEPOIS que o
   sistema de coleta e o desbloqueio autoritativo estiverem operacionais.
6. Separar modos: Solo e Online compartilham regras de Mar Aberto; Fossas são
   uma expedição distinta; PvP não depende de coleta ou necessidades vitais.
7. A exibição de fauna no MENU é apenas ambientação. Ela não é evidência de
   implementação de habitats, migrações, cardumes ou IA em partidas reais.
8. A fórmula `pressureAt(depth)=1+depth/10` aproxima pressão ABSOLUTA em
   atmosferas. O limite de profundidade do traje é uma regra separada; a
   fórmula não simula descompressão, pressão parcial de gases nem toxicidade.
9. Evitar remover `world-audio.js`, menu JS antigo ou códigos de compras só
   porque não estejam carregados: verificar todas as importações e usuários
   antes de excluir arquivos ou dados.

## Implementado nesta migração

**Código integrado na main (ainda sujeito a testes completos de jogo):**
- Menu principal: expedições Solo/Online à esquerda, Mar Aberto com cenário
  decorativo à direita e painel de operação do submarino.
- Tecnologias configuradas em `abyssal-exploration-config.js`; laboratório
  com custos, requisitos, ferramentas, traje, oxigênio, Q/E e Ressonância.
- `abyssal-resource-fields.js`: depósitos determinísticos por bioma, coleta
  por aproximação G, recompensa autoritativa no modo Online e cache local Solo.
- `server.js`: inventário `resourceInventory` e tecnologias `researchLevels`
  na conta, estudo validado pelo servidor, eventos de coleta sincronizados.
- Vida marinha com biomas reais do jogo `abyssal-open-sea-ecology.js`:
  recife, algas, rochas, cânion, fundo profundo e destroços, decisões
  agressivo/passivo/inteligente em Solo/Online e espécie visual compatível.
- `abyssal-open-sea-render.js`: corais, florestas de algas, relevo e
  silhueta de naufrágio ancorados no mapa, com descarte fora da câmera.
- Oxigênio e pressão: indicadores visuais; solo calculado no navegador e
  online no servidor; o PvP fica isento.
- Laboratório: compra de habilidades por moedas desativada, presets PvE
  sujeitos a estudo, PvP mantido, compras antigas migradas.
- Pets do mergulhador fazem sonar não ofensivo no Mar Aberto, mantendo
  habilidades antigas em Fossas/PvP por compatibilidade.
- Espécies avistadas no Mar Aberto: registro de descobertas, com amostras
  e recompensa por múltiplos registros válidos no modo online.
- Fossas: sinalização de salas e anomalias no sonar da expedição.

## Limitações reais e passos ainda necessários

- A geometria do Mar Aberto ainda é baseada no campo existente de 4800x3000.
  Há novos habitats e marcos, mas não um oceano infinito com streaming de
  regiões, cavernas inteiramente exploráveis e ciclo de dia/noite.
- O **Solo offline** conserva recursos e pesquisas no armazenamento local.
  O **Online** persiste esses dados no servidor/PostgreSQL. Falta unificar o
  inventário das expedições Solo autenticadas com o inventário online de
  maneira segura, sem confiar em eventos simulados pelo cliente.
- O inventário de laboratório inclui ferramentas, cilindros e trajes, mas
  precisa de uma oficina/árvore de equipamentos visual mais extensa e de
  melhorias de navegação e suporte.
- O PvP é preservado. Ele ainda utiliza os sistemas legados de combate.
- O servidor simula pressão e reserva de gás com aproximação simplificada.
  Não é uma simulação real de descompressão, toxicidade de gases ou narcose.
- O sonar nas Fossas mostra salas e anomalias. Um mapa interativo completo,
  rotas personalizadas e investigação de sinais desconhecidos ainda faltam.
- O mar agora seleciona espécies por habitat. Cadeias alimentares, cardumes
  coordenados, migrações, gigantes pacíficos e relações ecológicas complexas
  continuam incompletas.
- Não houve testes reais em navegador desktop, mobile, partidas cooperativas,
  reconexão após deploy, checkout Stripe ou benchmark confiável de 60 FPS.
- Há testes de regressão adicionados ao repositório, mas não executados
  num checkout completo nesta sessão.
- Auditar o custo de CPU, sincronização da coleta em reconexão e migração de
  contas em produção antes de considerar o sistema pronto para lançamento.

## Próximos critérios de aceite

1. Rodar `npm test` e testes de navegador/Android para todos os fluxos.
2. Unificar persistência do Solo autenticado com operações seguras no servidor.
3. Validar que nenhum recurso nasce dentro de rochas/cavernas inacessíveis.
4. Criar streaming de mapa e landmarks interativos sem aumentar o lag.
5. Completar biologia da fauna (cardumes/predadores/gigantes), sonar e oficina.
6. Medir FPS, CPU, perda de pacotes e reconexões em salas cooperativas.
