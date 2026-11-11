extends Node2D
## Ocean expedition: camera-following world, continuous geology, environmental lighting,
## ecological life distribution, biological discoveries, and native diving.
const DiverScript = preload("res://scripts/diver_native.gd")
const Ecology = preload("res://scripts/marine_ecology.gd")

const MAP_W := 24000.0
const MAP_H := 14000.0
const SURFACE_Y := 75.0
const PIXELS_PER_METER := 10.0
const DAY_DURATION_SECONDS := 420.0
const CHUNK_W := 570.0
const CHUNK_H := 450.0
const SPAWN := Vector2(4150.0, 105.0)
const ROCKS := [
	{"pos": Vector2(4700.0, 840.0), "radius": 125.0},
	{"pos": Vector2(4915.0, 1120.0), "radius": 160.0},
	{"pos": Vector2(5225.0, 995.0), "radius": 118.0},
	{"pos": Vector2(6070.0, 1690.0), "radius": 218.0},
	{"pos": Vector2(6920.0, 2450.0), "radius": 180.0},
	{"pos": Vector2(8620.0, 4300.0), "radius": 280.0},
	{"pos": Vector2(10880.0, 6100.0), "radius": 380.0},
	{"pos": Vector2(14890.0, 9800.0), "radius": 390.0}
]

var diver: CharacterBody2D
var camera: Camera2D
var discovered: Dictionary = {}
var field_guide_open := false
var time_s := 0.0
var sky_time := 0.0
var active := false
var nearest: Dictionary = {}
var nearby_distance := INF
var last_observed_id := ""

func _ready() -> void:
	_build_terrain_collision()
	for rock in ROCKS:
		_build_rock_collider(rock)
	diver = DiverScript.new()
	diver.name = "Mergulhador"
	diver.position = SPAWN
	diver.diver_died.connect(_on_diver_died)
	add_child(diver)
	camera = Camera2D.new()
	camera.name = "CameraExploracao"
	camera.zoom = Vector2(0.91, 0.91)
	camera.limit_left = 0
	camera.limit_top = -80
	camera.limit_right = int(MAP_W)
	camera.limit_bottom = int(MAP_H)
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 7.0
	camera.enabled = false
	diver.add_child(camera)
	set_process(true)

func begin_expedition() -> void:
	active = true
	visible = true
	process_mode = Node.PROCESS_MODE_INHERIT
	camera.enabled = true
	diver.global_position = SPAWN
	diver.recover()
	field_guide_open = false
	queue_redraw()

func end_expedition() -> void:
	active = false
	camera.enabled = false
	visible = false
	process_mode = Node.PROCESS_MODE_DISABLED

func _process(delta: float) -> void:
	if not active:
		return
	time_s += delta
	sky_time += delta
	_update_nearest()
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_TAB:
			field_guide_open = not field_guide_open
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_F and not nearest.is_empty():
			discovered[nearest["id"]] = true
			last_observed_id = nearest["id"]
			field_guide_open = true
			get_viewport().set_input_as_handled()

func _build_terrain_collision() -> void:
	var body := StaticBody2D.new()
	body.name = "RelevoOceanico"
	body.collision_layer = 2
	body.collision_mask = 0
	var polygon := CollisionPolygon2D.new()
	var vertices := PackedVector2Array()
	for ix in range(0, 241):
		var x := float(ix) * 100.0
		vertices.append(Vector2(x, _seafloor_y(x)))
	vertices.append(Vector2(MAP_W, MAP_H + 1000.0))
	vertices.append(Vector2(0, MAP_H + 1000.0))
	polygon.polygon = vertices
	body.add_child(polygon)
	add_child(body)

func _build_rock_collider(info: Dictionary) -> void:
	var body := StaticBody2D.new()
	body.collision_layer = 2
	body.collision_mask = 0
	body.name = "Rochedo"
	body.position = info["pos"]
	var shape_node := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = float(info["radius"])
	shape_node.shape = circle
	body.add_child(shape_node)
	add_child(body)

func _seafloor_y(x: float) -> float:
	# Continental shelf descends to an enormous abyss to the far right.
	var continental := clampf((x - 2600.0) / 17200.0, 0.0, 1.0)
	var base := lerpf(1350.0, 13360.0, pow(continental, 1.32))
	return base + 76.0 * sin(x / 390.0) + 39.0 * sin(x / 109.0)

