(function(root){
const items=[
  {
    "id": "eagleray",
    "name": "Raia-Águia das Fossas",
    "family": "ray",
    "color": "#668fa5",
    "stat": "movement",
    "multiplier": 1.12,
    "ability": "Asas de corrente: +12% de velocidade, +7% de dano.",
    "price": 45000,
    "paid": false,
    "desc": "Asas largas pontilhadas, cabeça projetada e cauda longa. A corrente das Fossas passa pelas suas membranas azul-ardósia.",
    "bonuses": {
      "movement": 1.12,
      "damage": 1.07
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "ribbonmoray",
    "name": "Moreia-Fita Noturna",
    "family": "eel",
    "color": "#536bb0",
    "stat": "fireRate",
    "multiplier": 1.12,
    "ability": "Mandíbula rítmica: +12% de cadência, +7% de dano.",
    "price": 52000,
    "paid": false,
    "desc": "Corpo longo em S com pele azul-escura, crista violeta contínua, mandíbula aberta com dentes finos e olhos luminosos. Silhueta de fita reconhecível no movimento.",
    "bonuses": {
      "fireRate": 1.12,
      "damage": 1.07
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "dumbo",
    "name": "Polvo-Dumbo Hadal",
    "family": "octopus",
    "color": "#7988b6",
    "stat": "defense",
    "multiplier": 0.88,
    "ability": "Manto compressível: -12% de dano recebido, +8% de dano.",
    "price": 58000,
    "paid": false,
    "desc": "Manto quase esférico, duas nadadeiras laterais grandes que batem como orelhas, oito braços curtos e olhos expressivos. Um polvo hadal sem a silhueta de Kraken.",
    "bonuses": {
      "defense": 0.88,
      "damage": 1.08
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "blanket",
    "name": "Polvo-Cobertor Sombrio",
    "family": "octopus",
    "color": "#7842b3",
    "stat": "range",
    "multiplier": 1.19,
    "ability": "Membrana sensorial: +19% de alcance, +7% de dano.",
    "price": 64000,
    "paid": false,
    "desc": "Duas membranas roxas gigantes em forma de cobertor, bordas onduladas, nervuras aparentes e braços finos nas extremidades; a cabeça é pequena sob o manto.",
    "bonuses": {
      "range": 1.19,
      "damage": 1.07
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "atolla",
    "name": "Medusa-Atolla Carmesim",
    "family": "jelly",
    "color": "#a35d78",
    "stat": "experience",
    "multiplier": 1.18,
    "ability": "Coroa de ressonância: +18% de experiência, +6% de dano.",
    "price": 48000,
    "paid": false,
    "desc": "Campânula circular carmesim com borda serrilhada, dez filamentos radiais e um único tentáculo de alarme extremamente longo; o centro pulsa em vermelho.",
    "bonuses": {
      "experience": 1.18,
      "damage": 1.06
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "phantomjelly",
    "name": "Medusa-Fantasma Gigante",
    "family": "jelly",
    "color": "#68729b",
    "stat": "magnet",
    "multiplier": 1.3,
    "ability": "Braços coletores: +30% de atração de orbes, +7% de dano.",
    "price": 69000,
    "paid": false,
    "desc": "Medusa gigante translúcida de cúpula ampla e cinco longos braços orais em véus quase invisíveis, acompanhados de filamentos que flutuam pela escuridão.",
    "bonuses": {
      "magnet": 1.3,
      "damage": 1.07
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "yeticrab",
    "name": "Caranguejo-Yeti Abissal",
    "family": "crustacean",
    "color": "#93a8ae",
    "stat": "defense",
    "multiplier": 0.88,
    "ability": "Cerdas minerais: -12% de dano recebido, +8% de dano.",
    "price": 62000,
    "paid": false,
    "desc": "Carapaça mineral e pinças cobertas por cerdas claras, inspirado nos crustáceos das fontes hidrotermais.",
    "bonuses": {
      "defense": 0.88,
      "damage": 1.08
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "nautilus",
    "name": "Náutilo da Fossa",
    "family": "mollusc",
    "color": "#d0af84",
    "stat": "damage",
    "multiplier": 1.13,
    "ability": "Pressão espiral: +13% de dano, +10% de cadência.",
    "price": 72000,
    "paid": false,
    "desc": "Concha mineral espiralada com câmaras e costelas visíveis, capuz frontal e dezesseis tentáculos sensoriais finos projetados à frente da criatura.",
    "bonuses": {
      "damage": 1.13,
      "fireRate": 1.1
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "gharial",
    "name": "Gavial das Águas Negras",
    "family": "reptile",
    "color": "#46765b",
    "stat": "damage",
    "multiplier": 1.13,
    "ability": "Pinça de agulhas: +13% de dano, +10% de cadência.",
    "price": 80000,
    "paid": false,
    "desc": "Corpo de réptil com placas dorsais, quatro membros curtos e cauda propulsora; rostro de gavial muito longo, narina terminal e duas fileiras de dentes-agulha.",
    "bonuses": {
      "damage": 1.13,
      "fireRate": 1.1
    },
    "collection": "shop",
    "renderer": "marine"
  },
  {
    "id": "goblin",
    "name": "Tubarão-Duende",
    "family": "shark",
    "color": "#3a72c2",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Tubarão-Duende: +16% de dano, +8% de velocidade.",
    "price": 85000,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Tubarão-Duende: adaptação fantástica às Fossas, com anatomia de tubarão, placas sombreadas e fotóforos em azul-ardósia.",
    "renderer": "marine"
  },
  {
    "id": "frilled",
    "name": "Tubarão-Cobra",
    "family": "shark",
    "color": "#405879",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Tubarão-Cobra: -12% de dano recebido, +10% de cadência.",
    "price": 88500,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Tubarão-Cobra: adaptação fantástica às Fossas, com anatomia de tubarão, placas sombreadas e fotóforos em índigo escuro.",
    "renderer": "marine"
  },
  {
    "id": "greenland",
    "name": "Tubarão-da-Groenlândia",
    "family": "shark",
    "color": "#69857a",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Tubarão-da-Groenlândia: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 92000,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Tubarão-da-Groenlândia: adaptação fantástica às Fossas, com anatomia de tubarão, placas sombreadas e fotóforos em verde-sálvia.",
    "renderer": "marine"
  },
  {
    "id": "butterflyray",
    "name": "Raia-Borboleta",
    "family": "ray",
    "color": "#d6b36a",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Raia-Borboleta: +16% de dano, +8% de velocidade.",
    "price": 95500,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Raia-Borboleta: adaptação fantástica às Fossas, com anatomia de raia, placas sombreadas e fotóforos em âmbar.",
    "renderer": "marine"
  },
  {
    "id": "stingray",
    "name": "Raia-Prego",
    "family": "ray",
    "color": "#855075",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Raia-Prego: -12% de dano recebido, +10% de cadência.",
    "price": 99000,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Raia-Prego: adaptação fantástica às Fossas, com anatomia de raia, placas sombreadas e fotóforos em violeta-ameixa.",
    "renderer": "marine"
  },
  {
    "id": "guitarfish",
    "name": "Raia-Viola",
    "family": "ray",
    "color": "#b99b44",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Raia-Viola: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 102500,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Raia-Viola: adaptação fantástica às Fossas, com anatomia de raia, placas sombreadas e fotóforos em areia dourada.",
    "renderer": "marine"
  },
  {
    "id": "sawtootheel",
    "name": "Enguia-Serra",
    "family": "eel",
    "color": "#589a98",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Enguia-Serra: +16% de dano, +8% de velocidade.",
    "price": 106000,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Enguia-Serra: adaptação fantástica às Fossas, com anatomia de enguia, placas sombreadas e fotóforos em verde-petróleo.",
    "renderer": "marine"
  },
  {
    "id": "zebramoray",
    "name": "Moreia-Zebra",
    "family": "eel",
    "color": "#998f83",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Moreia-Zebra: -12% de dano recebido, +10% de cadência.",
    "price": 109500,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Moreia-Zebra: adaptação fantástica às Fossas, com anatomia de enguia, placas sombreadas e fotóforos em taupe mineral.",
    "renderer": "marine"
  },
  {
    "id": "dogtootheel",
    "name": "Enguia-Dente-de-Cão",
    "family": "eel",
    "color": "#794655",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Enguia-Dente-de-Cão: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 113000,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Enguia-Dente-de-Cão: adaptação fantástica às Fossas, com anatomia de enguia, placas sombreadas e fotóforos em vinho-rosado.",
    "renderer": "marine"
  },
  {
    "id": "mimic",
    "name": "Polvo-Mímico",
    "family": "octopus",
    "color": "#b154a2",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Polvo-Mímico: +16% de dano, +8% de velocidade.",
    "price": 116500,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Polvo-Mímico: adaptação fantástica às Fossas, com anatomia de polvo, placas sombreadas e fotóforos em lilás escuro.",
    "renderer": "marine"
  },
  {
    "id": "glassoctopus",
    "name": "Polvo-de-Vidro",
    "family": "octopus",
    "color": "#bdd6d9",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Polvo-de-Vidro: -12% de dano recebido, +10% de cadência.",
    "price": 120000,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Polvo-de-Vidro: adaptação fantástica às Fossas, com anatomia de polvo, placas sombreadas e fotóforos em menta translúcida.",
    "renderer": "marine"
  },
  {
    "id": "combjelly",
    "name": "Medusa-Pente",
    "family": "jelly",
    "color": "#7b9cc6",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Medusa-Pente: +16% de dano, +8% de velocidade.",
    "price": 127000,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Medusa-Pente: adaptação fantástica às Fossas, com anatomia de medusa, placas sombreadas e fotóforos em azul-iridescente.",
    "renderer": "marine"
  },
  {
    "id": "helmetjelly",
    "name": "Medusa-Capacete",
    "family": "jelly",
    "color": "#403d96",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Medusa-Capacete: -12% de dano recebido, +10% de cadência.",
    "price": 130500,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Medusa-Capacete: adaptação fantástica às Fossas, com anatomia de medusa, placas sombreadas e fotóforos em azul-profundo.",
    "renderer": "marine"
  },
  {
    "id": "siphonophore",
    "name": "Caravela Abissal",
    "family": "jelly",
    "color": "#63adb9",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Caravela Abissal: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 134000,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Caravela Abissal: adaptação fantástica às Fossas, com anatomia de medusa, placas sombreadas e fotóforos em turquesa.",
    "renderer": "marine"
  },
  {
    "id": "spidercrab",
    "name": "Caranguejo-Aranha",
    "family": "crustacean",
    "color": "#b27646",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Caranguejo-Aranha: +16% de dano, +8% de velocidade.",
    "price": 137500,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Caranguejo-Aranha: adaptação fantástica às Fossas, com anatomia de crustáceo, placas sombreadas e fotóforos em terracota.",
    "renderer": "marine"
  },
  {
    "id": "deeplobster",
    "name": "Lagosta-de-Profundidade",
    "family": "crustacean",
    "color": "#b0827b",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Lagosta-de-Profundidade: -12% de dano recebido, +10% de cadência.",
    "price": 141000,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Lagosta-de-Profundidade: adaptação fantástica às Fossas, com anatomia de crustáceo, placas sombreadas e fotóforos em cobre rosado.",
    "renderer": "marine"
  },
  {
    "id": "pistolshrimp",
    "name": "Camarão-Pistola",
    "family": "crustacean",
    "color": "#c28e61",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Camarão-Pistola: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 144500,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Camarão-Pistola: adaptação fantástica às Fossas, com anatomia de crustáceo, placas sombreadas e fotóforos em laranja mineral.",
    "renderer": "marine"
  },
  {
    "id": "scalyfoot",
    "name": "Caramujo-Vulcânico",
    "family": "mollusc",
    "color": "#996957",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Caramujo-Vulcânico: +16% de dano, +8% de velocidade.",
    "price": 148000,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Caramujo-Vulcânico: adaptação fantástica às Fossas, com anatomia de molusco, placas sombreadas e fotóforos em cobre vulcânico.",
    "renderer": "marine"
  },
  {
    "id": "bluedragon",
    "name": "Lesma-Dragão-Azul",
    "family": "mollusc",
    "color": "#2767d5",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Lesma-Dragão-Azul: -12% de dano recebido, +10% de cadência.",
    "price": 151500,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Lesma-Dragão-Azul: adaptação fantástica às Fossas, com anatomia de molusco, placas sombreadas e fotóforos em azul luminoso.",
    "renderer": "marine"
  },
  {
    "id": "whelk",
    "name": "Búzio das Fossas",
    "family": "mollusc",
    "color": "#769f90",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Búzio das Fossas: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 155000,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Búzio das Fossas: adaptação fantástica às Fossas, com anatomia de molusco, placas sombreadas e fotóforos em verde-acqua.",
    "renderer": "marine"
  },
  {
    "id": "leatherback",
    "name": "Tartaruga-de-Couro",
    "family": "reptile",
    "color": "#2c536f",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Tartaruga-de-Couro: +16% de dano, +8% de velocidade.",
    "price": 158500,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Tartaruga-de-Couro: adaptação fantástica às Fossas, com anatomia de réptil aquático, placas sombreadas e fotóforos em azul-escuro.",
    "renderer": "marine"
  },
  {
    "id": "seasnake",
    "name": "Serpente-Marinha",
    "family": "reptile",
    "color": "#6d9b38",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Serpente-Marinha: -12% de dano recebido, +10% de cadência.",
    "price": 162000,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Serpente-Marinha: adaptação fantástica às Fossas, com anatomia de réptil aquático, placas sombreadas e fotóforos em oliva.",
    "renderer": "marine"
  },
  {
    "id": "hawksbill",
    "name": "Tartaruga-de-Pente",
    "family": "reptile",
    "color": "#c49b36",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Tartaruga-de-Pente: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 165500,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Tartaruga-de-Pente: adaptação fantástica às Fossas, com anatomia de réptil aquático, placas sombreadas e fotóforos em verde-oliva.",
    "renderer": "marine"
  },
  {
    "id": "jewelsquid",
    "name": "Lula-Joia",
    "family": "squid",
    "color": "#a8729c",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Lula-Joia: +16% de dano, +8% de velocidade.",
    "price": 169000,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Lula-Joia: adaptação fantástica às Fossas, com anatomia de lula, placas sombreadas e fotóforos em rosa-ametista.",
    "renderer": "marine"
  },
  {
    "id": "bigfin",
    "name": "Lula-de-Barbatanas-Longas",
    "family": "squid",
    "color": "#7477ac",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Lula-de-Barbatanas-Longas: -12% de dano recebido, +10% de cadência.",
    "price": 172500,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Lula-de-Barbatanas-Longas: adaptação fantástica às Fossas, com anatomia de lula, placas sombreadas e fotóforos em lavanda azulada.",
    "renderer": "marine"
  },
  {
    "id": "whiplash",
    "name": "Lula-Chicote",
    "family": "squid",
    "color": "#9c85c5",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Lula-Chicote: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 176000,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Lula-Chicote: adaptação fantástica às Fossas, com anatomia de lula, placas sombreadas e fotóforos em lilás elétrico.",
    "renderer": "marine"
  },
  {
    "id": "viperfish",
    "name": "Peixe-Víbora",
    "family": "fish",
    "color": "#d34c69",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Peixe-Víbora: +16% de dano, +8% de velocidade.",
    "price": 179500,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Peixe-Víbora: adaptação fantástica às Fossas, com anatomia de peixe de profundidade, placas sombreadas e fotóforos em vermelho abissal.",
    "renderer": "marine"
  },
  {
    "id": "blackdragon",
    "name": "Peixe-Dragão-Negro",
    "family": "fish",
    "color": "#7961a4",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Peixe-Dragão-Negro: -12% de dano recebido, +10% de cadência.",
    "price": 183000,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Peixe-Dragão-Negro: adaptação fantástica às Fossas, com anatomia de peixe de profundidade, placas sombreadas e fotóforos em violeta escuro.",
    "renderer": "marine"
  },
  {
    "id": "hatchetfish",
    "name": "Peixe-Machado",
    "family": "fish",
    "color": "#759dac",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Peixe-Machado: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 186500,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Peixe-Machado: adaptação fantástica às Fossas, com anatomia de peixe de profundidade, placas sombreadas e fotóforos em azul gelo.",
    "renderer": "marine"
  },
  {
    "id": "basketstar",
    "name": "Estrela-Cesto",
    "family": "benthic",
    "color": "#6eae9e",
    "stat": "damage",
    "multiplier": 1.16,
    "bonuses": {
      "damage": 1.16,
      "movement": 1.08
    },
    "ability": "Impulso predatório de Estrela-Cesto: +16% de dano, +8% de velocidade.",
    "price": 190000,
    "paid": false,
    "collection": "shop",
    "morph": 1,
    "desc": "Estrela-Cesto: adaptação fantástica às Fossas, com anatomia de organismo bentônico, placas sombreadas e fotóforos em verde-mar.",
    "renderer": "marine"
  },
  {
    "id": "crinoid",
    "name": "Lírio-do-Mar",
    "family": "benthic",
    "color": "#e0be8f",
    "stat": "defense",
    "multiplier": 0.88,
    "bonuses": {
      "defense": 0.88,
      "fireRate": 1.1
    },
    "ability": "Véu de pressão de Lírio-do-Mar: -12% de dano recebido, +10% de cadência.",
    "price": 193500,
    "paid": false,
    "collection": "shop",
    "morph": 2,
    "desc": "Lírio-do-Mar: adaptação fantástica às Fossas, com anatomia de organismo bentônico, placas sombreadas e fotóforos em bronze claro.",
    "renderer": "marine"
  },
  {
    "id": "seapig",
    "name": "Pepino-do-Mar Hadal",
    "family": "benthic",
    "color": "#858e69",
    "stat": "range",
    "multiplier": 1.18,
    "bonuses": {
      "range": 1.18,
      "magnet": 1.25,
      "damage": 1.04
    },
    "ability": "Sentidos da escuridão de Pepino-do-Mar Hadal: +18% de alcance, +25% de atração de orbes, +4% de dano.",
    "price": 197000,
    "paid": false,
    "collection": "shop",
    "morph": 3,
    "desc": "Pepino-do-Mar Hadal: adaptação fantástica às Fossas, com anatomia de organismo bentônico, placas sombreadas e fotóforos em verde-musgo.",
    "renderer": "marine"
  }
];
const api={items,byId:Object.fromEntries(items.map(s=>[s.id,s]))};
if(typeof module!=="undefined")module.exports=api;root.AbyssalCuratedSkins=api;
})(globalThis);
