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
		"story": "Filtra plancton; suas asas desenham sombras enormes."
	},
	{
		"id": "turtle", "name": "Tartaruga-verde",
		"scientific": "Chelonia mydas",
		"zone": "Zona iluminada", "min_m": 0.0, "max_m": 180.0,
		"length_px": 111.0, "temperament": "Reservada",
		"habitat": "Costas rasas, bancos de algas e areas oceanicas.",
		"story": "Cruza grandes distancias e retorna para respirar."
	},
	{
		"id": "jelly", "name": "Medusa-luminosa",
		"scientific": "Pelagia noctiluca",
		"zone": "Coluna de agua", "min_m": 0.0, "max_m": 900.0,
		"length_px": 85.0, "temperament": "Deriva com as correntes",
		"habitat": "Agua aberta, em varias profundidades.",
		"story": "Uma pulsacao delicada esconde tentaculos urticantes."
	},
	{
		"id": "oarfish", "name": "Peixe-remo",
		"scientific": "Regalecus glesne",
		"zone": "Penumbra", "min_m": 200.0, "max_m": 1000.0,
		"length_px": 440.0, "temperament": "Esquivo",
		"habitat": "Agua oceanica profunda, longe de recifes rasos.",
		"story": "Seu corpo prateado se move como uma fita sem fim."
	},
	{
		"id": "viper", "name": "Peixe-vibora",
		"scientific": "Chauliodus sloani",
		"zone": "Penumbra", "min_m": 300.0, "max_m": 1250.0,
		"length_px": 87.0, "temperament": "Predador de emboscada",
		"habitat": "Agua escura da zona mesopelagica e abaixo.",
		"story": "Dentes exagerados e pontos luminosos no ventre."
	},
	{
		"id": "vampire", "name": "Lula-vampira",
		"scientific": "Vampyroteuthis infernalis",
		"zone": "Penumbra profunda", "min_m": 600.0, "max_m": 1100.0,
		"length_px": 124.0, "temperament": "Defensiva e lenta",
		"habitat": "Coluna de agua pobre em oxigenio, longe da luz.",
		"story": "Sua capa vermelha forma um guarda-chuva escuro."
	},
	{
		"id": "angler", "name": "Tamboril-abissal",
		"scientific": "Melanocetus johnsonii",
		"zone": "Escuridao", "min_m": 750.0, "max_m": 1400.0,
		"length_px": 97.0, "temperament": "Predador solitario",
		"habitat": "Aguas profundas, onde a luz solar ja desapareceu.",
		"story": "Uma isca luminosa chama criaturas para a mandibula."
	},
	{
		"id": "isopod", "name": "Isopode-gigante",
		"scientific": "Bathynomus giganteus",
		"zone": "Fundo profundo", "min_m": 220.0, "max_m": 1400.0,
		"length_px": 95.0, "temperament": "Necrófago de fundo",
		"habitat": "Sedimentos escuros e encostas profundas.",
		"story": "Uma armadura segmentada percorre o solo silencioso."
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
			if entry["id"] != "isopod" or seabed_distance_px < 220.0:
				pool.append(entry)
	return pool

static func _oval(canvas: Node2D, c: Vector2, radii: Vector2, tint: Color) -> void:
	var vertices := PackedVector2Array()
	for k in range(33):
		var a := TAU * float(k) / 32.0
		vertices.append(c + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	canvas.draw_colored_polygon(vertices, tint)

static func _poly(canvas: Node2D, vertices: Array[Vector2], tint: Color) -> void:
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
			var wing := 12.0 * sin(time_s * 1.3 + pos.x * 0.01)
			_poly(canvas, [Vector2(-42, 0), Vector2(-8, -9), Vector2(39, -6),
				Vector2(52, 0), Vector2(29, 16), Vector2(-13, 14)], Color("#102938"))
			_poly(canvas, [Vector2(-14, -4), Vector2(-43, -30 - wing), Vector2(-34, 6),
				Vector2(-5, 12), Vector2(12, 9), Vector2(42, -30 + wing),
				Vector2(37, -1), Vector2(9, -10)], Color("#263e4c").lerp(Color("#536f79"), light * 0.7))
			_oval(canvas, Vector2(1, 0), Vector2(22, 11), silver)
			_line(canvas, Vector2(-27, 8), Vector2(-4, 2), Color("#8fb5ba"), 2.0)
			_line(canvas, Vector2(-23, 7), Vector2(-68, 20 + breathe * 3.0), dark, 3.0)
			canvas.draw_circle(Vector2(21, 1), 2.0, dark)
		"turtle":
			_poly(canvas, [Vector2(-22, -3), Vector2(-40, -27 - breathe * 5), Vector2(-28, -30),
				Vector2(-6, -13), Vector2(21, -7), Vector2(37, -22 + breathe * 4),
				Vector2(44, -16), Vector2(20, 7), Vector2(-21, 13)], Color("#436f65"))
			_oval(canvas, Vector2(-3, 0), Vector2(29, 22), Color("#294e48"))
			_oval(canvas, Vector2(-3, -2), Vector2(25, 18), Color("#8a7954").lerp(Color("#4e625c"), 0.42))
			for k in range(4):
				_line(canvas, Vector2(-23 + k * 11, -16), Vector2(-20 + k * 11, 16), Color("#2c4b44"), 2.2)
			_oval(canvas, Vector2(29, 0), Vector2(14, 11), Color("#729582"))
			canvas.draw_circle(Vector2(34, -3), 2.1, dark)
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