func _sunlight() -> float:
	return clampf(0.53 + 0.47 * cos(TAU * sky_time / DAY_DURATION_SECONDS), 0.06, 1.0)

func _water_light(depth_m: float) -> float:
	var solar := _sunlight()
	# Biological daylight ends near the continental deep sea.
	return solar * exp(-maxf(0.0, depth_m) / 160.0)

func _visible_bounds() -> Rect2:
	# Extra margin covers camera smoothing and 0.91 zoom.
	return Rect2(diver.position - Vector2(910, 590), Vector2(1820, 1180))

func _draw() -> void:
	if not active:
		return
	var area := _visible_bounds()
	_draw_water(area)
	_draw_light_beams(area)
	_draw_marine_snow(area)
	_draw_seafloor(area)
	_draw_landmark_rocks(area)
	_draw_kelps(area)
	_draw_fauna(area)
	_draw_deep_visibility(area)
	_draw_hud()

func _draw_water(area: Rect2) -> void:
	# Atmosphere is calculated from absolute depth and time of day, not static bands.
	var bands := 42
	var band_h := area.size.y / float(bands)
	var solar := _sunlight()
	for i in range(bands):
		var y := area.position.y + float(i) * band_h
		var d := maxf(0.0, (y - SURFACE_Y) / PIXELS_PER_METER)
		var fade := exp(-d / 260.0)
		var tint := Color("#03101e").lerp(Color("#0e6d88"), clampf(fade * solar, 0.0, 0.95))
		draw_rect(Rect2(area.position.x, y, area.size.x, band_h + 1.5), tint)
	# Surface and sky are not a wall: the diver can ascend to breathe.
	if area.position.y < SURFACE_Y:
		draw_rect(Rect2(area.position.x, area.position.y, area.size.x,
			maxf(0.0, SURFACE_Y - area.position.y)), Color("#07283a").lerp(Color("#4e9aaa"), solar * 0.55))
		for ix in range(0, 40):
			var x := floorf(area.position.x / 65.0) * 65.0 + float(ix) * 65.0
			var ripple := 3.0 * sin(x * 0.022 + time_s * 1.7)
			draw_line(Vector2(x, SURFACE_Y + ripple), Vector2(x + 52.0, SURFACE_Y - ripple),
				Color(0.45, 0.96, 0.94, 0.45 + solar * 0.28), 2.3, true)

func _draw_light_beams(area: Rect2) -> void:
	var solar := _sunlight()
	var limit_y := minf(SURFACE_Y + 2150.0, area.end.y)
	if solar < 0.1 or limit_y < area.position.y:
		return
	for k in range(15):
		var x0 := floorf(area.position.x / 260.0) * 260.0 + float(k) * 260.0
		var sway := 43.0 * sin(time_s * 0.12 + float(k) * 0.6)
		var top := maxf(area.position.y, SURFACE_Y)
		var bottom := maxf(top, limit_y)
		draw_colored_polygon(PackedVector2Array([
			Vector2(x0 + sway, top), Vector2(x0 + 35.0 + sway, top),
			Vector2(x0 + 240.0 + sway, bottom), Vector2(x0 + 97.0 + sway, bottom)
		]), Color(0.3, 0.97, 0.9, 0.025 * solar))

func _draw_marine_snow(area: Rect2) -> void:
	# Deterministic, camera-local particle grid. No per-frame random allocations.
	var gx := int(floor(area.position.x / 90.0))
	var gy := int(floor(area.position.y / 90.0))
	for iy in range(14):
		for ix in range(21):
			var seed := float((gx + ix) * 179 + (gy + iy) * 131)
			var x := float(gx + ix) * 90.0 + 22.0 * sin(seed * 0.37)
			var y := float(gy + iy) * 90.0 + 21.0 * cos(seed * 0.23)
			var drift := fposmod(time_s * (2.0 + float((ix + iy) % 4)), 44.0)
			var alpha := 0.07 + _water_light(maxf(0.0, y / PIXELS_PER_METER)) * 0.23
			draw_circle(Vector2(x + 5.0 * sin(time_s * 0.31 + seed), y - drift),
				0.9 + float(ix % 3) * 0.25, Color(0.72, 0.95, 0.95, alpha))

