extends RefCounted
## Shared biological field guide + procedural creature artwork for the expedition.
## Distinct silhouettes, no shooter mechanics. Depths in approximate GAME meters.
## A creature's illustrated longest dimension is never < 40% of the diver length.

const DIVER_LENGTH_PX := 104.0
const MIN_LENGTH_PX := DIVER_LENGTH_PX * 0.4

const SPECIES := [
	{
		"id": "manta", "name": "Raia-manta-oceanica",
		"scientific": "Mobula birostris",
		"zone": "Zona iluminada", "min_m": 0.0, "max_m": 250.0,
		"length_px": 260.0, "temperament": "Curiosa e pacifica",
		"habitat": "Coluna de agua aberta, proxima de areas produtivas.",
		"how_to_find": "Explore as correntes iluminadas, longe de rochas.",
		"story": "Filtra plancton; suas asas desenham sombras enormes."
	},
	{
		"id": "eagle_ray", "name": "Raia-pintada",
		"scientific": "Aetobatus narinari",
		"zone": "Talude tropical", "min_m": 0.0, "max_m": 185.0,
		"length_px": 160.0, "temperament": "Pacifica e cautelosa",
		"habitat": "Recifes costeiros e aguas abertas sobre o talude.",
		"how_to_find": "Explore os recifes iluminados e bordas rochosas entre 0 e 185 m.",
		"story": "Nadadeiras largas e manchas claras distinguem a raia-pintada."
	},
	{
		"id": "turtle", "name": "Tartaruga-verde",
		"scientific": "Chelonia mydas",
		"zone": "Zona iluminada", "min_m": 0.0, "max_m": 180.0,
		"length_px": 111.0, "temperament": "Reservada",
		"habitat": "Costas rasas, bancos de algas e areas oceanicas.",
		"how_to_find": "Procure perto do talude raso e dos campos de algas.",
		"story": "Cruza grandes distancias e retorna para respirar."
	},
	{
		"id": "jelly", "name": "Medusa-luminosa",
		"scientific": "Pelagia noctiluca",
		"zone": "Coluna de agua", "min_m": 0.0, "max_m": 900.0,
		"length_px": 85.0, "temperament": "Deriva com as correntes",
		"habitat": "Agua aberta, em varias profundidades.",
		"how_to_find": "Observe correntes e brilhos entre a superficie e a penumbra.",
		"story": "Uma pulsacao delicada esconde tentaculos urticantes."
	},
	{
		"id": "oarfish", "name": "Peixe-remo",
		"scientific": "Regalecus glesne",
		"zone": "Penumbra", "min_m": 200.0, "max_m": 1000.0,
		"length_px": 440.0, "temperament": "Esquivo",
		"habitat": "Agua oceanica profunda, longe de recifes rasos.",
		"how_to_find": "Desca alem de 200 m; observe silhuetas longas no vazio.",
		"story": "Seu corpo prateado se move como uma fita sem fim."
	},
	{
		"id": "viper", "name": "Peixe-vibora",
		"scientific": "Chauliodus sloani",
		"zone": "Penumbra", "min_m": 300.0, "max_m": 1250.0,
		"length_px": 87.0, "temperament": "Predador de emboscada",
		"habitat": "Agua escura da zona mesopelagica e abaixo.",
		"how_to_find": "Desca alem de 300 m e procure fotoforos na escuridao.",
		"story": "Dentes exagerados e pontos luminosos no ventre."
	},
	{
		"id": "vampire", "name": "Lula-vampira",
		"scientific": "Vampyroteuthis infernalis",
		"zone": "Penumbra profunda", "min_m": 600.0, "max_m": 1100.0,
		"length_px": 124.0, "temperament": "Defensiva e lenta",
		"habitat": "Coluna de agua pobre em oxigenio, longe da luz.",
		"how_to_find": "Entre 600 e 1000 m, observe movimentos lentos no escuro.",
		"story": "Sua capa vermelha forma um guarda-chuva escuro."
	},
	{
		"id": "angler", "name": "Tamboril-abissal",
		"scientific": "Melanocetus johnsonii",
		"zone": "Escuridao", "min_m": 750.0, "max_m": 2000.0,
		"length_px": 97.0, "temperament": "Predador solitario",
		"habitat": "Aguas profundas, onde a luz solar ja desapareceu.",
		"how_to_find": "Alem de 750 m; pequenas iscas luminosas denunciam sua presenca.",
		"story": "Uma isca luminosa chama criaturas para a mandibula."
	},
	{
		"id": "isopod", "name": "Isopode-gigante",
		"scientific": "Bathynomus giganteus",
		"zone": "Fundo profundo", "min_m": 220.0, "max_m": 2200.0,
		"length_px": 95.0, "temperament": "Necrófago de fundo",
		"habitat": "Sedimentos escuros e encostas profundas.",
		"how_to_find": "Siga o solo nas profundezas e procure placas segmentadas.",
		"story": "Uma armadura segmentada percorre o solo silencioso."
	},
	{
		"id": "gulper", "name": "Enguia-pelicano",
		"scientific": "Eurypharynx pelecanoides",
		"zone": "Abismo", "min_m": 600.0, "max_m": 2200.0,
		"length_px": 185.0, "temperament": "Cacadora discreta",
		"habitat": "Coluna de agua profunda, longe das superficies iluminadas.",
		"how_to_find": "Siga os lampejos solitarios e observe mandibulas desproporcionais.",
		"story": "Uma boca enorme e uma cauda finissima definem seu perfil."
	},
	{
		"id": "seapig", "name": "Porco-do-mar",
		"scientific": "Scotoplanes globosa",
		"zone": "Planicie abissal", "min_m": 1000.0, "max_m": 2200.0,
		"length_px": 89.0, "temperament": "Detritivoro pacifico",
		"habitat": "Sedimentos ricos em materia organica no fundo abissal.",
		"how_to_find": "Inspecione o solo frio, alem de mil metros simulados.",
		"story": "Apêndices quase transparentes vasculham o sedimento lentamente."
	}
]

