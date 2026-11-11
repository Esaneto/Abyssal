# Paridade funcional: Abyssal JavaScript x cliente Godot (2026-11-11)

## Princípio
Esta migração é restrita à **Cabine e ao Mar Aberto / exploração oceânica**. Shooter, Fossas, loja monetizada e PvP permanecem no cliente JS até fase própria. **Nunca descartar dados ou reescrever servidor Node.js/PostgreSQL para testar visual Godot.**

## Auditoria dos sistemas originais

| Mecânica | Fonte JS existente | Status Godot | Observações |
|---|---|---|---|
| Cabine e transição para expedição | `abyssal-submarine-cockpit.js`, `abyssal-exploration-runtime.js` | PARCIAL | Cabine funciona; L abre laboratório e Enter mergulha; demais estações de bordo ainda não migradas |
| Nado, inércia e colisão | `abyssal-ocean-geography.js`, `game.js` | PARCIAL | CharacterBody2D com arrasto/corrente, relevo, rochedos e 7 arcos navegáveis; ainda faltam cavernas ramificadas e toda a geografia original |
| Oxigênio/pressão/traje | `abyssal-exploration-config.js` | IMPLEMENTADO SOLO | Capacidade 300*(1+nível), limite 300+180*nível, consumo, refil na superfície e dano de pressão |
| Inventário/hotbar | `abyssal-inventory-ui.js` | PARCIAL | I, visual de itens e atalhos 1/2; ainda não há arrastar 9 slots, itens industriais ou arma |
| Depósitos de minerais/óleo/gás | `abyssal-resource-fields.js` | IMPLEMENTADO SOLO | Mesmos IDs, ferramentas, quantidade 1-3, duração 1,9s/2,6s e depósitos determinísticos por setor; posições e seed não são idênticos à geografia JS |
| Coleta e limites | `abyssal-resource-fields.js` | IMPLEMENTADO SOLO | Checagem de raio, ferramentas, estoque, consumo de depósito, não duplicação |
| Laboratório/equipamento | `abyssal-research-system.js`, `abyssal-exploration-config.js` | PARCIAL | Seis pesquisas de sobrevivência/reconhecimento; custos/limites/pré-requisitos compatíveis; habilidades, indústria e compras antigas fora desta etapa |
| Carta navegação/sonar | `abyssal-navigation-chart.js`, `abyssal-sonar-minimap.js` | PARCIAL | M, setores explorados e relevo, sonar da geometria nativa, zoom básico; ainda sem rotas, marcações manuais e todos os sensores |
| Fauna/observação | `abyssal-open-sea-ecology.js` | PARCIAL | Dez espécies reais com movimento estilizado, habitats e diário F/Tab; não espelha IA, predação nem criaturas originais da loja |
| Persistência Solo | `abyssal-exploration-runtime.js` (localStorage) | IMPLEMENTADO SOLO | Novo save nativo em `user://abyssal_native_exploration_v1.json` para itens, pesquisas, setores, observações, ferramenta, posição e horário |
| Persistência contas | `server.js`, `PostgreSQL` | **NÃO MIGRADO** | Nenhuma importação automática de dados JS, localStorage ou conta; save local nunca é prova de crédito ou recompensa online |
| Multiplayer cooperativo e PvP | `server.js`, `world-simulation.js` e Socket.IO | **NÃO MIGRADO** | Fase separada de adaptação de protocolo, autenticação e sincronização, sujeito à validação autoritativa |
| Android/Windows export | JavaScript/Capacitor | **NÃO VALIDADO** | Cliente nativo é importável e executa no Godot 4.7.2; build/teste em dispositivos ainda faltam |

## Fluxo jogável nativo
1. Na cabine, pressione **L** para abrir o laboratório. Seleção **1-6**, **R** para pesquisar com recursos possuídos. **Esc/L** fecha.
2. Pressione **Enter** para iniciar ou retomar a expedição. O ponto de retorno, o ciclo do sol e as descobertas são preservados localmente.
3. **WASD/setas** para nadar. Emergir para respirar. Ultrapassar limite do traje causa dano, como no jogo JS.
4. Aproxime-se do fundo ou rochedos para encontrar depósitos. Selecione **1** (picareta) para minérios ou **2** (cilindro reutilizável) para petróleo/gás. **Segure G** até a coleta terminar.
5. Pressione **I** para inventário, **M** para carta e **F** para observar animais ao alcance. **Tab** abre diário.
6. **Esc** devolve ao submarino e grava o checkpoint Solo; reabrir a versão Godot mantém o progresso.

## Mecanismos de segurança e qualidade
- A versão JS e o servidor Render permanecem inalterados.
- `scripts/ci_smoke.gd` valida cena/nado/escala mínima da fauna.
- `scripts/ci_functional_smoke.gd` exercita kit inicial, tool gating, coleta sem duplicata, cilindro reutilizável, seis sistemas de pesquisa, leitura/escrita do save, mapa/menus e passagens geológicas.
- `scripts/ci_capture.gd` captura imagens reais do Godot em Xvfb, incluindo cabine, laboratório, inventário, carta e profundezas.
- A velocidade de extração é medida em segundos, nunca em número de frames.
- Mundo gerado por proximidade e depósitos limitados a duas amostras por setor, sem alocar entidades para todo o mapa.
- A iluminação e a profundidade são simulações ludicamente inspiradas em oceanografia, não dados médicos ou um simulador de mergulho real.

## Itens ainda pendentes para equivalência completa
1. Autenticação e conexão de cliente Godot ao backend de contas e multiplayer, com avaliação técnica de Socket.IO versus WebSocket nativo.
2. Importação/associação de progressão do jogador autenticado, sem atribuir recursos falsos ao servidor.
3. Geografia procedimental completa da versão JS, corredores e cavernas conectadas, animais com evasão/IA.
4. Oficina completa, indústria offshore, inventário de nove slots e coleta com feedback artístico avançado.
5. UI nativa Android, acessibilidade, exportações, escala entre resoluções e medição de FPS por dispositivo.
6. Visuais 2.5D semirrealistas e recursos finais; o atual permanece deliberadamente um protótipo estilizado.