func _draw_seafloor(area: Rect2) -> void:
	var points := PackedVector2Array()
	var first_x := floorf(area.position.x / 32.0) * 32.0
	for k in range(0, 62):
		var x := first_x + float(k) * 32.0
		points.append(Vector2(x, _seafloor_y(x)))
	points.append(Vector2(first_x + 61.0 * 32.0, MAP_H + 900.0))
	points.append(Vector2(first_x, MAP_H + 900.0))
	draw_colored_polygon(points, Color("#071f2e"))
	for i in range(33):
		var x := first_x + float(i) * 57.0
		var y := _seafloor_y(x)
		if y > area.position.y - 70.0 and y < area.end.y + 60.0:
			_ellipse(Vector2(x, y + 12), Vector2(31.0 + float(i % 6) * 6.0, 17), Color("#244858"))
			draw_line(Vector2(x - 13, y + 8), Vector2(x + 11, y), Color("#4b777f"), 1.4, true)

func _draw_landmark_rocks(area: Rect2) -> void:
	for info in ROCKS:
		var pos: Vector2 = info["pos"]
		var r: float = info["radius"]
		if not area.grow(r).has_point(pos):
			continue
		_ellipse(pos + Vector2(r * 0.1, r * 0.12), Vector2(r * 1.08, r * 1.04), Color("#061827"))
		_ellipse(pos, Vector2(r, r), Color("#274251"))
		_ellipse(pos + Vector2(-r * 0.15, -r * 0.19), Vector2(r * 0.75, r * 0.7), Color("#395969"))
		for k in range(6):
			var a := -2.6 + float(k) * 0.7
			var end_a := a + 0.5
			draw_line(pos + Vector2(cos(a), sin(a)) * r * 0.27,
				pos + Vector2(cos(end_a), sin(end_a)) * r * 0.86, Color("#13313e"), 3, true)
		if (pos.y - SURFACE_Y) / PIXELS_PER_METER > 220.0:
			for k in range(8):
				var a := float(k) * 2.33
				draw_circle(pos + Vector2(cos(a), sin(a)) * r * 0.63,
					3.0, Color(0.18, 0.9, 0.85, 0.45 + 0.25 * sin(time_s + k)))

func _draw_kelps(area: Rect2) -> void:
	# Photosynthetic kelp only in the shallow, illuminated shelf biome.
	var start := int(floor(area.position.x / 115.0))
	for i in range(24):
		var x := float(start + i) * 115.0
		var base := _seafloor_y(x)
		var depth := (base - SURFACE_Y) / PIXELS_PER_METER
		if base < area.position.y - 150.0 or base > area.end.y + 300.0 or depth > 200.0:
			continue
		var stalk_height := 90.0 + 115.0 * absf(sin(float(i + start) * 1.2))
		var bend := 17.0 * sin(time_s * 0.6 + x * 0.013)
		for k in range(6):
			var amount := float(k) / 6.0
			var a := Vector2(x + bend * amount * amount, base - stalk_height * amount)
			var b := Vector2(x + bend * (amount + 0.15) * (amount + 0.15), base - stalk_height * (amount + 0.15))
			draw_line(a, b, Color("#356963"), 5.0 - amount * 2.0, true)
			if k > 1:
				var side := -1.0 if k % 2 == 0 else 1.0
				draw_colored_polygon(PackedVector2Array([
					a, a + Vector2(side * 31, -12), b + Vector2(side * 19, -6), b
				]), Color(0.18, 0.50, 0.44, 0.64))

