# Login e cadastro Abyssal (2026-11-18)

## Novo fluxo
- A entrada inicial agora é um painel fullscreen com **Entrar**, **Criar conta**, **Entrar com Google** e **Entrar como visitante**.
- Contas novas tradicionais solicitam nickname, email, data de nascimento e senha de 8 a 128 caracteres, com aceite de Termos e leitura da Política de Privacidade.
- A data é validada no servidor para limitar cadastros a maiores de 16 anos. O servidor persiste somente o campo `ageBand` e a data do aceite, não a data de nascimento.
- Contas antigas mantêm o login de nickname/senha e os dados da conta. Faixa etária desconhecida recebe política restritiva para anúncios.
- Visitante acessa apenas Solo, incluindo a experiência offline; ações online/conta permanecem bloqueadas pela autenticação no servidor.
- GameMaster e Nekko **não têm credenciais alteradas** por essa atualização. A autoridade GameMaster continua determinada no servidor.

## Login Google: configuração externa necessária
1. Em Google Cloud Console > Google Auth Platform / Credenciais, configure a tela de consentimento OAuth e crie um cliente OAuth **Aplicativo da Web** para o domínio público real do Abyssal.
2. Cadastre as **origens JavaScript autorizadas** que executam o jogo, por exemplo `https://abyssalgame.duckdns.org` (confirme o domínio efetivo). O GIS retorna um ID token; não se trata de usar o JSON privado de faturamento.
3. No projeto Cloud, prepare também um cliente OAuth **Android** com pacote `com.esaneto.abyssal` e SHA-1 da **chave de assinatura de apps do Google Play**, para a seleção nativa de conta.
4. Na VPS, `ABYSSAL_GOOGLE_WEB_CLIENT_ID` em `/etc/abyssal/abyssal.env` tem prioridade. Se estiver ausente ou contiver o ID antigo desativado, é utilizado o ID OAuth **fornecido pelo proprietário do projeto** (`356475666791-b0m2248cgt80et9126c41br3mnk868v3.apps.googleusercontent.com`). **O formato de um Client ID não revela se o cliente foi criado como Web ou Android**; o tipo deve ser conferido na Google Auth Platform. Para GIS Web, ele precisa ser do tipo **Aplicativo da Web**, com origem `https://abyssalgame.duckdns.org`. O app Android usa o ID Web como audiência do token nativo, e requer adicionalmente um cliente Android autorizado para a assinatura SHA-1. Nunca envie segredo, token ou JSON privado ao Git.
5. A versão Android precisa ser compilada a partir de `scripts/configure-android.cjs`, incluindo o plugin nativo `AbyssalGoogle`; versões antigas do AAB não oferecem essa capacidade.

### Segurança
O servidor valida assinatura JWT RSA, emissor, audiência, validade, ID do sujeito e email verificado antes de emitir a sessão local. Uma identidade Google **não** herda contas existentes por compartilhar o mesmo endereço de email. O cadastro Google pede nickname, data de nascimento e aceite dos termos, sem senha local.

### Testadores da Google Play
Acesso como **Nekko** ou **GameMaster** no Abyssal é independente do teste de faturamento da Play Console. A lista de **testadores de licença da Play Store** deve receber endereços de **contas Google**, não nicknames de jogo. Nenhuma conta de teste de licença é adicionada automaticamente pelo código.

## Visual e infraestrutura (18/11)
- A área visual do login usa `public/login-wardrobe-preview.js` e o renderizador real `AbyssalDiverArt` para alternar prévias de roupa, máscara e acessórios, sem apresentar catálogo e sem alterar o perfil do jogador. A ilustração anterior `abyssal-login-scene.svg` foi retirada do aplicativo e do cache offline.
- `mobile/capacitor.config.json` aponta para a VPS em `https://abyssalgame.duckdns.org`. O domínio Render foi descontinuado e não deve ser reutilizado.
- O teste `scripts/login-ui-smoke.cjs` captura screenshots reais do Chromium em desktop, portrait e landscape, e valida alvos de toque e overflow.
- Verifique na Google Auth Platform se o aplicativo está em **Produção** antes de disponibilizar a autenticação para todos; em estado de teste, apenas contas Google autorizadas podem entrar.
- No Android já distribuído pela Google Play, o plugin nativo de credenciais exige AAB novo e publicação pela Play Console. O OAuth Android deve ter SHA-1 da assinatura da **Play Store**.

