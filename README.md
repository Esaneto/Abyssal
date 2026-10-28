# Abyssal — Ecos das Profundezas (v2.9.1)

Jogo de sobrevivência em arena com criaturas abissais, modo solo e cooperativo online.

## Mudanças desta versão

- Inimigos comuns continuam surgindo durante os encontros com bosses. O orçamento é de até **50 criaturas por arena**, com até **46 inimigos comuns e 4 bosses**.
- Bosses surgem em janelas de 60 segundos, até coexistirem quatro bosses. Os quatro tipos são únicos enquanto estiverem vivos; a espécie só pode reaparecer depois que sua cópia anterior morrer. A vida máxima cresce 50% a cada boss gerado; dano e velocidade também escalam, com velocidade limitada a 90. A derrota concede 100 moedas abissais às contas elegíveis presentes na sala.
- Cada sala tem seu próprio estado de mundo. Há uma sala pública padrão, criação de salas públicas ou privadas (senha de 4 a 64 caracteres), código de convite e limite configurável de 1 a 6 jogadores. Salas privadas vazias expiram após 10 minutos. O limite de criação simultânea é 60 salas para proteger o serviço.
- Movimento e snapshot online são atualizados em intervalos definidos. Atualizações de posição e snapshots são voláteis, então estados antigos são descartados em vez de acumulados em períodos de conexão lenta. As posições dos jogadores são interpoladas no cliente.
- O jogo limita partículas, projéteis, efeitos e orbes; os orçamentos são menores em celulares, e o canvas reduz a resolução de renderização móvel para diminuir carga gráfica.
- Em telas móveis, a arena usa a tela inteira, com joystick virtual de movimento, controles de habilidade acessíveis e respeito às áreas de segurança de celulares. O joystick substitui o arraste com ponteiro no mobile.
- A loja e catálogo usam prévias desenhadas pelo renderizador das criaturas; as 14 skins possuem silhuetas e cores próprias.
- A simulação online é autoritativa no servidor e não depende de um navegador eleito host.
- Contas e rankings usam PostgreSQL quando `DATABASE_URL` está configurada. A rota `/health` informa o estado da persistência e limites das salas.

## Instalar e executar localmente

Requer Node.js 18 ou superior. Na raiz do projeto: 

```bash
npm install
npm start
```

Abra `http://localhost:3000`. O comando de build no Render deve ser `npm install` e o comando de start deve ser `npm start`. Recomenda-se enviar o `package-lock.json` gerado por `npm install` ao GitHub junto dos arquivos atualizados.

## Configurar o PostgreSQL e proteger as contas

1. Confirme que a variável `DATABASE_URL` está definida no serviço ou no grupo de ambiente vinculado no Render.
2. Não coloque a string de conexão no código nem em commits públicos. Se ela foi compartilhada publicamente, redefina a senha no Neon e atualize a variável no Render.
3. Depois do deploy, abra `https://SEU-SERVICO.onrender.com/health`. A persistência precisa mostrar `postgres`.
4. Para conferir o número de contas sem expor os dados privados, use no Neon SQL Editor: 

```sql
SELECT state_key, jsonb_typeof(state_value) AS tipo,
       (SELECT COUNT(*) FROM jsonb_object_keys(state_value)) AS quantidade_de_contas
FROM abyssal_state
WHERE state_key = 'users';
```

Se o banco já tiver contas, a inicialização carrega o registro `users` do PostgreSQL. Dados antigos que já tenham desaparecido do armazenamento temporário do Render só podem ser recuperados a partir de backup.

## Limites de hospedagem

Render Free pode suspender serviços sem tráfego e o armazenamento local é efêmero. O Neon mantém as contas no banco mesmo após deploys, mas não impede o servidor gratuito de dormir. Quando todas as pessoas deixam uma sala, sua simulação para para não consumir CPU; ao entrar alguém de novo, ela continua a partir do estado em memória do processo. Um reinício do processo não preserva a simulação da sala, apenas os dados de contas/rankings gravados no banco.

A lista de salas usa memória do processo. Para distribuir o jogo com múltiplas instâncias do servidor, seria necessário acrescentar adapter Socket.IO e armazenamento de salas compartilhados.

## Pesquisa de design e de rede