func _creatures_in_view(area: Rect2) -> Array[Dictionary]:
	var creatures: Array[Dictionary] = []
	var min_x := maxi(0, int(floor(area.position.x / CHUNK_W)) - 1)
	var max_x := mini(43, int(ceil(area.end.x / CHUNK_W)) + 1)
	var min_y := maxi(0, int(floor(area.position.y / CHUNK_H)) - 1)
	var max_y := mini(31, int(ceil(area.end.y / CHUNK_H)) + 1)
	for cy in range(min_y, max_y + 1):
		for cx in range(min_x, max_x + 1):
			# Deterministic sector sampling, with population decreasing with depth.
			var seed_value := cx * 91891 + cy * 31337 + 241
			var rng := RandomNumberGenerator.new()
			rng.seed = seed_value
			var count := 2 if cy * CHUNK_H < 2200.0 else 1
			for j in range(count):
				var base := Vector2(float(cx) * CHUNK_W + rng.randf_range(80, CHUNK_W - 80),
					float(cy) * CHUNK_H + rng.randf_range(60, CHUNK_H - 60))
				var bottom_distance := _seafloor_y(base.x) - base.y
				if bottom_distance < 75.0:
					continue
				var depth := maxf(0.0, (base.y - SURFACE_Y) / PIXELS_PER_METER)
				var pool := Ecology.candidates_at(depth, bottom_distance)
				if pool.is_empty():
					continue
				var species: Dictionary = pool[rng.randi_range(0, pool.size() - 1)]
				# Solitary oceanic giants should not cluster in schools.
				if species["id"] == "manta" and (cx + cy * 3 + j) % 5 != 0:
					species = pool[(rng.randi_range(0, pool.size() - 1) + 1) % pool.size()]
				if species["id"] == "isopod":
					base.y = _seafloor_y(base.x) - 35.0
				var phase := time_s + float(seed_value + j) * 0.7
				var wander := Vector2.ZERO
				match species["id"]:
					"manta":
						wander = Vector2(100.0 * sin(phase * 0.10), 28.0 * cos(phase * 0.17))
					"turtle":
						wander = Vector2(55.0 * sin(phase * 0.18), 16.0 * cos(phase * 0.28))
					"jelly":
						wander = Vector2(20.0 * sin(phase * 0.13), 42.0 * sin(phase * 0.35))
					"oarfish":
						wander = Vector2(58.0 * sin(phase * 0.12), 31.0 * sin(phase * 0.18))
					"viper":
						wander = Vector2(47.0 * sin(phase * 0.35), 9.0 * cos(phase * 0.21))
					"angler":
						wander = Vector2(17.0 * sin(phase * 0.12), 11.0 * sin(phase * 0.2))
					"vampire":
						wander = Vector2(28.0 * sin(phase * 0.11), 19.0 * cos(phase * 0.15))
					"isopod":
						wander = Vector2(24.0 * sin(phase * 0.10), 0.0)
				var pos := base + wander
				if species["id"] == "isopod":
					pos.y = _seafloor_y(pos.x) - 36.0
				if _seafloor_y(pos.x) - pos.y < 40.0 and species["id"] != "isopod":
					continue
				creatures.append({
					"id": species["id"], "info": species, "pos": pos,
					"dir": 1.0 if (cx + cy + j) % 2 == 0 else -1.0,
					"seed": seed_value
				})
	return creatures

func _draw_fauna(area: Rect2) -> void:
	for creature in _creatures_in_view(area):
		var pos: Vector2 = creature["pos"]
		var info: Dictionary = creature["info"]
		var d := maxf(0.0, (pos.y - SURFACE_Y) / PIXELS_PER_METER)
		var light := _water_light(d)
		Ecology.paint(self, info["id"], pos, creature["dir"], time_s,
			float(info["length_px"]), light)
		# Rare, non-intrusive bioluminescence breaks absolute darkness.
		if d > 240.0 and info["id"] in ["angler", "viper", "jelly"]:
			draw_arc(pos, 44.0, 0.0, TAU, 32, Color(0.1, 0.7, 0.8, 0.035), 2.0)

func _update_nearest() -> void:
	nearest.clear()
	nearby_distance = INF
	var view := Rect2(diver.position - Vector2(240, 240), Vector2(480, 480))
	for creature in _creatures_in_view(view):
		var dist := diver.position.distance_to(creature["pos"])
		if dist < 205.0 and dist < nearby_distance:
			nearest = creature["info"]
			nearby_distance = dist

func _draw_deep_visibility(area: Rect2) -> void:
	# Fading peripheral vision and an underwater lamp reinforce unease at depth.
	# The darkness never conceals the HUD, which is drawn afterward.
	var depth := maxf(0.0, (diver.position.y - SURFACE_Y) / PIXELS_PER_METER)
	var dark := clampf((depth - 165.0) / 880.0 * 0.72 + (1.0 - _sunlight()) * 0.19, 0.0, 0.76)
	if dark < 0.045:
		return
	var focus := diver.position
	var visible_radius := lerpf(610.0, 305.0, clampf(depth / 1200.0, 0.0, 1.0))
	var outside := Color(0.0, 0.008, 0.024, dark)
	# Ring-shaped darkness, leaving the near-diver area visible.
	var outer_r := 1760.0
	for i in range(48):
		var a := TAU * float(i) / 48.0
		var b := TAU * float(i + 1) / 48.0
		draw_colored_polygon(PackedVector2Array([
			focus + Vector2(cos(a), sin(a)) * visible_radius,
			focus + Vector2(cos(b), sin(b)) * visible_radius,
			focus + Vector2(cos(b), sin(b)) * outer_r,
			focus + Vector2(cos(a), sin(a)) * outer_r
		]), outside)
	# Narrow torch cone keeps the player oriented at night and below 200m.
	if depth > 180.0:
		var facing := 1.0 if diver.is_facing_right else -1.0
		var end_pos := focus + Vector2(530.0 * facing, 14.0)
		draw_colored_polygon(PackedVector2Array([
			focus + Vector2(22.0 * facing, -13.0),
			end_pos + Vector2(0.0, -84.0),
			end_pos + Vector2(0.0, 84.0),
			focus + Vector2(22.0 * facing, 13.0)
		]), Color(0.12, 0.67, 0.69, 0.026))

