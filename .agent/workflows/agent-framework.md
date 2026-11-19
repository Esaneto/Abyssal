# Workflow permanente: ABYSSAL AGENT FRAMEWORK

Este fluxo deve ser executado por cada novo agente antes de alterar o Abyssal.

1. Leia `AGENTS.md`, `AGENT_FRAMEWORK.md`, `AGENT_HANDOFF.md`, `docs/DEEP_MENU_ARCHITECTURE.md` e `.agent/rules/GEMINI.md`.
2. Verifique a `main`, a branch atual e a lista de arquivos alterados. Não presuma que tarefas anteriores foram concluídas.
3. Identifique e documente funções ativas, testes existentes, dependências e se a alteração afeta Solo/Online/Android/Windows/service worker.
4. Resuma a direção artística que será preservada e quais partes do código não devem ser tocadas.
5. Crie branch dedicada. Implemente em etapas pequenas, sem substituir funcionalidades reais por placeholders.
6. Rode `npm test`, verifique sintaxe, CI, screenshots reais e os fluxos modificados. Evite "consertar" testes antigos apagando a cobertura: substitua as verificações com equivalentes do novo fluxo.
7. Atualize `AGENT_HANDOFF.md` listando commits, comportamento comprovado, falhas, pendências, assets e passos de reversão.
8. Não faça merge na `main` sem validação funcional e aprovação visual da direção artística.

## Atenção especial à interface
O menu principal é um interior de submarino 2.5D com câmera em profundidade. Ao centro, em primeiro plano, escotilha cinematográfica com escolha Solo/Online. À esquerda, cápsula de trajes reais; à direita, cápsula de Ecos; ao fundo, 25% Sonar Social e 75% Pesquisa. A Ressonância deve ser um organismo biológico convincente com tentáculos, não um desenho genérico com linhas.

**Checklist de passagem:** branch/commit | testes reais | screenshot PC | screenshot Android | fluxos preservados | erros conhecidos | estado do deploy | próximos passos.

Se não conseguir comprovar o funcionamento, registre explicitamente como pendente.
