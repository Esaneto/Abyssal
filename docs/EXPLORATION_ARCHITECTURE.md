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

## Estado de implementação nesta fase

CONCLUÍDO NO CÓDIGO:
- Novo menu e painel informativo do submarino, sem trocar rotas de login,
  pagamento e partida.
- Definições compartilhadas e configuráveis de oceanografia simplificada,
  habitats, materiais, equipamentos, Q/E e passivas.
- Motor puro de pesquisa, com validação de custo/pré-requisito e migração
  que NÃO altera perfis automaticamente.

NÃO CONCLUÍDO / NÃO ANUNCIAR COMO JOGÁVEL:
- Mundo persistente aberto no lugar da antiga arena, regiões visitáveis,
  fauna ecológica no Mar Aberto, coleta de materiais, naufrágios, cavernas.
- HUD e consumo de gás/pressão integrados ao loop de simulação e ao servidor.
- Oficina, inventário persistido, compra de pesquisa/recursos no servidor.
- Remoção das habilidades vendidas na loja e bloqueio da Ressonância.
- Radar, sonar e progressão de Fossas, novas recompensas por enciclopédia.
- Sincronização dos cardumes e recursos no multiplayer.
- Testes de navegador/mobile e partidas integradas após deploy.

## Critérios para ativar a próxima migração

- Iniciar por coleta + inventário autoritativos (solo e online).
- Persistir `resourceInventory` e `researchLevels` com testes de compras
  simultâneas, reconexão e reentrada na conta.
- Migrar `metaUpgrades` preservando o direito de uso de upgrades já comprados.
- Somente depois tornar `pulse` e `dash` estudos no laboratório e retirar
  suas vendas antigas, bloqueando na Ressonância apenas os não pesquisados.
- Ativar sistemas de pressão/oxigênio no cliente E no servidor com valores
  idênticos, e uma forma confiável de retornar à base.
- Testar PC/mobile, solo/online, Fossas, PvP, downloads e publicação no Render.