static func get_species(species_id: String) -> Dictionary:
	for entry in SPECIES:
		if entry["id"] == species_id:
			return entry
	return {}

static func candidates_at(depth_m: float, seabed_distance_px: float) -> Array[Dictionary]:
	var pool: Array[Dictionary] = []
	for entry in SPECIES:
		if depth_m >= float(entry["min_m"]) and depth_m <= float(entry["max_m"]):
			if not (entry["id"] in ["isopod", "seapig"]) or seabed_distance_px < 220.0:
				pool.append(entry)
	return pool

static func _oval(canvas: Node2D, c: Vector2, radii: Vector2, tint: Color) -> void:
	var vertices := PackedVector2Array()
	for k in range(33):
		var a := TAU * float(k) / 32.0
		vertices.append(c + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	canvas.draw_colored_polygon(vertices, tint)

static func _poly(canvas: Node2D, vertices: Array, tint: Color) -> void:
	canvas.draw_colored_polygon(PackedVector2Array(vertices), tint)

static func _line(canvas: Node2D, a: Vector2, b: Vector2, tint: Color, weight: float = 2.0) -> void:
	canvas.draw_line(a, b, tint, weight, true)

static func paint(canvas: Node2D, species_id: String, pos: Vector2, direction: float, time_s: float, size_px: float, light: float) -> void:
	# All local silhouettes are about 100px long, uniformly scaled into world units.
	# Over-sized species retain their spectacular scale, even beyond the viewport.
	var scale_factor := maxf(size_px, MIN_LENGTH_PX) / 100.0
	var sign_x := 1.0 if direction >= 0.0 else -1.0
	canvas.draw_set_transform(pos, 0.0, Vector2(sign_x * scale_factor, scale_factor))
	var breathe := sin(time_s * 1.7 + pos.x * 0.005)
	var dark := Color("#0b2232")
	var silver := Color("#8fb8bc").lerp(Color("#223b48"), 1.0 - light)
	var glow := Color("#57dce8")
	match species_id:
		"manta":
			# Softly shaded wings and a clear diamond-like giant silhouette.
			var wing := 9.0 * sin(time_s * 1.3 + pos.x * 0.01)
			_line(canvas, Vector2(-36, 5), Vector2(-73, 15 + breathe * 3.0), Color("#355969"), 2.5)
			var contour := PackedVector2Array([
				Vector2(-48, 2), Vector2(-25, -9),
				Vector2(-26, -38 - wing), Vector2(1, -22),
				Vector2(31, -11), Vector2(49, -1),
				Vector2(31, 11), Vector2(5, 20),
				Vector2(-27, 36 + wing), Vector2(-23, 7)
			])
			var shades := PackedColorArray([
				Color("#254755"), Color("#496778"), Color("#243c4b"),
				Color("#5a7e8c"), Color("#728e9c"), Color("#8ba9b0"),
				Color("#557787"), Color("#4a6874"), Color("#172f3c"),
				Color("#2b4b59")
			])
			canvas.draw_polygon(contour, shades)
			_oval(canvas, Vector2(13, -1), Vector2(23, 8), Color("#7097a0").lerp(Color("#345d6d"), 1.0 - light * 0.55))
			_line(canvas, Vector2(-10, -17), Vector2(22, -8), Color(0.65, 0.88, 0.89, 0.45), 1.7)
			_line(canvas, Vector2(-10, 17), Vector2(22, 8), Color(0.17, 0.35, 0.43, 0.73), 2.0)
			canvas.draw_arc(Vector2(0,0),46.0,PI*1.04,PI*1.41,16,Color(0.45,0.90,0.97,0.37),1.5,true)
			canvas.draw_arc(Vector2(0,0),46.0,-PI*0.42,-PI*0.04,16,Color(0.45,0.90,0.97,0.37),1.5,true)
			canvas.draw_circle(Vector2(34, -3), 2.0, dark)
			_line(canvas, Vector2(45, 3), Vector2(49, 8), Color("#9dc0ba"), 1.0)

		"eagle_ray":
			var pulse := sin(time_s * 1.25+pos.x*0.003)*7.0
			# Deliberately broad wings, spotted mantle and a whip-like tail.
			var shape := PackedVector2Array([
				Vector2(-39,-4),Vector2(-16,-19-pulse),Vector2(7,-34-pulse),
				Vector2(27,-13),Vector2(50,1),Vector2(27,15),
				Vector2(7,33+pulse),Vector2(-13,18+pulse),Vector2(-38,5)
			])
			canvas.draw_colored_polygon(shape,Color("#24657e").lerp(Color("#5aa7b2"),light*0.35))
			canvas.draw_polyline(shape,Color(0.55,0.95,0.99,0.76),1.6,true)
			_line(canvas,Vector2(-38,0),Vector2(-92,sin(time_s*1.1)*9.0),Color("#6db6bf"),2.2)
			for j in range(13):
				var a := float(j)*2.43
				var x := -17.0+cos(a)*23.0
				var y := sin(a)*11.0
				canvas.draw_circle(Vector2(x,y),1.4,Color(0.80,1.0,0.98,0.80))
			_oval(canvas,Vector2(34,0),Vector2(19,7),Color("#68a9a9"))
			canvas.draw_circle(Vector2(40,-2),2.3,Color("#0a2b3a"))
		"turtle":
			# Anatomical swimming silhouette: separate flippers, scute polygons, head.
			var flap := sin(time_s * 1.52 + pos.x * 0.004) * 9.0
			# Far flippers under the shell.
			_poly(canvas,[Vector2(-18,2),Vector2(-43,17+flap),
				Vector2(-44,26+flap),Vector2(-7,17)],Color("#4e8c79"))
			_poly(canvas,[Vector2(9,7),Vector2(27,22-flap),
				Vector2(20,38-flap),Vector2(-4,17)],Color("#528b7d"))
			# Pointed little tail behind an asymmetrical but solid oval shell.
			_poly(canvas,[Vector2(-28,-2),Vector2(-47,-12),Vector2(-42,3)],Color("#6fa88f"))
			_oval(canvas,Vector2(-4,0),Vector2(29,23),Color("#1c5458"))
			_oval(canvas,Vector2(-4,-2),Vector2(26,20),Color("#70aa85"))
			_oval(canvas,Vector2(-4,-2),Vector2(23,17),Color("#437879"))
			# Five hexagonal shell plates with contrasting thin golden seams.
			for k in range(5):
				var theta := TAU*float(k)/5.0
				var x := -4.0+cos(theta)*13.0
				var y := -2.0+sin(theta)*9.0
				_poly(canvas,[Vector2(x-6,y),Vector2(x-3,y-5),Vector2(x+4,y-5),
					Vector2(x+7,y),Vector2(x+4,y+5),Vector2(x-3,y+5)],
					Color("#346d72") if k%2==0 else Color("#508d80"))
				canvas.draw_arc(Vector2(x,y),5.7,0,TAU,6,Color(0.78,0.94,0.63,0.62),1.2,true)
			canvas.draw_arc(Vector2(-4,0),28,0,TAU,34,Color(0.16,0.93,0.86,0.10),6.5,true)
			canvas.draw_arc(Vector2(-4,0),28,0,TAU,34,Color(0.73,0.99,0.78,0.70),1.9,true)
			# Near forelimbs rhythmically lift through the water.
			_poly(canvas,[Vector2(8,-9),Vector2(20,-25-flap),
				Vector2(34,-32-flap),Vector2(31,-18-flap),
				Vector2(18,2)],Color("#7db99a"))
			_line(canvas,Vector2(12,-8),Vector2(31,-25-flap),
				Color("#b8e7ad"),1.7)
			_poly(canvas,[Vector2(-20,-9),Vector2(-39,-28+flap),
				Vector2(-34,-34+flap),Vector2(-8,-19)],Color("#5b9f88"))
			# Tapered neck, observable eye and living head profile.
			_oval(canvas,Vector2(24,0),Vector2(18,11),Color("#6dac98"))
			_oval(canvas,Vector2(34,0),Vector2(12,9),Color("#9dc8a6"))
			canvas.draw_arc(Vector2(34,0),11,PI*0.20,PI*1.72,17,
				Color(0.78,0.99,0.85,0.45),1.5,true)
			canvas.draw_circle(Vector2(38,-3),2.5,Color("#122b39"))
			canvas.draw_circle(Vector2(38.6,-3.5),0.9,Color("#d5fff0"))
			_line(canvas,Vector2(43,4),Vector2(48,3),Color("#386c70"),1.3)
		"jelly":
			for j in range(8):
				var ox := -25.0 + float(j) * 7.0
				_line(canvas, Vector2(ox, 4), Vector2(ox + sin(time_s * 2.0 + j) * 9.0, 44.0 + float(j % 3) * 7), Color(0.35, 0.87, 0.95, 0.6), 1.5)
			_oval(canvas, Vector2(0, -5 - breathe * 3.0), Vector2(37, 22), Color(0.18, 0.53, 0.68, 0.67))
			_oval(canvas, Vector2(0, -15 - breathe * 3.0), Vector2(28, 8), Color(0.58, 0.86, 0.95, 0.48))
			_line(canvas, Vector2(-32, 2), Vector2(32, 2), glow, 1.5)
		"oarfish":
			var ribbon: Array[Vector2] = []
			for j in range(15):
				var px := -50.0 + float(j) * 7.2
				var curve := sin(time_s * 1.45 + float(j) * 0.65) * 6.0
				ribbon.append(Vector2(px, curve - 6.0))
			for j in range(14, -1, -1):
				var px := -50.0 + float(j) * 7.2
				var curve := sin(time_s * 1.45 + float(j) * 0.65) * 6.0
				ribbon.append(Vector2(px, curve + 6.0))
			_poly(canvas, ribbon, silver)
			for j in range(2, 14):
				var px := -50.0 + float(j) * 7.2
				var curve := sin(time_s * 1.45 + float(j) * 0.65) * 6.0
				_line(canvas, Vector2(px, curve - 5.0), Vector2(px - 3.0, curve - 16.0 - (j % 3) * 3.0), Color("#ba4d62"), 1.5)
			canvas.draw_circle(Vector2(43, -1), 2.6, dark)
		"viper":
			_poly(canvas, [Vector2(-48, 0), Vector2(-35, -17), Vector2(-28, -7),
				Vector2(20, -14), Vector2(47, -2), Vector2(28, 18), Vector2(-29, 9)], Color("#243441"))
			_oval(canvas, Vector2(6, 0), Vector2(34, 15), Color("#516275").lerp(Color("#213443"), 0.5))
			_poly(canvas, [Vector2(26, 4), Vector2(49, 0), Vector2(36, 21)], Color("#0a1926"))
			for k in range(4):
				_line(canvas, Vector2(32 + k * 3, 4), Vector2(34 + k * 3, 16 - k), Color("#dbd0b0"), 1.6)
			for k in range(6):
				canvas.draw_circle(Vector2(-21 + k * 8, 8), 2.2, glow)
			canvas.draw_circle(Vector2(27, -7), 3.5, Color("#ffac7b"))
		"vampire":
			var skirt := -8.0 * sin(time_s * 1.2)
			_poly(canvas, [Vector2(34, -11), Vector2(13, -30), Vector2(-25, -23),
				Vector2(-45, -4), Vector2(-38, 29 + skirt),
				Vector2(-11, 21), Vector2(18, 29 + skirt)], Color("#411b37"))
			_poly(canvas, [Vector2(20, -14), Vector2(-23, -12), Vector2(-35, 16),
				Vector2(-8, 10), Vector2(14, 18)], Color("#81374b"))
			for j in range(6):
				_line(canvas, Vector2(-25 + j * 9, 8), Vector2(-39 + j * 12 + sin(time_s + j) * 5, 41), Color("#9e506e"), 2)
			_oval(canvas, Vector2(30, -10), Vector2(10, 13), Color("#a44f58"))
			canvas.draw_circle(Vector2(34, -12), 3.0, Color("#9de8f7"))
		"angler":
			_poly(canvas, [Vector2(-34, 2), Vector2(-53, -16), Vector2(-45, 23), Vector2(-18, 12)], Color("#39434c"))
			_oval(canvas, Vector2(9, 4), Vector2(40, 31), Color("#2f3d4a"))
			_oval(canvas, Vector2(24, 15), Vector2(22, 17), Color("#0c1925"))
			for j in range(6):
				var tx := 9 + j * 7
				_poly(canvas, [Vector2(tx, 8), Vector2(tx + 4, 23), Vector2(tx + 7, 8)], Color("#d7d6c6"))
			_line(canvas, Vector2(8, -24), Vector2(5, -51), Color("#566b79"), 2.8)
			_line(canvas, Vector2(5, -51), Vector2(34, -58 + breathe * 3.0), Color("#566b79"), 2.0)
			canvas.draw_circle(Vector2(34, -58 + breathe * 3.0), 6.0, Color(0.25, 0.92, 0.94, 0.14))
			canvas.draw_circle(Vector2(34, -58 + breathe * 3.0), 2.8, Color("#c8ffef"))
			canvas.draw_circle(Vector2(25, -10), 5.2, Color("#bd956a"))
			canvas.draw_circle(Vector2(27, -10), 1.8, dark) 
		"gulper":
			# Extremely elongated silhouette, disproportionately large hinged jaw.
			var wave := sin(time_s * 1.25 + pos.x * 0.002) * 8.0
			_line(canvas, Vector2(-25, -2), Vector2(-66, wave), Color("#27374c"), 4.0)
			_line(canvas, Vector2(-66, wave), Vector2(-84, wave + sin(time_s * 2.4) * 8.0), Color("#36536b"), 2.2)
			canvas.draw_circle(Vector2(-84, wave + sin(time_s * 2.4) * 8.0), 3.0, Color("#f29f83"))
			_oval(canvas, Vector2(1, -6), Vector2(31, 16), Color("#293548"))
			_poly(canvas, [Vector2(1, -11), Vector2(40, -24), Vector2(49, -7),
				Vector2(27, 19), Vector2(7, 32), Vector2(-12, 16)], Color("#1a2535"))
			_poly(canvas, [Vector2(6, 2), Vector2(44, -1), Vector2(15, 30)],
				Color("#060f1d"))
			_line(canvas, Vector2(13, 27), Vector2(42, 0), Color("#5b6680"), 2.5)
			canvas.draw_circle(Vector2(27, -17), 3.8, Color("#d0bbab"))
			canvas.draw_circle(Vector2(28, -17), 1.8, dark)
		"seapig":
			var feet := sin(time_s * 0.8 + pos.x * 0.003) * 4.0
			for j in range(5):
				var fx := -25.0 + float(j) * 13.0
				_line(canvas, Vector2(fx, 4), Vector2(fx + feet, 29.0 + float(j % 2) * 6.0),
					Color("#928c9b"), 6.0)
			_oval(canvas, Vector2(0, -6), Vector2(41, 19), Color("#91828f"))
			_oval(canvas, Vector2(-10, -11), Vector2(24, 12), Color("#bbacb2"))
			for j in range(4):
				_line(canvas, Vector2(-29.0 + float(j) * 18.0, -13),
					Vector2(-30.0 + float(j) * 20.0 + sin(time_s * 0.9 + j) * 3.0, -34),
					Color("#bcb4b5"), 4.0)
			canvas.draw_circle(Vector2(34, -6), 2.2, Color("#566474"))

		"isopod":
			for j in range(7):
				var sx := -31.0 + float(j) * 10.0
				_oval(canvas, Vector2(sx, 0), Vector2(12, 20 - absf(3.0 - float(j)) * 1.7), Color("#546b70"))
				_line(canvas, Vector2(sx, 11), Vector2(sx - 4, 23), dark, 2.0)
				_line(canvas, Vector2(sx, -10), Vector2(sx - 4, -23), dark, 2.0)
			_oval(canvas, Vector2(36, -2), Vector2(14, 17), Color("#829498"))
			canvas.draw_circle(Vector2(43, -7), 2.1, dark)
			_line(canvas, Vector2(47, -2), Vector2(57, -12), Color("#b6b9ad"), 1.5)
	canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
