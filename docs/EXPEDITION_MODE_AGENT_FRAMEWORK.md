# ABYSSAL | Framework de Continuidade do novo modo EXPEDIÇÃO

**Status em 21/11/2026: SOMENTE PROJETO, NÃO IMPLEMENTADO.**
**Origem:** pedido explícito do usuário nesta conversa, após o rollback para AAB 3857 (3.6.143) e as correções posteriores da IA dos Ecos.
**Objetivo deste documento:** preservar decisões, requisitos, riscos e roteiro de execução para o próximo agente, sem iniciar o desenvolvimento do modo.
**Repositório:** Esaneto/Abyssal. **Branch principal de referência neste levantamento:** 400c57148be542a78c1d5d6150cb2ddaf586d45c.
**ATENÇÃO:** atualizar a leitura da main antes de implementar; a SHA acima identifica apenas o momento do levantamento.

## 0. Ordem imediata para qualquer agente que assumir

1. **NÃO criar o modo, telas, spawns, IA ou assets até o usuário autorizar explicitamente a implementação.** Esta tarefa é apenas documentação, planejamento e esboço.
2. Ler este arquivo inteiro, AGENTS.md, .agent/rules/GEMINI.md e .agent/workflows/feature-development.md.
3. Não confundir o novo botão EXPEDIÇÃO com o termo legado "Expedição" usado por Fossas/descida abissal. O novo modo terá identidade e identificador internos separados. Os modos existentes não devem ser apagados.
4. Fazer auditoria da main atual antes de planejar commits. Não presumir que a VPS, o navegador em cache ou o AAB Play Store estejam na mesma versão da main.
5. Distinguir **REQUISITO DO USUÁRIO** de **PROPOSTA DE DESIGN** e **DECISÃO EM ABERTO**. Não transformar proposta em regra aprovada sem alinhamento.
6. Nunca sacrificar responsividade, estabilidade da IA, paridade Solo/Online, registros do usuário, economia ou o desempenho mobile.

## 1. Visão geral, requisito do usuário

Adicionar, no menu de Mergulho, um terceiro botão **Expedição** abaixo de **Solo** e **Online**. Selecioná-lo abre uma sala de preparação para **quatro papéis exclusivos**: Capitão, Engenheiro, Defensor e Explorador. O padrão quando há apenas um humano é **1 jogador + 3 bots**, mas até quatro humanos podem preencher as vagas. Os bots ocupam funções não preenchidas.

A partida começa no **submarino**, usa como base **o mapa do modo Solo clássico e suas rochas**, mantém o mapa original no centro e cria uma vasta expansão periférica dividida em biomas distintos. Há grandes cavernas de entrada estreita, vórtices geradores de monstros, escuridão forte dentro das cavernas, objetivos aleatórios e NPCs com comportamento condicionado a campo visual. A expedição é fechada para novos integrantes após iniciar.

**Acordo de escopo:** modo novo e independente, não uma substituição de Solo ou Online existente.

## 2. Contrato de navegação, lobby e bloqueios

### Requisitos definidos

- Terceiro botão "Expedição" abaixo dos botões "Solo / Online" no menu de mergulho, mantendo identidade visual da cabine.
- Ao clicar, abrir **lobby de seleção de função e participantes**, sem iniciar imediatamente a partida.
- Equipe com exatamente 4 funções: Capitão, Engenheiro, Defensor, Explorador.
- Um papel não pode ser escolhido por duas pessoas. A reserva/confirmacão precisa ser atômica e validada pelo servidor.
- O jogador escolhe livremente uma vaga ainda disponível.
- **Após confirmar a função, não pode trocar dentro da mesma sala.**
- Jogadores podem convidar pessoas e preencher vagas com bots antes da partida.
- No lançamento da expedição, bots assumem as funções restantes automaticamente.
- **Após iniciar a exploração, nenhuma pessoa nova pode entrar na sala.**
- Padrão 1 jogador + 3 bots, e escala até 4 jogadores reais.

### Propostas de UX, não aprovadas como obrigatórias

