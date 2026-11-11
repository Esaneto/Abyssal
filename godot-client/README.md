# Abyssal | Cliente Godot 4

Esta pasta inicia uma **nova versão nativa** do Abyssal e não altera o cliente HTML/JavaScript, os serviços Node.js nem o PostgreSQL.

## Abrir no Godot (Windows)
1. No **Gerenciador de Projetos**, selecione **Importar**.
2. Aponte para `godot-client/project.godot` dentro de uma cópia local do repositório.
3. Abra o projeto e pressione **F6** na cena ou **F5** para iniciar.

## Controles do protótipo
- Enter ou clique em **MERGULHAR**: alterna da cabine para a cena de Mar Aberto.
- WASD ou setas: nadar com aceleração, inércia e resistência da água. Soltar o controle ativa a flutuabilidade positiva.
- Descer: segure S/seta para baixo; subir: W/seta para cima. O personagem pode emergir para recuperar oxigênio.
- Há colisão com o fundo ondulado. Oxigênio esgota na água e se recupera na superfície; ausência de oxigênio causa perda gradual de vida.
- Esc: retorna à cabine.

## Estado atual
Este é um **protótipo de fundação**, com renderização procedural, física simplificada de mergulho com passo fixo, flutuabilidade, arrasto, colisão com fundo e sobrevivência local. A profundidade exibida é simulada, não corresponde a uma escala física real. Não substitui a implementação em Canvas, não reutiliza ainda os sprites finais e não está conectado ao multiplayer. A arte ainda não reproduz a imagem de referência.

## Plano de migração
1. Validar importação, execução e capturas Windows/Android.
2. Produzir os assets definitivos, recriar câmera, iluminação, mundo particionado e colisões.
3. Adaptar o protocolo Socket.IO/WebSocket ou introduzir uma camada WebSocket compatível no backend.
4. Migrar progressivamente inventário, fauna, combate, espécimes, habilidades, Fossas e loja.
5. Executar testes de regressão e multiplayer antes de considerar a substituição do cliente antigo.

O Render permanece como ambiente de testes, sem alterações nesta primeira etapa.
