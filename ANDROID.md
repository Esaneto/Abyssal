# Abyssal Android

A versão Android usa Capacitor para manter a mesma base de gameplay web, carregar os assets do jogo localmente e continuar usando o backend autoritativo do Abyssal para multiplayer, contas e rankings.

## Ambiente

- Node.js 22+
- Android Studio 2025.2.1+
- Android SDK 36
- JDK fornecido pelo Android Studio

## Estado da fundação

A base web já está preparada para distinguir o shell Android, manter `public/` como bundle local e direcionar multiplayer/API ao backend remoto do Abyssal. A dependência Capacitor ainda não é adicionada ao `package.json` nesta etapa para não quebrar o lockfile e o pipeline do servidor.

Na etapa de scaffold Android, o lockfile será regenerado junto com Capacitor 8 e o projeto nativo será criado com Android SDK 36. Isso será feito como uma mudança isolada e testável.

## Performance

O runtime web possui qualidade adaptativa independente da simulação. O controlador mede FPS e P95 de frame time em janelas de 2,5 segundos:

- ALTO: resolução e efeitos completos.
- EQUILIBRADO: reduz framebuffer antes de sacrificar legibilidade.
- ECONOMIA: reduz framebuffer e ativa os caminhos visuais de baixo custo.

A qualidade só cai após pressão sustentada e só sobe após uma janela longa de estabilidade, evitando oscilações. Gameplay, colisão, dano e netcode não são alterados.

Para inspecionar durante desenvolvimento:

`window.AbyssalPerformance.snapshot()`

`window.AbyssalAdaptivePerformance.snapshot()`

## Release

A Play Store recebe Android App Bundle (AAB). Não versione chaves de assinatura no Git.
