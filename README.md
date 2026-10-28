# Abyssal — Ecos das Profundezas (atualização de combate)

## Instalação local
1. Extraia a pasta.
2. Abra a pasta no VS Code.
3. Execute `npm install`.
4. Execute `npm start`.
5. Abra `http://localhost:3000`.

## Atualizações desta versão
- Invulnerabilidade durante a seleção de habilidades em solo e online: até 10 segundos para escolher; ao escolher, ficam 2 segundos de proteção.
- O tempo de escolha agora termina após 10 segundos também no modo solo; se não houver escolha, uma habilidade disponível é selecionada automaticamente.
- Contato com inimigo aplica dano imediatamente quando o jogador não está invulnerável.
- Chefes aparecem a partir dos 3 minutos, em janelas separadas de 3 minutos, escolhidos aleatoriamente e sem repetir o mesmo tipo em aparições consecutivas.
- Só pode haver um chefe ativo por vez.
- Cada chefe derrotado aumenta em 50% a escala de vida e velocidade de progressão de dano do próximo chefe. A velocidade do chefe é limitada à velocidade atual do jogador.
- Inimigos comuns usam vida e velocidade fixas para priorizar os chefes como desafio de progressão.
- Habilidade de dano passou a aumentar o dano em 50% por nível; dano-base dos disparos foi ajustado para tornar a melhoria mais perceptível.
- Cadência automática online agora respeita a habilidade de velocidade de disparo e fica alinhada ao intervalo-base do modo solo.

## Observações importantes
- Esta atualização não integra anúncios reais nem pagamentos reais: isso exige cadastro e configuração em um provedor de anúncios e um provedor de pagamentos, além de validação no servidor.
- Não configure recompensas de anúncios apenas no navegador. A confirmação do anúncio e a entrega das moedas devem ser validadas pelo servidor para evitar fraude.
- Para manter contas e moedas entre reinicializações no Render, confirme que o serviço tem armazenamento persistente ou migre os dados para um banco de dados externo. O armazenamento em arquivos locais pode ser perdido em ambientes sem disco persistente.
