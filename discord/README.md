# Abyssal Sonar — gestão permanente do Discord

Servidor oficial: 1571872096169238688. Aplicativo: 1571872606406054008.

## Ativação única pelo proprietário

1. Em GitHub > Settings > Secrets and variables > Actions > New repository secret, crie `ABYSSAL_DISCORD_BOT_TOKEN` com o token ATUAL do bot. Nunca cole em mensagens, código, variáveis públicas ou logs. Não é necessário redefinir se não foi exposto.
2. No Discord, cargo do Sonar: desative Administrador. Ative Gerenciar canais, Ver canais, Criar expressões (CREATE_GUILD_EXPRESSIONS). Para a categoria restrita, conceda explicitamente Ver canais e Gerenciar canais ao cargo do Sonar, sem liberar aos membros.
3. GitHub > Actions > Abyssal Sonar - Discord > Run workflow. Escolha main e apply true. A execução mostra o relatório. apply false apenas consulta e apresenta a prévia.
4. Mudanças futuras em discord/sonar-config.json ou no código discord/ são aplicadas automaticamente no push em main. Não há dependência da VPS ou do jogo.

## Limites de segurança

A rotina verifica a identidade do bot e do servidor. Renomeia canais existentes por categoria e nome, sem mover, apagar, mudar permissões ou alterar histórico. Cria apenas emojis ausentes, preserva existentes. Não cria canais ausentes para não duplicar nem alterar canais privados; informa o problema. Reexecução idempotente. Se mudar um nome já personalizado, use o nome atual como old. Para nomes de texto, Discord pode normalizar espaços ou Unicode; a comparação tolera caixa/espaço e seletor de apresentação.

Os 12 emojis originais são PNGs gerados por código, com transparência. Os nomes de canais usam Unicode nativo porque emojis de servidor não renderizam nesses nomes.

Esta integração é uma automação permanente sob demanda; não mantém presença online no Discord, não oferece comandos de jogo, música, ranking, mensagens nem acesso ao banco. Não concede privilégios administrativos. Para novas operações, implemente uma mudança explícita e teste antes de publicar. Ações externas ao repositório exigem autorização do proprietário.
