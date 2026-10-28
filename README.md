# Abyssal — Ecos das Profundezas (v2.7.0)

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