- Lobby com quatro cartões de papel, status "Livre", "Reservado", "Confirmado" ou "Bot"; prévia de habilidades; cópia de convite para jogadores reais.
- Host/Capitão exibe "Iniciar expedição" quando condições de início forem válidas; caso Capitão seja bot, o host ainda inicia, mas a seleção de missões fica com IA.
- Reingresso apenas para **o mesmo participante previamente confirmado** após desconexão, sem admitir uma quinta identidade. Essa exceção é **decisão em aberto**, pois "ninguém mais pode entrar" não esclarece reconexão.
- Antes do início, vaga desocupada por jogador que saiu pode ser liberada para outro participante, mas o jogador que confirmou e permaneceu não troca de papel. Decisão em aberto.

### Segurança e estado de sala

Estados sugeridos: LOBBY -> READY -> LOCKED/RUNNING -> ENDED -> ARCHIVED.
Garantir idempotência no início e lock de participantes/funções no servidor. Validar tipo de sala, senha/convite, permissões, reconexão, limite e duplicidade. Não confiar em seleção de papel enviada sem conferência de servidor. A apresentação da UI deve ser acessível no Android vertical, desktop e teclado.

## 3. Quatro papéis e permissões exclusivas

| Função | Jogador humano | Comportamento do bot |
| --- | --- | --- |
| **Capitão** | Único que pode controlar/mover o submarino. Pode entrar e sair. Aproxima-se do submarino para visualizar 3 missões e recompensas; escolhe a missão do grupo. | Fica no submarino, conduz a embarcação e recebe/seleciona missões, coordenando deslocamento em favor da missão ativa. |
| **Engenheiro** | Único autorizado a reparar as seções danificadas do submarino. Pode embarcar apenas como passageiro. | Fica próximo do submarino, o protege e inicia reparos quando **qualquer seção cair abaixo de 60% da vida**, mantendo autoproteção. |
| **Defensor** | Pode usar uma habilidade exclusiva para **atrair inimigos dentro do seu raio/campo de visão**. Não controla nem repara o submarino. Pode ser passageiro. | Defende submarino e equipe, usa provocação/atração para desviar ameaças do casco e ajuda a missão sem abandonar proteção. |
| **Explorador** | Único que pode equipar e usar o **propulsor na tecla E**. Pode embarcar apenas como passageiro. | Percorre áreas ainda desconhecidas e revela o mapa, usa o propulsor sempre que possível; depois que o mapa estiver explorado, retorna para proteger o submarino. |

**Exclusividade:** nem dano, nem talento, nem cosmético substituem a permissão de uma função. Somente Engenheiro repara; somente Capitão pilota; somente Defensor possui habilidade de atrair; somente Explorador possui propulsor nesse modo.

**Destruição do submarino:** todos os ocupantes humanos ou bots são imediatamente **expulsos para fora do casco**. Definir posições seguras de expulsão, evitando nascer dentro de rocha. Efeitos de dano, derrota e ressurgimento de jogadores ainda não foram definidos pelo usuário.

**O defensor não deve provocar através de pedras**, caso a regra adotada seja "inimigos no campo de visão". A habilidade pode forçar mudança de prioridade somente entre monstros que atendam aos critérios espaciais e de linha de visão.

**Bots:** cada bot inicia com **um disparo aleatório, uma habilidade passiva aleatória e uma melhoria aleatória**; aparência e cosméticos também aleatórios. Recomenda-se gerar equipamentos por seed da sala no início, com opções válidas do catálogo do jogo, sem itens duplicados/sistemas futuros e sem permitir reroll infinito em busca de vantagens. Os números de balanceamento ficam para etapa futura.

### Prioridades dos bots, proposta de árvore de decisão

- Comum a todos: sobreviver, não atravessar rochas, não oscilar entre alvos por tick, cumprir regras exclusivas de função.
- Capitão: manter controle do submarino > segurança de rota > oferecer e selecionar missão > navegar até área de objetivo.
- Engenheiro: reparar seção abaixo de 60% > afastar ameaça imediata ao casco > apoiar missão dentro de sua zona de proteção.
- Defensor: atrair ameaças elegíveis > defender jogadores/submarino > apoiar missão sem se afastar além do limite defensivo.
- Explorador: reconhecer áreas ainda ocultas > apoiar missão próxima se compatível > ao revelar todo o mapa, defender submarino.
- Todos colaboram com o objetivo selecionado **sem abandonar a responsabilidade principal**; não usar conhecimento de mapa oculto ou teleporte indevido.

## 4. Mapa e biomas

### Requisitos definidos

