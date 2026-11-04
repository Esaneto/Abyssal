# Abyssal - Google Play Release Pack

## App identity
- App name: Abyssal
- Package: com.esaneto.abyssal
- Category: Game / Action
- Default language: Portuguese (Brazil)
- Audience configured in product: 16+
- Contact: abyssalelectrongames@gmail.com
- Privacy policy: https://abyssal-ej5j.onrender.com/privacy.html
- Account deletion: https://abyssal-ej5j.onrender.com/delete-account.html

## Store listing draft
Short description:
Sobreviva às profundezas, evolua sua criatura e enfrente bosses no Abyssal.

Full description:
Abyssal é um jogo de ação e sobrevivência nas profundezas. Entre em expedições, enfrente criaturas abissais e bosses, evolua durante cada mergulho e desenvolva sua coleção de criaturas.

Jogue sozinho ou participe das expedições online. A progressão da conta registra conquistas, títulos, skins e resultados. Perfis e Cardumes permitem reconhecer outros mergulhadores, e o Histórico de Partidas mantém as 10 expedições online mais recentes para facilitar o acesso aos participantes.

Recursos principais:
* combate de ação em tempo real;
* partidas solo e multiplayer;
* bosses e criaturas com comportamentos distintos;
* progressão, títulos e coleção de skins;
* Cardumes e perfis de jogadores;
* histórico das 10 partidas online mais recentes;
* sistema de denúncia dentro do jogo;
* controles dedicados para dispositivos móveis.

O Abyssal contém violência fantástica e efeitos visuais de combate.

## Play Console declarations checklist
- Ads: YES only if the Android release actually displays Google ads. Keep declaration synchronized with release behavior.
- App access: authentication exists. Supply a permanent reviewer account that does not require OTP or access to a private email inbox.
- Content rating: disclose fantasy violence, blood/death effects, multiplayer/user interaction, digital purchases if enabled, and ads/rewarded mechanics if enabled.
- Target audience: 16+ as implemented by the current age-band flow.
- UGC: nicknames, public profiles and Cardume names/descriptions are user-generated. In-app reporting and moderation are implemented. Public chat is not present.
- Account deletion: in-app deletion plus external deletion resource are implemented.
- Data safety: disclose account identifiers/contact email when provided, user IDs/UUID, gameplay/progress, social/UGC and moderation reports, purchase data when payments are enabled, and technical/network data handled by hosting/advertising providers as applicable.
- Privacy policy: use the public privacy URL above.
- Purchases: do not enable Stripe checkout for Android digital goods. Implement/enable Google Play Billing before Android digital sales.
- Rewarded random wheel: keep disabled for first Android production release unless its policy treatment is separately reviewed.

## Required release secrets
The CI can create the signed Play AAB after these GitHub Actions secrets exist:
- ANDROID_KEYSTORE_BASE64
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

The upload keystore must be generated once, backed up securely outside GitHub, then encoded as base64 into ANDROID_KEYSTORE_BASE64.

## New personal developer account testing
If the Play developer account is a personal account created after 13 November 2023, Google requires a closed test with at least 12 opted-in testers for 14 consecutive days before production access can be requested.

## Release gate
Do not request production until:
1. CI syntax/tests is green.
2. Android API 36 build is green.
3. Signed release AAB is produced from the permanent upload key.
4. The signed build is exercised through Play internal/closed testing on physical Android devices.
5. Play Console declarations match the actual release.
6. Reviewer credentials work.
7. If applicable, the 12-tester/14-day requirement has completed.
