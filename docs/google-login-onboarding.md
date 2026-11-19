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
4. **Configuração confirmada em 19/11/2026:** o cliente `Abyssal Web` do Google Auth Platform (tipo Aplicativo da Web) tem ID público `356475666791-t5tfa24kg31qad3r1b5h4ecusvachjv6.apps.googleusercontent.com` e origem `https://abyssalgame.duckdns.org`. O cliente separado `Abyssal Android Play Store` tem ID `356475666791-b0m2248cgt80et9126c41br3mnk868v3.apps.googleusercontent.com`, pacote `com.esaneto.abyssal` e SHA-1 próprio. O cliente Web (e não o Android) deve ser passado ao navegador e ao `GetSignInWithGoogleOption` nativo como audience do token. O backend utiliza o ID Web confirmado como padrão quando `ABYSSAL_GOOGLE_WEB_CLIENT_ID` estiver ausente ou contiver o antigo erro de digitação/ID Android. **Nunca armazene client_secret no Git.**
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

## Diagnóstico e correções 3.6.139 (19/11)

- **Google 401 invalid_client:** o Google não reconhece o cliente recebido como um OAuth Web válido. Não há API pública confiável que verifique apenas a forma do ID. O fallback que tentava usar o ID anteriormente informado foi removido: a API só habilita Google quando `ABYSSAL_GOOGLE_WEB_CLIENT_ID` estiver explicitamente definido no ambiente da VPS. O valor precisa existir em Google Auth Platform > Clientes, ser do tipo **Aplicativo da Web** e autorizar `https://abyssalgame.duckdns.org`. O app Android (plugin Credential Manager) precisa também de um cliente Android separado com SHA-1 de assinatura do build instalado.
- **Atenção:** o campo `enabled: true` em `/api/auth/google-config` significa somente formato válido da configuração, **não confirma** que Google aceitou a credencial. Testar pelo browser real depois de publicar o ID confirmado.
- **Login responsivo:** o aviso `loginGoogleStatus` agora fica abaixo do botão oficial Google e nunca é acrescentado como irmão lateral de um iframe do SDK; limites de largura e padding para telas de desktop menores foram ajustados.
- **Cache e versões:** navegações online fazem fetch da página atual com `cache: no-store` e falham para cópia offline somente sem rede. Assets JS/CSS com query `?v=` não podem receber alias antigo, evitando o erro de página nova com script antigo. O modo Solo mantém cópia offline.
- A imagem enviada com texto “Login Google ainda precisa do Client ID OAuth no servidor” apresenta JavaScript de uma versão anterior à 3.6.137; não é uma evidência de que o pacote atual 3.6.138 falhou, porque essa mensagem já saiu do código.
- Após configurar o ID Web no painel Cloud e na VPS (`/etc/abyssal/abyssal.env`), reinicie o serviço `abyssal.service`, sem alterar `DATABASE_URL` ou qualquer segredo de pagamentos. **A conexão GitHub não permite editar o Google Cloud nem executar SSH na RoxyCloud.**

## Correção 3.6.140, 19/11/2026
- Os prints `WEB.PNG` e `APP.PNG` identificam tipos de clientes distintos no mesmo projeto Google Cloud.
- Causa encontrada: a primeira implementação **digitou incorretamente** o ID Web (salvou `356475666791-t6tfa24kg3iqad3r1b5h4ecusvachjv6.apps.googleusercontent.com`, que não coincide com o cliente realmente exibido no Cloud); depois passou a usar o ID Android em `google.accounts.id.initialize()` e, por fim, uma atualização retirou todo fallback, deixando `enabled:false` quando a VPS não tinha variável configurada.
- Agora `public/google-oauth-config.js` contém o ID Web público correto, o Android separado e o ID anterior incorreto somente para reconhecimento de configuração legada. `server.js` usa sempre o ID Web quando a variável está ausente ou contém um desses erros, e o mesmo ID valida `aud` no JWT do Google.
- Para confirmar na VPS, abra `https://abyssalgame.duckdns.org/api/auth/google-config`. O resultado esperado inclui `enabled: true` e `clientId: "356475666791-t5tfa24kg31qad3r1b5h4ecusvachjv6.apps.googleusercontent.com"`. Verifique a origem JavaScript no console e teste com uma conta real para comprovar a autenticação.
- A implantação continua dependente do deploy automático da RoxyCloud. O conector GitHub não dá acesso direto ao terminal VPS nem ao painel Google Cloud, portanto não se deve alegar que o login real foi concluído antes da verificação em produção.

## Correção definitiva de caractere, 19/11/2026
- O proprietário copiou o ID **diretamente do campo de texto** do Google Cloud: `356475666791-t5tfa24kg31qad3r1b5h4ecusvachjv6.apps.googleusercontent.com`.
- No código anterior estava `356475666791-t5tfa24kg3lqad3r1b5h4ecusvachjv6.apps.googleusercontent.com`, com **letra minúscula l** na sequência `kg3lqad`, mas no Google Cloud o caractere correto é **número 1**, resultando em `kg31qad`. Isso é suficiente para o erro `401 invalid_client` / `The OAuth client was not found`.
- Atualizado o cliente Web padrão e acrescentado o ID incorreto anterior à lista de IDs rejeitados. Se a variável da VPS ainda contiver o ID incorreto, o servidor a substitui pelo correto, mantendo o cliente Android separado e verificando a audiência JWT com o Web ID.
