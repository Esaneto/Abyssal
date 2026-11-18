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
4. Configure somente o **ID público do cliente Web** no servidor como `ABYSSAL_GOOGLE_WEB_CLIENT_ID` em `/etc/abyssal/abyssal.env`. Reinicie o serviço quando não houver partidas ativas. **Nunca envie o segredo do cliente nem a chave JSON para o repositório**.
5. A versão Android precisa ser compilada a partir de `scripts/configure-android.cjs`, incluindo o plugin nativo `AbyssalGoogle`; versões antigas do AAB não oferecem essa capacidade.

### Segurança
O servidor valida assinatura JWT RSA, emissor, audiência, validade, ID do sujeito e email verificado antes de emitir a sessão local. Uma identidade Google **não** herda contas existentes por compartilhar o mesmo endereço de email. O cadastro Google pede nickname, data de nascimento e aceite dos termos, sem senha local.

### Testadores da Google Play
Acesso como **Nekko** ou **GameMaster** no Abyssal é independente do teste de faturamento da Play Console. A lista de **testadores de licença da Play Store** deve receber endereços de **contas Google**, não nicknames de jogo. Nenhuma conta de teste de licença é adicionada automaticamente pelo código.

## Validação de lançamento
- Validar cadastros com datas limítrofes (15, 16, 17 e 18 anos), senhas incorretas e email duplicado.
- Verificar login antigo de Nekko e GameMaster, sessão persistente, logout e login Google sem associação indevida.
- Garantir que visitante não abre Online nem efetua compras vinculadas a conta.
- Realizar smoke mobile retrato/paisagem, desktop e Android nativo, inclusive tela de teclado virtual e recuperação de senha.
- Gerar AAB novo somente após CI Android aprovado, e testar através de instalação da Play Store.

## Arquivos alterados
`public/index.html`, `public/online.js`, `public/abyssal-login-v2.css`, `public/abyssal-login-scene.svg`, `server.js`, `auth-birthdate.js`, `google-login.js`, `scripts/configure-android.cjs`, `public/offline-sw.js`, `public/privacy.html` e testes relacionados.
