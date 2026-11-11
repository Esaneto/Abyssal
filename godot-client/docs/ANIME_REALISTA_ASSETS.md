# Abyssal: arte original anime-realista no Godot

## Escopo desta melhoria

O mergulhador e a mergulhadora agora podem utilizar diretamente os dois
PNGs anime-realistas aprovados, **sem redesenho vetorial de baixa fidelidade**.
O sistema de aparência existente continua responsável pelo gênero, pelos
IDs cosméticos e pelo salvamento. A cabine mostra um recorte da mesma textura
que o jogo utiliza na água; não é um screenshot do menu colado por cima.

## Instalação obrigatória dos arquivos binários

**Os dois PNGs grandes são distribuídos em pacote separado.** O código
deste repositório suporta o pacote e não assume que ele já está instalado.

1. Baixe o arquivo `abyssal_anime_realista_godot_assets.zip` entregue
   junto à revisão.
2. Extraia-o na **raiz do repositório**, não dentro da pasta de scripts.
3. Confira os arquivos:
   - `godot-client/assets/art/characters/anime_diver_female.png`
   - `godot-client/assets/art/characters/anime_diver_male.png`
4. Abra `godot-client/project.godot` no Godot 4.7.2.
5. Na cabine, pressione `C` e alterne o corpo entre masculino e feminino.
6. Entre no Mar Aberto e observe o personagem com as mesmas escolhas.

O importador opcional `scripts/install_anime_diver_art.py` também instala
o pacote e verifica o SHA-256 dos PNGs originais.

**SHA-256 exatos:**
- Feminino: `67e69b24fedb2a9907ac275d9b6093cdd149a3beffaec76753a4bbf690220904`
- Masculino: `c5f4203ec28957ff5e96d46bbfa49625f8ca65aabf9b4365bb6d08cf9e6d74b2`

## Renderização e animação

- `scripts/anime_diver_art.gd`: resolve as imagens, monta uma malha UV
  subdividida 36×28, conserva os PNGs completos e oferece um recorte de
  personagem para a Cabine.
- `shaders/anime_diver_swim.gdshader`: deslocamento regional da malha
  para nadadeiras, cabelo, movimento respiratório, reflexos discretos e
  recoloração opcional de neoprene/cabelo.
- `scripts/diver_native.gd`: usa o novo desenho no `_draw`, mantendo
  colisão, controles, pressão, dano, oxigênio e deslocamento existentes.
- `scripts/native_cabin_art.gd`: usa o mesmo PNG selecionado no perfil
  para a prévia da Cabine, preservando os painéis interativos.
- `scripts/exploration_progress.gd`: permanece fonte de verdade do gênero
  e dos cosméticos e continua compatível com saves locais.

A animação por malha não é um spritesheet de movimentos totalmente novos,
nem um rig completo de ossos. É uma primeira camada de movimento suave
sobre os assets aprovados, suficiente para nado e flutuação discreta,
sem alterar os pixels do arquivo original.

## Limites cosméticos e próximos passos

As duas artes originais já incluem cabelo, traje e scanner. Isso significa
que o *body* masculino/feminino muda imediatamente com fidelidade integral,
enquanto mudar o modelo físico do cabelo ou remover completamente o scanner
exige separar cada elemento visual em sprites próprios (ou criar novas
variações de alta resolução). As opções de cor têm tratamento simples,
sem garantia de reprodução exata na Cabine em cada combinação.

Não esconda essa limitação com promessas de "tudo modular". A base de seis
slots continua válida; o próximo refinamento deverá gerar os recortes de
cabelo, braço, equipamento, máscara, roupa e nadadeiras em resolução
original, preservando pontos de ancoragem e máscaras de oclusão.

## Testes

O CI automatizado de Godot testa o carregamento do script, a criação da
malha UV, o shader e as regras antigas com fallback. As capturas do CI
que não incluem o pacote PNG **não representam o visual final**. Para
revisar o acabamento verdadeiro, é necessário executar o Godot após
instalar os dois PNGs.

É intencional manter o visual procedural como fallback quando esses
arquivos grandes não estão presentes, evitando quebrar instalações
antigas e a execução de testes.