## Validação de lançamento
- Validar cadastros com datas limítrofes (15, 16, 17 e 18 anos), senhas incorretas e email duplicado.
- Verificar login antigo de Nekko e GameMaster, sessão persistente, logout e login Google sem associação indevida.
- Garantir que visitante não abre Online nem efetua compras vinculadas a conta.
- Realizar smoke mobile retrato/paisagem, desktop e Android nativo, inclusive tela de teclado virtual e recuperação de senha.
- Gerar AAB novo somente após CI Android aprovado, e testar através de instalação da Play Store.

## Arquivos alterados
`public/index.html`, `public/online.js`, `public/abyssal-login-v2.css`, `server.js`, `auth-birthdate.js`, `google-login.js`, `scripts/configure-android.cjs`, `public/offline-sw.js`, `public/privacy.html` `mobile/capacitor.config.json`, `scripts/login-ui-smoke.cjs` e testes relacionados.

## Verificação após deploy
- Abra `https://abyssalgame.duckdns.org/api/auth/google-config` e confirme `enabled: true` e `clientId` igual ao ID do cliente **Aplicativo da Web** no Google Cloud, sem presumir seu tipo pela aparência do ID.
- Confirme na Google Auth Platform que o **cliente é do tipo Web** e contém a origem JavaScript autorizada `https://abyssalgame.duckdns.org` (sem caminho).
- Confirme que o consentimento OAuth está em produção ou que a conta de teste está cadastrada. O código não pode habilitar nem verificar essas configurações externas sozinho.
- No Android, a credencial nativa precisa de um OAuth Android com SHA-1 do certificado de assinatura usado no Play Store e de AAB recompilado com o plugin `AbyssalGoogle`.

## Correções de regressão 3.6.137
- `online.js` tinha uma regex de JavaScript com barras duplas literais (`\\w`) que rejeitava até Client IDs corretos; agora a validação Web é compartilhada com o backend.
- A prévia de login sorteia a cada 1,9 s opções cosméticas de todas as categorias visuais e usa o renderizador do próprio jogo. `prefers-reduced-motion` mantém imagem estática por acessibilidade.
- Não há autorização Google Cloud/SSH da VPS conectada às ferramentas GitHub. CI valida código e APK/EXE, mas não comprova credenciais OAuth, cadastro de origem JavaScript, SHA-1 nem login de usuário real.

## Ajustes 3.6.138
- A prévia do armário troca cosméticos via temporizador independente de frames, em desktop e celular. A opção `prefers-reduced-motion: reduce` agora remove apenas o fade, **sem congelar os looks**. Teste Chromium em desktop 1280×720 simula preferência por movimento reduzido.
- `/api/auth/google-config` indica `source: fallback` quando falta configuração explícita na VPS. Nessa situação, um aviso informa que a origem e o tipo de cliente ainda precisam ser confirmados no Google Cloud. `enabled: true` verifica apenas a sintaxe, **não confirma** registro do Client ID no Google.
- O erro do Google `401 invalid_client`/“The OAuth client was not found” não pode ser resolvido inventando IDs em código; compare o cliente realmente existente no painel `Google Auth Platform > Clients` (tipo Web, origem `https://abyssalgame.duckdns.org`) e configure o valor correto em `/etc/abyssal/abyssal.env` como `ABYSSAL_GOOGLE_WEB_CLIENT_ID`, reiniciando `abyssal.service`.
