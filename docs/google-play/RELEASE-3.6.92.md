# Abyssal — preparação do teste Google Play (14/11/2026)
## Identidade
- Pacote: com.esaneto.abyssal. Grátis, Jogo > Ação, pt-BR.
- Nome: Abyssal: Ecos das Profundezas.
- Contato: abyssalelectrongames@gmail.com.
- Site: https://abyssalgame.duckdns.org
- Privacidade: https://abyssalgame.duckdns.org/privacy.html
- Exclusão: https://abyssalgame.duckdns.org/delete-account.html
- Versão anterior assinada: 3.6.91, versionCode 3424, target API 36, min API 24. Certificado SHA256 CE:33:43:3B:CB:7E:49:AA:B9:5D:1B:4E:79:30:19:2C:46:A6:5B:0E:AD:9A:FB:94:11:95:3A:97:1C:41:62:A7.
- 3.6.92: corrigido gerador que duplicava FileProvider; auditoria do AAB final e atualização do teste de idade. Aguardar resultado do novo CI antes de tratar como candidato validado.
## Ficha
Curta: Explore o abismo, enfrente criaturas e evolua em mergulhos solo ou online.
Longa:
Mergulhe em um oceano misterioso e sobreviva aos perigos das profundezas em Abyssal: Ecos das Profundezas.

Prepare a expedição na cabine do submarino, enfrente criaturas marinhas e chefes, colete energia e evolua seu mergulhador.

• Mergulho Solo: sobreviva em cavernas submarinas, desenvolva habilidades e enfrente predadores.
• Mergulho Online: participe de expedições cooperativas com outros jogadores.
• Espécimes e Abyssário: descubra criaturas e equipe companheiros para auxiliar no combate.
• Pesquisa: desenvolva equipamentos, melhorias e habilidades de ressonância.
• Submarino: gerencie energia, sistemas de defesa e reparos.
• Personalização: escolha trajes, cabelos, acessórios, armas e nadadeiras.
• Progressão: acompanhe conquistas, títulos e classificações.

O modo Solo pode funcionar offline. Recursos multiplayer, conta, sincronização e anúncios dependem de conexão. O jogo apresenta combate fictício e atmosfera de suspense.

Não anunciar Mar Aberto, Fossas, PvP ou compras monetárias Android enquanto indisponíveis.
## Declarações
- Ads: sim. UMP no Android e AdMob 25.5.0; anúncios premiados adultos, opcionais; SSV obrigatório.
- Acesso: algumas funções restritas; Solo pode ser testado sem conta; fornecer conta normal de revisão para Online, perfil, roleta. Usar GoogleReviewer01 / GoogleReviewer02 só se provisionados no VPS e testados. Senhas não são públicas, não inserir neste repositório.
- Público pretendido: 16–17 e 18+. IARC deve resultar do questionário: violência de fantasia, efeitos de sangue, morte, terror/suspense; interação online; nomes/descrições criados por usuários; reportar conteúdo e bloquear; sem chat público. Não inventar classificação final.
- Compras: vendas digitais Android bloqueadas no checkout nativo até Billing; Stripe continua web/desktop. Não configurar produtos Play nem afirmar compras Android disponíveis. Energia e itens virtuais não conversíveis em dinheiro.
- ID de publicidade: declarar uso presente; finalidade publicidade, analytics e fraude conforme SDK.
- Segurança dos dados: sim, dados coletados; nickname, UUID, e-mail quando fornecido, autenticação, progresso e histórico, conteúdo social e denúncias; IP técnico; Google SDK coleta e compartilha localização aproximada inferida por IP, interações, diagnósticos e identificadores; conta e dados podem ser apagados via app ou recurso externo. Confirmar fluxo de exclusão real e retenções antes de submeter. Não declarar dados de cartão completos coletados pelo jogo. Avaliar compras anteriores sincronizadas do serviço mesmo com vendas Android bloqueadas. Dados técnicos transitam por TLS; não marcar tipos que não são coletados (contatos, câmera, microfone, localização precisa) sem verificar.
- Política pública atualizada para RoxyCloud, Neon, UMP e anúncios Android 18+. Conferir URL no VPS após deploy.
## Assinatura
Manter a chave permanente já usada no APK direto. Antes do primeiro envio, preferir importar chave de assinatura existente no Play para preservar atualização entre canais; a chave de upload é conceito separado. Usar ferramenta PEPK e comando fornecidos no próprio Console. Conferir certificado com SHA256 acima. Nunca publicar JKS, senha ou segredo. Não substituir chave sem planejamento de migração.
## Teste
Teste interno opcional agora. Só iniciar contagem oficial após >=12 opt-in no teste fechado por 14 dias consecutivos; recrutar 15–20. Coletar feedback real, modelo de telefone, Android, versão, etapas e resultados. Testar login, teclado, Solo, Coop, perfil e cosméticos, áudio, modo offline, retorno de conexão, exclusão e anúncios em dispositivo de teste. Nunca assistir anúncios próprios de produção para ganhar dinheiro. Guardar evidências antes de solicitar produção.
## Bloqueios
CI 3.6.91: 675/719 testes gerais aprovados, 44 falhas e smoke Solo não iniciou por seletor de idade antigo no harness. Corrigir e reexecutar; não remover asserções para simular sucesso. AAB anterior assinado, sem permissão sideload, mas manifesto final continha duas declarações de FileProvider. Nova auditoria exige somente uma. Teste em Android físico e aprovação do Console ainda pendentes.
## Referências
https://support.google.com/googleplay/android-developer/answer/9842756?hl=pt-BR
https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR
https://support.google.com/googleplay/android-developer/answer/9866151
https://developers.google.com/admob/android/privacy/play-data-disclosure?hl=pt-br
