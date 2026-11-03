# Abyssal Android

A versão Android usa Capacitor para manter a mesma base de gameplay web, carregar os assets do jogo localmente e continuar usando o backend autoritativo do Abyssal para multiplayer, contas e rankings.

## Ambiente

- Node.js 22+
- Android Studio 2025.2.1+
- Android SDK 36
- JDK fornecido pelo Android Studio

## Estado da fundação

A base web já está preparada para distinguir o shell Android, manter `public/` como bundle local e direcionar multiplayer/API ao backend remoto do Abyssal. Capacitor 8 já está declarado no `package.json`. Ao gerar o scaffold nativo, use `npm install`, `npm run android:add` e `npm run android:sync`. O projeto deve usar `minSdkVersion = 24`, `compileSdkVersion = 36` e `targetSdkVersion = 36`.

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


## Build local

```bash
npm install
npm run android:add
npm run android:sync
npm run android:open
```

Para release, habilite R8 com `proguard-android-optimize.txt`, configure a assinatura fora do Git e gere o AAB com `gradlew bundleRelease`. Antes da Play Console, valide login, reconexão, PvP/co-op, troca Wi-Fi/4G e retorno do background em aparelho físico.

CI note: Android API 36 build validated through the pull-request pipeline before merge.

Android CI validation v4 after BridgeActivity compatibility fix.

Final green build validation after gameplay regression repairs.
