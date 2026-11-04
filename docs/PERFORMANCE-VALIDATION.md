# Abyssal: validação de latência, combate e Raio de Fótons

Este documento é um roteiro de testes. **Nenhum resultado de teste manual deve ser marcado como aprovado antes da execução.**

## Instrumentação existente

Abra as ferramentas do navegador (Console) enquanto estiver na partida:

```js
AbyssalPerformance.snapshot()
AbyssalOnline.positionDiagnostics()
AbyssalAdaptivePerformance.snapshot()
```

* `fps`, `frameP95Ms`, `lastUpdateMs` e `lastDrawMs`: métricas da renderização e da simulação local.
* `network.motionRttMs`: média móvel da ida e volta entre o envio de movimento e o ACK/reconciliação recebido. Não representa o tempo real de tráfego unidirecional.
* `network.motionJitterMs`: desvio móvel dos RTTs amostrados.
* `network.ackAgeMs`: idade do ACK mais recente.
* `entities`: objetos ativos no cliente.
* `heapUsedMb`: apenas navegadores que disponibilizam `performance.memory`.
* `/health`: indicadores do loop e simulação no servidor. Consultar em ambiente de teste ou por canal autorizado.

## Preparação

1. Validar `npm ci && npm test` e a compilação Android da mesma versão.
2. Executar primeiro em staging ou branch isolada, sem afetar a sala pública.
3. Criar duas contas de teste reais e entrar em uma sala cooperativa e em uma sala PVP, uma em cada rodada.
4. Abrir duas janelas independentes, preferencialmente em dispositivos distintos.
5. Repetir os cenários sem limitação e depois com Network Throttling: latência adicional de 100 a 200 ms e perda intermitente de pacotes.
6. Capturar vídeo de tela dos dois clientes, logs de console e métricas antes/depois. Não inferir latência visual a partir do RTT sozinho.

## Matriz de cenários

| Cenário | Ação | Resultado que deve ser observado |
| --- | --- | --- |
| Solo, FPS 60 | Mover, atacar, ativar Q/E, coletar XP, subir de nível | Efeito local no primeiro frame útil, sem saltos de progresso |
| Solo, FPS 30 | Repetir usando dispositivo móvel intermediário | Velocidade, dano e cadência sem vantagem associada ao FPS |
| Cooperativo, 2 clientes | Ativar Raio de Fótons em níveis 1, 2 e 3 | Cor e largura iguais; alvo e origem seguem a interpolação do cliente |
| Cooperativo, perda de pacotes | Manter raio durante 60 segundos | Sem efeito duplicado, desaparecimento injustificado ou criação crescente de feixes |
| Cooperativo, horda | Gerar muitos inimigos e chefes; acionar habilidades simultâneas | Monstros mortos, orbes e recompensas confirmados pelo servidor |
| PVP, 2 clientes | Atirar por ambos os lados de uma rocha | Corpo e núcleo do raio não atravessam a rocha; acertos obedecem ao servidor |
| PVP, cooldown | Repetir Q/E e disparos rapidamente | Sem dano duplicado ou cooldown gratuito |
| Reconexão | Desativar rede, retornar após alguns segundos | Estado e HUD ressincronizados; efeitos temporários expiram |
| Android | Suspender, retomar e alternar controles | Sem aceleração, travamento do joystick ou renderização em loop duplicado |
| Sessão longa | 30 a 60 min de partida | Memória e contagens de entidades estabilizam ao longo do tempo |

## Métricas e metas iniciais

| Métrica | Objetivo inicial | Método |
| --- | --- | --- |
| Resposta local de botão Q/E | até um frame renderizado, se tecnicamente possível | vídeo a 60/120 fps ou Performance panel |
| Frame P95 a 60 FPS | idealmente até 20 ms em desktop e aparelhos capazes | `AbyssalPerformance.snapshot()` |
| Latência remota | variável com rede; evitar atraso adicional por pacote de frame | dois vídeos sincronizados + DevTools |
| Contagem de efeitos de raio | um feixe persistente por jogador remoto ativo | inspecionar `entities.effects` e gravação |
| Retransmissões sem alvo | não devem gerar efeitos permanentes | desconectar, matar e trocar de sala |
| Violação de dados persistentes | nenhuma | usar usuários de teste e comparar estado antes/depois |

## Diagnóstico rápido

Se o Raio de Fótons continuar diferente, verificar em ordem:

1. Os dois navegadores receberam a mesma versão de `game.js`, `online.js` e `photon-ray-config.js` (aba Network; desabilitar cache durante o teste).
2. O evento `shared-shot` possui `fromId`, `beamLevel` e, quando válido, `beamTargetId` ou `beamEndX/beamEndY`.
3. O servidor aceita ou descarta o pacote, com validação de origem, alcance e taxa.
4. `motionRttMs` e `motionJitterMs`: distinguir rede lenta de quadro lento.
5. Conferir se o alvo remoto está no snapshot e se o raio expira ao parar de ser emitido.
6. Em PVP, conferir o mesmo obstáculo e a mesma geometria de arena dos dois lados.

## Segurança da publicação

Não promover a branch diretamente ao Render sem CI verde e sem executar ao menos o teste multiplayer entre dois clientes. Alterações no código compartilhado exigem atualização de servidor e cliente na mesma implantação. Como clientes antigos podem permanecer abertos após o deploy, informar os testadores para recarregar o jogo e confirmar cache atualizado.
