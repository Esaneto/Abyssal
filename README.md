# Abyssal — Ecos das Profundezas (v2.6.0)

Jogo de sobrevivência em arena com criaturas abissais, modo solo e cooperativo online.

## O que foi revisado nesta versão

- Corrigido o CSS que deixava o canvas do jogo ocupar a tela mesmo dentro da loja e do catálogo. O canvas de gameplay e as miniaturas agora têm posicionamento independente.
- Redesenho procedural de 14 skins e de cada classe de criatura, usando anatomia distinta: ctenóforo/medusa, peixe-ferrão, isópode blindado, enguia gulper, peixe-pescador, leviatã alongado e predador mandibular. As prévias são renderizadas pelo mesmo desenho usado em jogo.
- Cooperativo sem eleição de host: a simulação dos inimigos e bosses é controlada pelo servidor. Os clientes enviam posições com eventos voláteis para descartar posição antiga durante picos de rede.
- Movimento dos inimigos normalizado para o tamanho da tela do alvo e interpolação de snapshots no cliente. O servidor não retransmite o mapa inteiro a cada projétil; os estados completos são enviados em intervalo fixo.
- O modo solo mantém movimento circular pelas bordas; o modo online usa limites do mundo compartilhado para não aparecer do outro lado da tela.
- Cadência de tiro consistente entre solo e online, com tiro rápido dependente da habilidade de velocidade de disparo; perfuração aumenta alvos atravessados, não o dano por impacto.
- Bosses a partir de 1 minuto; um de cada vez; espécies não se repetem consecutivamente; o próximo tem 50% mais vida máxima; dano e velocidade aumentam gradualmente, com velocidade limitada a 90 (abaixo da velocidade-base do jogador). A janela seguinte começa 60 segundos após a derrota. Cada conta online presente recebe 100 moedas por boss derrotado.
- Roleta destacada no menu, catálogo ilustrado, prévias de skins equipadas e melhorias/ habilidades disponíveis na loja.
- Gravação de contas e rankings em PostgreSQL quando `DATABASE_URL` está configurada; tentativa de gravação dos dados pendentes ao encerrar o servidor. O endpoint `/health` informa qual mecanismo está ativo.

## Executar localmente

Requer Node.js 18 ou superior. Dentro da pasta do projeto: 

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Configure o comando de build do Render como `npm install` e o de start como `npm start`. Se você está atualizando um repositório antigo e o `package-lock.json` antigo não incluir `pg`, execute `npm install` e envie o `package-lock.json` regenerado junto com as alterações.

## Muito importante: fazer as contas sobreviverem a redeploys

O sistema só usa armazenamento durável quando `DATABASE_URL` estiver configurada. Sem ela, `/health` responde `"persistence":"local-ephemeral"` e as contas/records podem sumir; com banco configurado deve responder `"persistence":"postgres"`.

### Configuração recomendada usando PostgreSQL externo

1. Crie um banco PostgreSQL persistente em um provedor como [Neon](https://neon.tech/).
2. Copie a string de conexão PostgreSQL fornecida pelo provedor, incluindo a opção TLS/SSL requerida. Não compartilhe a string de conexão nem a senha publicamente.
3. No painel do [Render](https://dashboard.render.com/), abra o Web Service do Abyssal → **Environment** → **Add Environment Variable**. Adicione `DATABASE_URL` com a string de conexão completa.
4. Salve e faça um deploy. O servidor cria a tabela `abyssal_state` automaticamente. A primeira inicialização importa os JSONs locais existentes quando ainda estão disponíveis.
5. Depois do deploy, abra `https://SEU-SERVICO.onrender.com/health`; confirme `"persistence":"postgres"`. Se continuar como `local-ephemeral`, não considere a persistência configurada.

**Contas que já desapareceram em um deploy antigo não podem ser reconstruídas pelo código se não houver cópia/backup dos dados.** Para evitar perder as contas que ainda existirem no servidor atual, configure e verifique o banco antes de fazer o próximo redeploy, ou exporte os arquivos antigos antes de substituí-los, se ainda estiverem acessíveis.

O Render Free perde alterações no sistema de arquivos ao reiniciar, suspender ou fazer deploy, e pode suspender um web service após 15 minutos sem tráfego de entrada. Um banco externo mantém os dados, mas não mantém o servidor de jogo ativo por si só. Para execução verdadeiramente contínua, o servidor de jogo também precisa de uma hospedagem que não entre em suspensão.

## Inspiração de design e balanceamento

A pesquisa de design usou como referências públicas *Vampire Survivors* (combate legível, coleta de recursos durante a run e melhorias persistentes entre partidas) e *Brotato* (ondas de inimigos, variedade de personagens/armas e compras entre ondas). O Abyssal mantém o tema original de exploração das fossas oceânicas e adapta essas ideias para encontros com bosses em intervalos curtos. Fontes: [Vampire Survivors — Steam](https://store.steampowered.com/app/1794680/Vampire_Survivors/) e [Brotato — Steam](https://store.steampowered.com/app/1942280/Brotato/).

## Roleta e anúncios

O menu e animação da roleta estão implementados. O pacote **não** inclui um publisher ID aprovado nem garante que anúncios reais sejam veiculados. O prêmio só deve ser habilitado quando o SDK de anúncio recompensado estiver carregado e confirmar a visualização. Sem ele, `Testar giro · sem prêmio` serve apenas como demonstração visual. Antes de distribuir recompensas de valor, integre/valide o SDK oficial e proteja o callback de fraude e replay.

## Compras reais

As skins continuam compráveis por moedas abissais. Checkout em reais, webhooks de pagamento e repasse financeiro não estão configurados nesta versão. Não anuncie itens como compras em dinheiro antes de implementar e validar um provedor de pagamento no backend.
