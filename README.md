# Abyssal — Ecos das Profundezas (v2.4)

Jogo arcade de sobrevivência em arena, com modo solo e cooperativo online.

## Executar localmente

Requer Node.js 18 ou superior. Na pasta do projeto: 

```bash
npm install
npm start
```

Abra `http://localhost:3000`. No Render, use o comando de inicialização `npm start`.

## Mudanças desta versão

- O mundo cooperativo passa a ser simulado pelo `server.js`; nenhum navegador/jogador é eleito host. O servidor mantém relógio, inimigos, vida dos bosses e snapshots compartilhados. A aba do jogador pode ficar em segundo plano enquanto a conexão continuar ativa.
- O relógio mundial progride no servidor mesmo quando não há mergulhadores conectados; encontros são congelados nessa condição para que o retorno não gere hordas artificiais.
- Bosses entram na janela de 60 segundos, não há dois bosses ao mesmo tempo, espécies não se repetem em sequência, cada novo boss tem 50% mais vida máxima que o boss anterior, e cada conta online presente recebe 100 moedas pela derrota.
- O mesmo intervalo de tiro é usado no modo solo e online. A cadência básica fica normal; cada nível da skill de tiro rápido reduz progressivamente o intervalo. A retransmissão de tiro não é desenhada novamente na tela de quem o disparou.
- Perfuração concede um alvo atravessado adicional por nível, sem bônus de dano. A skill de dano aumenta o dano real do projétil em 50% por nível.
- Arte procedural revisada para bosses, inimigos e 14 skins; loja e catálogo usam o mesmo renderizador do combate para mostrar prévias fiéis. Aparência de skins de outros mergulhadores também é enviada pelo servidor.
- Roleta promocional destacada no menu, com distribuição proposta de prêmios 20/50/100/300/600/1000 (o prêmio de 1.000 tem 0,1% de chance).
- Loja inclui melhorias passivas e habilidades ativas desbloqueáveis: Costelas de Basalto, Lente de Fótons, Aletas de Corrente, Casulo de Pressão, Pulso de Maré e Passo Fantasma.

## Limites importantes de hospedagem e persistência

A simulação é autoritativa no servidor, mas o estado atual do mundo e as contas ainda usam memória/arquivos locais do serviço. O armazenamento local no Render Free é efêmero e pode ser perdido em reinícios, redeploys ou suspensão; um serviço grátis também pode suspender após período sem tráfego recebido. Para continuidade durável, migre contas/rankings para um banco persistente e escolha um serviço que suporte execução contínua. Essa implantação requer configuração da conta/provedor, que este pacote não consegue realizar sozinho.

## Roleta e anúncios

O botão e a animação da roleta estão implementados. O fluxo de prêmio só é ativado quando a API `adBreak` dos anúncios H5 estiver presente e chamar `adViewed`. O pacote **não** inclui publisher ID aprovado nem garante veiculação/monetização real. É necessário aderir ao programa elegível, configurar a API oficial de anúncios no HTML e testar a aprovação do placement antes de distribuir recompensas de valor. Enquanto não houver SDK carregado, `Testar giro · sem prêmio` apenas demonstra a animação e não entrega moedas. O fluxo web baseado em callback também deve ser tratado como protótipo contra fraude até uma integração publicitária validada e controles de abuso adequados estarem prontos.

## Compras reais

As skins neste pacote são compradas com moedas abissais. Checkout em reais, webhook de pagamento e repasse financeiro não estão configurados. Não anuncie itens como compras em dinheiro até adicionar e validar um provedor de pagamento no backend.
