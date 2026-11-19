# Abyssal | Revisão obrigatória de alterações

> Leia [AGENTS.md](../AGENTS.md), [AGENT_FRAMEWORK.md](../AGENT_FRAMEWORK.md) e [AGENT_HANDOFF.md](../AGENT_HANDOFF.md) antes de criar o PR. Para menus, leia também [docs/DEEP_MENU_ARCHITECTURE.md](../docs/DEEP_MENU_ARCHITECTURE.md).

## Objetivo, escopo e impacto
<!-- Descreva concretamente a mudança e por que ela é necessária. -->

## Arquivos alterados e sistemas preservados
<!-- Relacione por que os arquivos foram alterados, o que foi mantido e o que foi removido. Confirme dependências e efeitos em Android/Windows/offline. -->

## Validação
- [ ] Código revisado, sem duplicar lógica de Solo/Online, loja, conta ou economia
- [ ] `npm test` e sintaxe JS executados, ou impedimento documentado
- [ ] Capturas reais PC e Android antes/depois anexadas quando houver mudança visual
- [ ] Interação validada com mouse, teclado, toque e botão Voltar
- [ ] Android em retrato e mudanças de orientação conferidos, sem elementos cortados
- [ ] Fluxos de conta, convidado, pesquisa, Armário, loja, cardumes e partida não regrediram
- [ ] FPS/memória/animadores aferidos, quando aplicável
- [ ] `public/offline-sw.js` atualizado se novos assets foram adicionados
- [ ] Nenhum modo futuro foi introduzido no HUD clássico
- [ ] Atualizei `AGENT_HANDOFF.md` com o que ficou pendente

## Contrato de direção artística, quando aplicável
- [ ] Menu continua sendo uma cabine **única, profunda e navegável**
- [ ] Escotilha permanece em primeiro plano; cápsulas laterais; Sonar menor e Pesquisa maior ao fundo
- [ ] Ressonância mantém aparência orgânica convincente, sem árvore genérica de linhas neon
- [ ] Os assets finais e a fidelity foram descritos sem exagero; mockups não são imagens do produto
- [ ] Arte aprovada visualmente, não apenas por testes automatizados

## Evidências e pendências
<!-- Links para screenshots reais, logs de testes, risco, rollback e aprovação. -->

**Não fazer merge nem deploy de alterações visuais ainda não aprovadas.**