- Base: rochas, colisões, mapa e estilo do **SOLO clássico**, preservando a região antiga **intacta e central** no novo mapa.
- Expandir o mapa "2x em todas as direções"; áreas expandidas recebem biomas distintos.
- Cada bioma tem vegetação **diferente sobre as pedras**, textura/fundo de personalidade própria e **transições suaves**, sem bordas bruscas ou imagens coladas.
- Cavernas grandes, predominantemente com **uma única entrada estreita**, corredor de acesso, câmara interna e **vórtice no fundo**.
- Maioria dos spawns de monstros fica em cavernas. Os inimigos nascem no vórtice e seguem para caçar o jogador, sujeitos ao campo de visão.
- A caverna é MUITO ESCURA. A lanterna é necessária para enxergar seu interior; oculta-se o cenário além da área efetivamente iluminada.

### Ambiguidade matemática a resolver, sem modificar o requisito

O mapa clássico usa a base **4800 x 3000 unidades** na configuração compartilhada do inimigo. A frase "2x em todas as direções" admite, pelo menos, dois cálculos:

- **Opção A, duplicar dimensões finais:** largura 9600, altura 6000, área 4x. Manter o 4800x3000 original central; sobram bandas laterais e superior/inferior.
- **Opção B, acrescentar dois mapas originais em CADA lado:** largura 24000, altura 15000, área 25x. O mapa original permanece central com extensões enormes.

Nenhuma opção está aprovada. **Perguntar uma única vez antes do desenvolvimento do gerador.** A opção A exige menos recursos; a B respeita uma leitura literal de "2x para cada direção" e exige streaming/agendamento de entidades bem mais rigorosos.

### Biomas sugeridos somente para visualização

Esboço em grade 3x3, **não em escala**:

| Noroeste | Norte | Nordeste |
| --- | --- | --- |
| Cânions Escuros | Jardins Bioluminescentes | Floresta Coralina |
| Recifes Negros (Oeste) | **SOLO ORIGINAL + SUBMARINO** | Floresta de Algas (Leste) |
| Cristais Abissais (Sudoeste) | Fendas Hadais (Sul) | Fumarolas (Sudeste) |

Os oito nomes periféricos são **propostos**, não aprovados. As plantas devem variar por silhueta, material e movimento; não depender exclusivamente de troca de matiz. Usar interpolação espacial de cor, neblina e densidade de flora nas fronteiras. As cavernas permanecem escuras mesmo em biomas com plantas emissivas: pontos de bioluminescência não devem revelar o mapa inteiro.

### Geometria e desempenho

- Separar rocha **sólida** de volume **vazio escavado**: cavernas são áreas transitáveis internas, não apenas decorações sobre pedras.
- Ter 1 corredor principal estreito ligado à câmara de cada caverna; largura precisa passar em testes para mergulhador, Eco, inimigos e manobras adequadas de submarino quando aplicável. Evitar bloqueios impossíveis da IA.
- Gerar por seed e setores; manter rochas do centro com suas coordenadas equivalentes, deslocando a origem apenas se necessário. Preferir streaming de arte/fauna, culling, cache de colisão e iluminação apenas no viewport.
- Mapear entrada, vórtice, corredor, volume sem luz, biomeId, plantas e rota de saída em um mesmo registro de mundo.
- Considerar todas as resoluções de Android e configurações de qualidade, sem carregar o mapa inteiro em cada frame.

## 5. IA de inimigos, visibilidade, morte e renascimento

### Requisitos definidos

1. Monstros **não iniciam ataque antes de detectar o jogador dentro de seu campo de visão invisível**. O cone real e o cone lógico coincidem, mesmo que não haja desenho visível na tela.
2. Rochas/paredes de cavernas precisam obstruir visão. A IA não deve atacar através de paredes nem simplesmente saber a localização do jogador.
3. Inimigo morto passa ao estado **CORPSE**: flutua, tem X nos olhos e produz continuamente uma fumaça vermelha leve.
4. O cadáver permanece visível **durante 5 minutos** após a morte, depois desaparece.
5. **Após os mesmos 5 minutos**, aquela criatura renasce no seu **spawn original**, preferencialmente no vórtice correspondente.
6. Matar não deve criar duplicações, várias ressurreições, recompensas repetidas nem corpos com colisão hostil.

### Máquina de estados proposta

DORMANT/SPAWN -> IDLE/PATROL -> DETECTED/CHASE -> ATTACK -> DEAD_CORPSE (300s) -> RESPAWN_IN_SPAWN.