func _draw_hud() -> void:
	# Draw at the visible camera center so labels stay attached to the screen.
	var p := camera.get_screen_center_position()
	var x := p.x - 680.0
	var y := p.y - 376.0
	draw_rect(Rect2(x + 18, y + 14, 431, 119), Color(0.018, 0.069, 0.10, 0.88))
	_text("ABYSSAL  |  EXPEDICAO OCEANICA", Vector2(x + 31, y + 38), 18, Color("#c9f7f4"))
	_bar(Vector2(x + 32, y + 54), 285.0, diver.oxygen / diver.MAX_OXYGEN, Color("#52cddb"))
	_text("O2", Vector2(x + 329, y + 66), 15, Color("#b8ece9"))
	_bar(Vector2(x + 32, y + 81), 285.0, diver.health / diver.MAX_HEALTH, Color("#e9ac8b"))
	_text("VIDA", Vector2(x + 329, y + 93), 15, Color("#b8ece9"))
	_text("PROFUNDIDADE: %.0f m   |   LUZ: %d%%" % [diver.depth_m, int(_sunlight() * 100.0)],
		Vector2(x + 31, y + 119), 14, Color("#c9f7f4"))
	if not nearest.is_empty():
		_text("F  OBSERVAR: %s" % nearest["name"], Vector2(x + 360, y + 345), 20, Color("#f9d99b"))
	_text("WASD: NADAR   |   SUPERFICIE: OXIGENIO   |   TAB: DIARIO   |   ESC: CABINE",
		Vector2(x + 32, y + 740), 17, Color("#cff7ec"))
	if field_guide_open:
		draw_rect(Rect2(x + 735, y + 22, 620, 231), Color(0.013, 0.048, 0.076, 0.94))
		_text("DIARIO DE CAMPO  |  DESCOBERTAS", Vector2(x + 757, y + 52), 22, Color("#f9d99b"))
		var chosen: Dictionary = Ecology.get_species(last_observed_id)
		if chosen.is_empty():
			_text("Aproxime-se de um animal e pressione F.", Vector2(x + 757, y + 91), 17, Color("#c9f7f4"))
		else:
			_text(chosen["name"], Vector2(x + 757, y + 89), 20, Color("#c9f7f4"))
			_text(chosen["scientific"], Vector2(x + 757, y + 118), 16, Color("#84c4cc"))
			_text(chosen["habitat"], Vector2(x + 757, y + 149), 14, Color("#c9f7f4"))
			_text(chosen["how_to_find"], Vector2(x + 757, y + 174), 14, Color("#a7e6d0"))
			_text(chosen["story"], Vector2(x + 757, y + 198), 14, Color("#c9f7f4"))
		_text("ESPECIES REGISTRADAS: %d / %d" % [discovered.size(), Ecology.SPECIES.size()],
			Vector2(x + 757, y + 225), 16, Color("#f9d99b"))

func _bar(pos: Vector2, width: float, ratio: float, tint: Color) -> void:
	draw_rect(Rect2(pos.x, pos.y, width, 14), Color("#173843"))
	draw_rect(Rect2(pos.x + 2, pos.y + 2, (width - 4) * clampf(ratio, 0.0, 1.0), 10), tint)

func _text(label: String, at: Vector2, size: int, tint: Color) -> void:
	draw_string(ThemeDB.fallback_font, at, label, HORIZONTAL_ALIGNMENT_LEFT, -1, size, tint)

func _ellipse(center: Vector2, radii: Vector2, tint: Color) -> void:
	var points := PackedVector2Array()
	for k in range(33):
		var a := TAU * float(k) / 32.0
		points.append(center + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	draw_colored_polygon(points, tint)

func _on_diver_died() -> void:
	diver.position = SPAWN
	diver.recover()