O jogo toma como referência *Brotato*: auto-fire fácil de ler, runs de sobrevivência e muitas combinações de melhorias. O limite de entidades e os efeitos com orçamento fixo evitam que partículas cresçam indefinidamente. Em rede, eventos voláteis do Socket.IO são apropriados para posições porque a posição mais recente vale mais que uma longa fila de estados antigos. Fontes: [Brotato — Steam](https://store.steampowered.com/app/1942280/Brotato/) e [Socket.IO — emitting events](https://socket.io/docs/v4/emitting-events/).

## Funcionalidades que continuam exigindo configuração

- A roleta visual existe, mas anúncios recompensados reais exigem integração e aprovação do provedor. Não habilite moedas por mera animação; o servidor precisa validar a conclusão do anúncio.
- As skins ainda são compradas com moedas abissais. Pagamentos reais, webhooks de pagamento e repasse financeiro não estão configurados nesta versão.


## v2.8.0 — câmera/caverna, alerta de boss e recuperação da sala online
- O spawner autoritativo agora possui um watchdog: se uma sala ativa ficar sem fauna comum, repõe uma criatura imediatamente; no ingresso, garante pelo menos três criaturas e oferece novo snapshot ao cliente.
- Lista de salas é enviada na conexão, solicitada ao abrir a janela e atualizada a cada 3,5 s enquanto a lista estiver aberta. Salas públicas e privadas aparecem; privadas são marcadas com cadeado e exigem senha ao selecionar. A listagem nunca envia a senha nem o hash.
- Canvas usa câmera que segue o jogador em mapa lógico maior; zoom de 0,52 em telas móveis e 0,84 em desktop, com borda de rochas, correntes/fendas de spawn e paredes de mapa em vez de wrap infinito.
- Bosses enviam evento próprio `boss-warning` para alerta cinematográfico com rugido sintetizado; alertas não duplicam para o mesmo ID.
- O botão de copiar código foi separado verticalmente do botão de encerrar mergulho.
- A rota `/health` segue disponível. A simulação de sala é volátil e reinicializações do serviço encerram as salas ativas.

Após atualizar, teste duas sessões em contas diferentes: veja se a lista mostra `MAR-ABERTO`, se ambas recebem monstros, crie uma sala pública e confirme que ela aparece no segundo cliente. Salas privadas aparecem sinalizadas com cadeado, mas exigem senha para entrar; a senha nunca é exposta na listagem.


## v2.8.1 — Spawn visível, salas resilientes e interface de terror
- Inimigos surgem na borda visível da câmera, seguindo as faixas de corrente em vez de ficarem distantes no perímetro do mapa.
- Movimento dos inimigos usa a escala correta do mundo e as dimensões de visualização, reduzindo excesso de velocidade e congelamento aparente.
- A listagem de salas tem atualização via Socket.IO e fallback HTTP sem cache em `/api/rooms`. A sala padrão Mar Aberto aparece mesmo quando a lista recebida está vazia; salas públicas e privadas são visíveis, com senha exigida para as privadas.
- O snapshot é solicitado novamente logo após entrar na sala e reenviado pelo servidor.
- Mobile: zoom reduzido e mapa ampliado; o botão de encerrar mergulho fica abaixo dos comandos superiores e separado do código de convite.
- Textos de introdução e rodapé revisados para a atmosfera de terror abissal. O jogo informa que o abismo guarda os mergulhos, sem alegar que o progresso é salvo apenas localmente.

Para validar após deploy: `https://SEU-SERVICO.onrender.com/health` e `https://SEU-SERVICO.onrender.com/api/rooms`.


## v2.8.2 — lista completa de salas e correções de implantação
- Salas públicas e privadas são listadas para seleção. As privadas têm indicação de cadeado e exigem que o jogador informe a senha antes de entrar; segredos e hashes nunca fazem parte da resposta da lista.
- Cabeçalho da lista atualizado para “EXPEDIÇÕES DISPONÍVEIS”.
- A documentação reflete o zoom final de 0,52 em dispositivos móveis e 0,84 em desktop.


## v2.9.0 — escala multiplataforma, vórtices fixos e rankings por bosses

- O mapa usa dimensões lógicas compartilhadas (3600 × 2200) e zoom idêntico em PC e celular. A câmera continua seguindo o jogador; tamanho dos inimigos agora é expresso em unidades lógicas do mundo, em vez de depender da altura do dispositivo.
- Correntes ambientais foram reposicionadas em quatro vórtices fixos nos cantos. Elas não seguem o jogador. Inimigos comuns e bosses surgem dessas fendas e o servidor os move continuamente em direção ao jogador ativo mais próximo, mesmo antes de aparecerem na tela.
- A velocidade do servidor usa unidades de mundo compartilhadas, corrigindo a dependência anterior de resolução/viewport que podia tornar o movimento quase imperceptível em alguns aparelhos.
- O relógio do HUD mede o mergulho atual do jogador; o relógio compartilhado do servidor controla a progressão dos bosses sem sobrescrever a duração individual ao entrar em uma sala já iniciada.
- Rankings foram migrados logicamente para bosses derrotados por partida, com energia e tempo como desempate. O ranking mensal tem seu próprio quadro; as recompensas de top 10 são: diário 100, semanal 1.000 e mensal 5.000 moedas, pagas ao fechar cada período.
- Ao encerrar o mergulho, o servidor finaliza a sessão, registra a marca e entrega o bônus de conclusão; as 100 moedas por boss continuam sendo creditadas no momento da derrota e não são duplicadas no encerramento. A finalização também tenta ocorrer numa saída inesperada.
- As salas e rankings fazem polling com cache desativado, a lista combina a fonte HTTP com Socket.IO para não ser apagada por uma resposta transitória vazia, e os arquivos HTML/JS/CSS usam cache desativado para impedir que o navegador continue executando scripts antigos após o deploy.

### Verificação de recompensas

- `finish-run` é idempotente por sessão: chamadas repetidas no mesmo mergulho não entregam moedas de conclusão duas vezes.
- Cada boss derrotado dá 100 moedas imediatamente aos jogadores elegíveis na sala e incrementa o contador de bosses desse mergulho.
- No encerramento, o servidor grava a melhor marca por usuário em `eternal`, `daily`, `weekly` e `monthly`; a ordenação é `bossesKilled` (desc), energia/score (desc), tempo (desc).
- As recompensas dos rankings são pagas quando o dia/semana/mês fecha, não imediatamente ao entrar no top 10. O servidor evita redistribuir o mesmo período através de `rankings.settled`.

### Após atualizar

1. Substitua os arquivos do projeto pelos arquivos deste pacote, faça `npm install` e envie o `package-lock.json` junto do código.
2. Preserve `DATABASE_URL` e o grupo de ambiente do Neon no Render.
3. Confirme `/health` (deve mostrar `rankingMetric: "bossesKilled"` e o tamanho lógico do mundo), e `/api/rooms`.
4. Teste em duas sessões: entre na mesma sala, mova os jogadores em direções distintas, observe os inimigos aproximando-se, aguarde o relógio correr, elimine um boss e encerre o mergulho. Confira que a conta recebeu 100 moedas por boss mais uma única recompensa de conclusão e que o quadro diário/semanal/mensal mostra a quantidade de bosses.


## v2.9.1 — correções de movimento, escala e conclusão de mergulho

- Corrigida a inicialização das correntes e do mundo: `server.js` define os utilitários `clamp` e `rand` usados no spawn e perseguição. Sem eles, o tick podia falhar antes de os inimigos aparecerem ou se moverem.
- Corrigida a conversão do raio dos inimigos no cliente: os valores de raio agora são convertidos de unidades lógicas para o zoom sem depender do tamanho da tela. Isso mantém a mesma escala visual e evita colisores gigantes.
- O cronômetro do HUD agora mede o mergulho atual do jogador; o relógio global do servidor continua controlando o ciclo de bosses sem ser copiado para o cronômetro individual.
- Em solo autenticado, a conclusão do mergulho credita também as moedas dos bosses reportados pelo jogo local, além do bônus de conclusão. Em sala online, as moedas de boss já são creditadas no momento da derrota e não são pagas novamente ao encerrar. A operação continua idempotente para evitar duplicação.
- A resposta de encerramento inclui o total de moedas da expedição e a interface exibe o total; a tela de fim de jogo também recebe a confirmação do servidor. O progresso periódico do modo solo registra os bosses já abatidos para reduzir perda de ranking caso a conexão caia antes do fechamento normal.
- O número da versão e os parâmetros de cache foram atualizados para 2.9.1.

### Testes de fumaça v2.9.1

- Teste simulado de duas sessões: inimigos iniciais criados, movimento observado entre snapshots, cronômetro autoritativo avançando, sala criada visível na lista de outro cliente e segundo jogador entrando com sucesso.
- Teste de recompensa solo autenticada: 2 bosses + 350 pontos + nível 3 creditam 200 moedas de boss e 16 moedas de conclusão (216 no total), e uma segunda tentativa de finalizar a mesma sessão não paga novamente. O ranking passa a mostrar 2 bosses.
- Essas verificações são testes simulados do servidor, não substituem teste manual no Render e navegador real.