- Usar timestamp do servidor e identificadores determinísticos de spawn no multiplayer.
- Corpo é entidade visual leve, sem IA, sem dano, sem colisão ofensiva, removida por prazo independente da distância dos jogadores.
- Quando corpo estiver fora da AOI, persistir apenas identificador + relógio; não manter centenas de partículas ativas.
- Ao retornar, a nova instância usa posição associada ao spawn original, respeitando limite de população ativa e segurança do local.
- **Em aberto:** se criaturas podem perseguir após perder o alvo da visão; perseguição curta com memória temporal pode ser adequada, mas não é autorização para rastrear através de paredes.
- "Só atacam depois de ver o jogador" pode coexistir com patrulha/saída do vórtice; não pode ser interpretado como ataque imediato à distância.

## 6. Sistema de missões da expedição

### Requisitos definidos

- **Capitão** seleciona as missões do grupo.
- Quando se aproxima do submarino, aparecem **3 missões disponíveis e suas recompensas**.
- A equipe realiza os objetivos, com assistência dos bots conforme funções.
- **Depois de completar as três missões da rodada**, o sistema apresenta um novo trio de missões.
- Objetivos podem surgir aleatoriamente durante a partida; o estado de cada missão deve ser explícito.

### Catálogo inicial proposto, incluindo 3 exemplos citados pelo usuário

| Missão | Descrição sugerida | Condição de conclusão |
| --- | --- | --- |
| **Roubar o Núcleo dos Ecos** | Infiltrar uma caverna, recolher um núcleo ativo e levá-lo intacto ao submarino. | Núcleo entregue e registrado no depósito. |
| **Destruir o Núcleo dos Ecos** | Localizar um núcleo instável e destruí-lo antes de a caverna ser tomada por novas criaturas. | Vida do núcleo chega a zero e evento de destruição confirmado. |
| **Recuperação de Carcaça** | Encontrar a espécie indicada, eliminar o alvo, recuperar sua carcaça e transportá-la ao submarino. | Carcaça correta entregue; ID e espécie validados. |
| **Sonda Perdida** | Localizar uma sonda desaparecida em um bioma desconhecido e extrair seus registros. | Dados recuperados e levados ao submarino. |
| **Estabilizar o Vórtice** | Entrar na câmara terminal e ativar estabilizadores sob pressão dos inimigos. | Todos os estabilizadores ativados na ordem requerida. |
| **Reconhecimento de Bioma** | Identificar três locais de interesse e revelar uma região oculta do mapa. | Marcos explorados por integrantes válidos. |
| **Defender o Reator** | Proteger o casco durante uma etapa de recarga ou operação de núcleo. | Resistir até o término com seção crítica preservada. |
| **Resgate de Carga** | Transportar de volta uma cápsula perdida nos corredores rochosos. | Cápsula descarregada e entregue. |

Recompensas específicas, raridades, duração das missões, falha, extração e conclusão geral da expedição **ainda não foram definidas**. O host/Capitão pode escolher a ordem das três missões; bloquear geração de novo lote antes de confirmar as três. As missões precisam evitar objetivos impossíveis, como pedir uma carcaça cujo spawn não exista no mapa. Roubar e destruir um mesmo núcleo não devem ser ambas obrigatórias e contraditórias no mesmo lote.

## 7. Arquitetura do jogo atual, inspeção realizada em 21/11/2026

