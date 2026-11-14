# Abyssal: preparação Google Play

Status: app ainda não cadastrado/publicado. Pacote existente: `com.esaneto.abyssal`. Versão de preparação 3.6.81.

## Criar app
- Nome: Abyssal: Ecos das Profundezas
- Idioma: Português (Brasil), jogo, gratuito.
- Contato: abyssalelectrongames@gmail.com
- Categoria sugerida: Ação. Público pretendido: 16–17 e 18+, não destinado a crianças. A classificação IARC deve resultar do questionário real.
- Aceitar políticas de desenvolvedor/exportação e Play App Signing após leitura. Se o pacote já foi distribuído, seguir a verificação de propriedade da chave indicada pelo Console. Nunca gerar uma nova chave em substituição à chave original sem verificar a situação.

## Ficha da loja
Descrição curta: Explore o abismo, enfrente criaturas e evolua em mergulhos solo ou online.

Descrição completa:

Desça às profundezas do Abyssal, um jogo de ação e sobrevivência subaquática. Enfrente criaturas marinhas, desenvolva seu mergulhador e prepare cada expedição na cabine do submarino.

• Mergulho solo: explore cavernas, colete energia e enfrente chefes em sequência.
• Cooperativo online: compartilhe a expedição com outros jogadores e sobreviva em equipe.
• Pesquisa e ressonância: desbloqueie equipamentos e combine habilidades de combate.
• Espécimes: descubra criaturas, equipe companheiros e consulte o Abyssário.
• Personalização: experimente cabelos, trajes, máscaras, armas e nadadeiras no armário.
• Progressão: acompanhe suas conquistas e classificações online.

O modo solo pode ser jogado offline. Conta e internet são necessárias para funcionalidades online e sincronização. A disponibilidade de itens e anúncios recompensados depende da configuração da plataforma.

Não anunciar Mar Aberto, Fossas, PvP ou compras monetárias como disponíveis no lançamento até confirmação real.

## Endereços públicos
- https://abyssalgame.duckdns.org/privacy.html
- https://abyssalgame.duckdns.org/delete-account.html
- https://abyssalgame.duckdns.org/terms.html
- https://abyssalgame.duckdns.org/store-policy.html
- Verificar todos externamente antes da submissão. A página de exclusão e o formulário já existem; validar envio e atendimento, retenção e limpeza de dados.
- Acesso do revisor: criar conta normal dedicada e informar instruções e credenciais no campo App access, não neste arquivo.

## Arte
- Gerar ícone a partir da arte real usada nos builds: instalar sharp@0.34.4 e executar `node scripts/build-app-icons.cjs --play`. Saída dist/play-listing/icon-512.png (512x512 RGBA, <=1 MiB).
- Feature graphic: 1024x500, PNG/JPEG sem alpha.
- Capturar no dispositivo Android 4–8 screenshots reais: cabine, armário, pesquisa, combate solo, coop, espécimes. Não usar mockup como captura. Para retrato, 1080x1920 é uma opção válida. Mínimo de duas capturas.
- Não inserir preços, falsas classificações, alegações de recursos indisponíveis ou violência gráfica na ficha.

## Build e assinatura
- Capacitor gera android/ durante o CI; manter targetSdkVersion/compileSdkVersion 36 e Java/Gradle do pipeline existente. Conferir manifest final, versão, assinatura e compatibilidade 16 KB quando houver bibliotecas nativas.
- AAB release assinado, não APK debug. Secrets existentes: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD. Usar chave de upload válida; não publicar secrets.
- Garantir versionCode superior a todo bundle previamente enviado. O CI usa número da execução/override ABYSSAL_VERSION_CODE.
- AAB Play sem REQUEST_INSTALL_PACKAGES. Atualização via Play App Update; APK direto continua em canal separado. Testar a instalação pela faixa interna.
- Conferir CI e artefato assinado; a existência do script não prova a compilação nem a assinatura.

## Monetização (bloqueio da loja paga)
- Catálogo de referência gerado de payments.js e avatar-base.js: `node scripts/play-catalog.cjs`. Verificar com `--check`. products.json não é arquivo de importação oficial da Play e não cria produtos; IDs propostos devem ser registrados exatamente após aprovação.
- 68 itens individuais: 33 espécimes e 35 cosméticos. Preço em centavos BRL; 199 = R$ 1,99.
- Itens permanentes não consumíveis. Os três cosméticos por energia não são SKUs monetários.
- Não ativar produto antes de implementar Billing nativo e verificação de purchaseToken pelo backend Google Play Developer API; vincular conta, conferir pacote e SKU, estado PURCHASED, impedir reutilização, persistir concessão e reconhecer a compra. Implementar restauração e revogação/reembolsos.
- Pacote boss web tem preço proporcional; não usar um SKU fixo sem definir oferta Play. Stripe permanece web; não redirecionar usuário da versão Play para compra externa.
- Alternativa de primeiro teste: manter compras em BRL explicitamente indisponíveis, sem checkout externo, até Billing completo. Não prometer vendas na ficha.
- AdMob: validar SDK nativo, consentimento UMP, teste com anúncios de teste, tratamento etário e verificação de recompensa pelo servidor. Declarar anúncios se presentes.

## App content / Data safety
- Política de privacidade pública e exclusão de conta externa.
- Declarar dados efetivamente tratados: nickname, identificadores de conta, email de recuperação, histórico de compras se aplicável, atividade/progresso do jogo, conteúdo de perfil/cardumes/denúncias, dados técnicos e SDK de anúncios conforme versão instalada.
- Não marcar "nenhum dado coletado". Confirmar compartilhamento, criptografia TLS, retenção e exclusão com backend e SDKs. Conferir o Data Safety do AdMob e os fluxos efetivos antes de enviar.
- Violência: combate com criaturas, chefes, dano e tema de terror/fantasia; responder IARC honestamente. Público alvo não equivale à classificação final.
- Recursos sociais: perfis, nomes e Cardumes, denúncias e bloqueio. Verificar moderação e acesso a política da comunidade; chat público não é anunciado.
- Testar offline (primeira abertura), online, login/recuperação/exclusão, compras, anúncios, controle de idade, controles por toque, pausa, atualização, retorno e estabilidade.

## Testes e produção
1. Criar app e preencher App content/ficha.
2. Gerar AAB assinado, enviar ao teste interno, validar no Android real.
3. Completar configuração e abrir teste fechado; contas pessoais novas: >=12 testadores inscritos continuamente por >=14 dias. Recrutar 15–20 para margem; registrar feedback e correções.
4. Solicitar acesso à produção e aguardar decisão do Google. Não prometer aprovação automática.
5. Publicar com rollout controlado após cumprir todos os bloqueios, monitorar Android vitals e crash/ANR.

Referências oficiais:
- https://support.google.com/googleplay/android-developer/answer/9859152
- https://developer.android.com/google/play/requirements/target-sdk
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/9866151
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/10281818
