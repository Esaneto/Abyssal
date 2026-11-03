# Abyssal Android

A versão Android usa Capacitor para manter a mesma base de gameplay web, carregar os assets do jogo localmente e continuar usando o backend autoritativo do Abyssal para multiplayer, contas e rankings.

## Ambiente

- Node.js 22+
- Android Studio 2025.2.1+
- Android SDK 36
- JDK fornecido pelo Android Studio

## Primeira geração do projeto nativo

1. Execute `npm install`.
2. Execute `npx cap add android`.
3. Confirme no projeto Android gerado que `compileSdk` e `targetSdk` estão em API 36 ou superior.
4. Execute `npm run android:sync`.
5. Abra com `npm run android:open`.

O diretório `public/` é o bundle web local do aplicativo. O multiplayer continua usando o servidor remoto do Abyssal.

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