- **public/index.html**: menu e navegação existentes. Há menu MERGULHAR e telas de salas já usadas pelos modos atuais. Inspecionar a janela definitiva onde Solo e Online são apresentados antes de inserir terceiro botão.
- **public/abyssal-rebuild.js**: janela antiga de descida/Fossas com duas escolhas. Não sobrescrever sem verificar se é a tela atualmente utilizada pelo botão Mergulhar.
- **public/abyssal-solo-cavern.js**: funções buildRocks, isBlocked, resolve, navigationTarget, drawRocks, lighting, submarineHull. Ponto de partida para terreno e iluminação; não alterar comportamento atual do Solo.
- **public/game.js**: gameplay, HUD, render, submarino Solo, controles e seleção de modo. Alterações devem ser encapsuladas pelo novo modo.
- **world-simulation.js**: estado autoritativo, monstros, submarino, spawns e ticks para mundos existentes. Considerar nova instância e simulador compartilhado com orçamento.
- **server.js**: salas, autorização de entrada e segurança de ação; novo modo requer salas privadas/travadas, papéis exclusivos, bots e missões validadas.
- **public/online.js**: conexão Socket.IO; distinguir nova sala do modo coop atual e validar ingresso/reconexão.
- **public/abyssal-expedition-rules.js**: sistema legado de zonas/eventos das Fossas; **NÃO é este novo modo** apesar do nome semelhante. Não reutilizar IDs sem análise.
- **tests/expedition-rebuild.test.cjs**: cobre Fossas/expedição antiga, não é teste de aceitação do novo modo.
- **AGENTS.md e .agent/**: instruções de limpeza, performance, dados, PR, testes reais.

**Proposta de nomenclatura interna:** expedition-squad (não confirmado). Criar um módulo próprio de regras, world builder, seleção de equipe, bot behavior e contratos de missão somente após autorização.

## 8. Sequência de implementação recomendada para próxima etapa (não executar agora)

| Fase | Entregável | Critério de aceite |
| --- | --- | --- |
| 0. Auditoria | Referências reais de menu, mapas, física, estado, bots, rede, missões e arte | Sem referências quebradas nem alteração de modos existentes. |
| 1. Contratos | Documento de regras e testes puros para 4 papéis, sala lacrada, seed e missões | Ninguém consegue confirmar papel ocupado ou ingressar após iniciar. |
| 2. Sala | Botão Expedição, lobby e confirmação de papéis com bots | UI responsiva e status replicado; não iniciar antes da hora. |
| 3. Mundo | Centro Solo intacto, dimensões decididas, biomas, cavernas e vórtices | Navegação válida, colisão sem atalhos, transição visual sem costuras. |
| 4. Visão e ciclo de vida | Detecção invisível, cadáveres 300 s, respawn por spawn original | Testes com obstrução, tempo, jogadores distantes e reinício de sala. |
| 5. Submarino e funções | Capitão pilotando, Engenheiro reparando, Defensor atraindo e Explorador usando E | Permissões validadas pelo servidor; passageiros/ejeção corretos. |
| 6. Bots | Um bot por função vaga, kits/cosméticos aleatórios e prioridades consistentes | 1 humano + 3 bots executam tarefas sem travamento nem abandono de papel. |
| 7. Missões | Três cartas, seleção pelo Capitão, objetivos e renovação do trio | Missões executáveis, recompensas autoritativas, sem duplicação. |
| 8. Otimização e lançamento | AOI, streaming, orçamento de IA/partículas, build web e Android | Testes Solo/Online/mobile, benchmark e deploy efetivamente verificados. |

## 9. Critérios de QA e regressão para novo modo

- 1, 2, 3 e 4 humanos; 3, 2, 1 e 0 bots; uma função por slot; confirmação imutável.
- Tentativa de dupla confirmação simultânea, convite após início, desconexão antes/depois do início e reconexão.
- Somente Capitão conduz e abre/selecione missões; somente Engenheiro repara; Defensor consegue atrair alvos elegíveis; somente Explorador usa E.
- Submarino destruído com 1 a 4 passageiros e com Capitão ausente: expulsão segura.
- Bots atuam de forma verificável, não apenas aparente: missão, proteção, reparo abaixo de 60%, mapa revelado.
- Centro do Solo com geometria e proporções preservadas; bordas sem lacunas; cavernas navegáveis; vórtice não nasce dentro de pedra.
- Visão de monstros frontal/atrás de obstáculo; campo invisível não é telepatia; corpos X e fumaça vermelha duram 300 s e não gastam CPU fora da câmera.
- Ao fechar 300 s: 1 cadáver desaparece e 1 monstro renasce no spawn correto; sem duplicar recompensa.
- Contratos "roubar", "destruir", "entregar carcaça" e lotes de 3 renovam corretamente; Capitão bot também consegue escolher.
- 50+ inimigos próximos, muitas mortes simultâneas, várias lanternas e múltiplos bots: CPU, FPS, memória, ticks e banda medidos; nunca afirmar "sem gargalos" só porque passou npm test.
- Testes em navegador real desktop e mobile, Android, estabilidade de rede, reabertura do app e serviço worker.
- Preservar compras, contas, GameMaster, Fossas, Solo e Online; nenhuma exclusão indevida.

## 10. Decisões ainda em aberto: não presumir resposta

1. Dimensão exata da ampliação 2x: total por eixo ou expansão 2x em cada lado?
2. Quantidade e identidade final dos biomas; nomes sugeridos são apenas esboço.
3. Quantidade de cavernas por bioma, tamanho dos corredores e posicionamento dos spawns.
4. Reconexão do mesmo jogador após o início; substituição por bot em abandono.
5. Critério de vitória, derrota, saída, reviver jogadores e destino do grupo quando submarino for destruído.
6. Modelo e valores de recompensas por missão/rodada, persistência e proteção da economia.
7. Compartilhamento do mapa revelado entre integrantes; qual é a contribuição exclusiva do Explorador na revelação?
8. Ritmo de surgimento de objetivos, prazo/falha e possibilidade de pular uma missão impossível.
9. Níveis de agressividade e visão de inimigos, memória após perder contato e reação à habilidade do Defensor.
10. Bot Capitão define missões automaticamente com que critério? O host humano consegue aprovar quando não é Capitão?
11. Engenharia: reparo humano liberado em qualquer dano ou apenas abaixo de um percentual? O limiar de 60% é definido para o BOT.
12. O novo modo exige conexão/autenticação para bots e recompensas ou haverá uma variante offline? Multiplayer necessariamente requer servidor.

## 11. Quadro de progresso do projeto

- [x] Escopo descrito pelo usuário recebido.
- [x] Componentes existentes relevantes identificados no repositório.
- [x] Esboço do mapa, lobby, missões e funções produzido.
- [x] Framework de continuidade registrado em docs e referenciado por AGENTS.md.
- [ ] Dimensionamento 2x confirmado pelo usuário.
- [ ] Propostas de biomas e missões aprovadas.
- [ ] Autorização expressa para implementação do jogo.
- [ ] Nova arquitetura de sala aprovada.
- [ ] Código do modo implementado.
- [ ] Testes do modo executados e aprovados.
- [ ] Alterações do modo integradas à main.
- [ ] Deploy web e Android da nova modalidade verificados.

**Importante:** os checkboxes de implementação devem permanecer desmarcados enquanto este arquivo for apenas planejamento.

## 12. Instruções para o próximo agente: continuidade sem perda de contexto

Quando o usuário pedir para "continuar a Expedição", realizar nesta ordem:

1. Ler este documento e verificar main atual.
2. Confirmar se o usuário já autorizou implementação; se não autorizou, continuar **só o planejamento**.
3. Separar os requisitos imutáveis da lista de decisões abertas. Não pedir novamente dados já fornecidos.
4. Se autorizado, dividir tarefas por especialidade:
   - **Game Designer / Arquiteto:** biomas, mapa, fluxo, equilíbrio e contratos de missão.
   - **Gameplay Engineer:** permissões e estados, colisão, controle do submarino, IA compartilhada, bots e missões.
   - **Art / Rendering:** biomas contínuos, vegetação por rocha, iluminação da caverna e efeitos leves dos cadáveres.
   - **Network / Backend:** lobby fechado, Socket.IO, autoridade, reconexão, recompensas e respawns.
   - **QA / Performance:** automação, visual regressions, desktop/mobile, CPU, memória, CI e AAB.
5. Trabalhar em branch própria com PR e validação; nada de refatoração ampla do Solo só para reaproveitar código.
6. Após cada etapa, atualizar este arquivo com o status verdadeiro, commits, testes, decisões novas e pendências. Não declarar deploy sem consultar estado real.

### Resumo executivo para copiar em um novo chat

"Continuar o projeto do novo modo Expedição do Abyssal no repositório Esaneto/Abyssal. Leia AGENTS.md e docs/EXPEDITION_MODE_AGENT_FRAMEWORK.md na main antes de qualquer mudança. O modo foi apenas planejado e NÃO implementado. Deve aparecer como terceiro botão abaixo de Solo/Online e criar uma sala fechada de quatro papéis exclusivos, com bots para as vagas restantes. Usa o mapa Solo original no centro de uma expansão 2x ainda a dimensionar, biomas periféricos, cavernas escuras de entrada estreita, vórtices, visão lógica dos inimigos, cadáveres flutuantes por 5 minutos com respawn no spawn original, submarino com Capitão/Engenheiro/Defensor/Explorador e rodadas de três missões escolhidas pelo Capitão. Preserve modos existentes, server authority, desempenho Android e dados. Verifique se já existe autorização explícita para implementar. Caso contrário, continue apenas com desenho de solução e documentação."