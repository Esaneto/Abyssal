# Atlas Dark Fantasy para o Abyssal
Este diretório recebe **um único arquivo**: `abyssal_ecos_integracao_assets.zip`.

Ao fazer commit dele na branch `main`, o workflow `Install Abyssal Dark Fantasy sprites`:
1. Confere os 26 atlas RGBA WebP dos 13 inimigos Solo/Online.
2. Rejeita nomes, formatos e dimensões inesperados.
3. Executa as verificações do renderizador.
4. Publica os WebPs em `public/abyssal-horror/<ID>/{swim,attack}.webp`.
5. Ativa o manifesto apenas quando toda a validação passar.

O motor permanece com fallback às artes antigas se o ZIP não for enviado, se a importação falhar ou se a imagem de uma criatura não estiver disponível. Não altera dano, colisão nem IA.

Use o pacote `abyssal_ecos_integracao_assets.zip` produzido no ChatGPT. Não renomeie o arquivo dentro desta pasta.
