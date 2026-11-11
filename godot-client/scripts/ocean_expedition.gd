extends Node2D
## Ocean expedition: camera-following world, continuous geology, environmental lighting,
## ecological life distribution, biological discoveries, and native diving.
const DiverScript = preload("res://scripts/diver_native.gd")
const Ecology = preload("res://scripts/marine_ecology.gd")
const Deposits = preload("res://scripts/geological_resources.gd")
const ProgressScript = preload("res://scripts/exploration_progress.gd")
const Art = preload("res://scripts/cinematic_art.gd")

const MAP_W := 24000.0
const MAP_H := 21000.0
const SURFACE_Y := 75.0
const OCEAN_MAX_DEPTH_METERS := 2200.0
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

# Seven geological arches; physical openings are passable water corridors.
const PASSAGE_ARCHES := [
	Vector2(4800.0, 1350.0), Vector2(6800.0, 2000.0),
	Vector2(10200.0, 3280.0), Vector2(13050.0, 3970.0),
	Vector2(16500.0, 4850.0), Vector2(18900.0, 5200.0),
	Vector2(21700.0, 6100.0)
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
var progress: RefCounted
var deposits: RefCounted
var visible_deposits: Array[Dictionary] = []
var nearest_deposit: Dictionary = {}
var extraction_time := 0.0
var extraction_target_id := ""
var resource_refresh := 0.0
var chart_open := false
var inventory_open := false
var status_message := ""
var status_until := 0.0
var visited_cell := ""
var arch_geometry: Array[Dictionary] = []


func _ready() -> void:
	deposits = Deposits.new()
	_build_terrain_collision()
	for rock in ROCKS:
		_build_rock_collider(rock)
	for arch in PASSAGE_ARCHES:
		_build_arch_collision(arch)
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

func set_progress(profile_state: RefCounted) -> void:
	progress = profile_state
	sky_time = progress.sun_time()
	discovered = (progress.profile["observed"] as Dictionary).duplicate(true)
	# A reopened save must have a readable field-guide entry, not only its count.
	last_observed_id = ""
	for species in Ecology.SPECIES:
		var species_id: String = str(species["id"])
		if discovered.has(species_id):
			last_observed_id = species_id
			break

func depth_at_y(y: float) -> float:
	return clampf((y - SURFACE_Y) / (MAP_H - SURFACE_Y), 0.0, 1.0) * OCEAN_MAX_DEPTH_METERS

func is_navigable(point: Vector2, clearance: float = 22.0) -> bool:
	if point.x < clearance or point.x > MAP_W - clearance:
		return false
	if point.y < SURFACE_Y or point.y > MAP_H - clearance:
		return false
	if point.y + clearance >= _seafloor_y(point.x):
		return false
	for rock in ROCKS:
		var origin: Vector2 = rock["pos"]
		if point.distance_to(origin) <= float(rock["radius"]) * 1.02 + clearance:
			return false
	for item in arch_geometry:
		var center: Vector2 = item["center"]
		if absf(point.x - center.x) > 450.0 + clearance or absf(point.y - center.y) > 320.0 + clearance:
			continue
		for outline in item["parts"]:
			if Geometry2D.is_point_in_polygon(point, outline):
				return false
			if clearance > 0.0:
				# Only nearby arches enter this narrow-phase test.
				for k in range(outline.size()):
					var edge: Vector2 = Geometry2D.get_closest_point_to_segment(
						point, outline[k], outline[(k + 1) % outline.size()])
					if point.distance_squared_to(edge) <= clearance * clearance:
						return false
	return true

func begin_expedition() -> void:
	active = true
	visible = true
	process_mode = Node.PROCESS_MODE_INHERIT
	camera.enabled = true
	var checkpoint: Vector2 = progress.get_checkpoint() if progress != null else SPAWN
	diver.global_position = checkpoint if is_navigable(checkpoint, 67.0) else SPAWN
	if progress != null:
		diver.call("configure_equipment", progress.research_level("oxygenTank"),
			progress.research_level("pressureSuit"))
	diver.recover()
	field_guide_open = false
	inventory_open = false
	chart_open = false
	_refresh_deposits()
	queue_redraw()

func end_expedition() -> void:
	if progress != null:
		progress.set_checkpoint(diver.global_position, sky_time)
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
	resource_refresh -= delta
	if resource_refresh <= 0.0:
		resource_refresh = 0.33
		_refresh_deposits()
	_update_extraction(delta)
	if progress != null:
		var cell := str(int(floor(diver.position.x / 1200.0))) + ":" + str(int(floor(diver.position.y / 1200.0)))
		if cell != visited_cell:
			visited_cell = cell
			progress.visit(int(floor(diver.position.x / 1200.0)), int(floor(diver.position.y / 1200.0)))
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_TAB:
			field_guide_open = not field_guide_open
			inventory_open = false
			chart_open = false
		elif event.keycode == KEY_I:
			inventory_open = not inventory_open
			field_guide_open = false
			chart_open = false
		elif event.keycode == KEY_M:
			chart_open = not chart_open
			field_guide_open = false
			inventory_open = false
		elif event.keycode == KEY_J and field_guide_open:
			_cycle_field_guide(-1)
		elif event.keycode == KEY_K and field_guide_open:
			_cycle_field_guide(1)
		elif event.keycode == KEY_1 and progress != null:
			progress.select_tool("abyssPickaxe")
		elif event.keycode == KEY_2 and progress != null:
			progress.select_tool("emptyCylinder")
		elif event.keycode == KEY_F and not nearest.is_empty():
			discovered[nearest["id"]] = true
			last_observed_id = nearest["id"]
			if progress != null:
				var is_new: bool = progress.observe(str(nearest["id"]))
				_set_status("NOVA ESPECIE OBSERVADA" if is_new else "ESPECIE JA REGISTRADA")
			field_guide_open = true
			inventory_open = false
			chart_open = false
		else:
			# ESC must reach the submarine scene instead of being swallowed.
			return
		get_viewport().set_input_as_handled()

func _registered_species() -> Array[String]:
	var entries: Array[String] = []
	for species in Ecology.SPECIES:
		var species_id: String = str(species["id"])
		if discovered.has(species_id):
			entries.append(species_id)
	return entries

func _cycle_field_guide(direction: int) -> void:
	var entries := _registered_species()
	if entries.is_empty():
		last_observed_id = ""
		return
	var current := entries.find(last_observed_id)
	last_observed_id = entries[0] if current < 0 else entries[posmod(current + direction, entries.size())]

func _build_terrain_collision() -> void:
	var body := StaticBody2D.new()
	body.name = "RelevoOceanico"
	body.collision_layer = 2
	body.collision_mask = 0
	var polygon := CollisionPolygon2D.new()
	var vertices := PackedVector2Array()
	for ix in range(0, 751):
		var x := float(ix) * 32.0
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
	var polygon := CollisionPolygon2D.new()
	var center: Vector2 = info["pos"]
	polygon.polygon = _rock_contour(Vector2.ZERO, float(info["radius"]), center.x * 0.0031 + center.y * 0.0042)
	body.add_child(polygon)
	add_child(body)

func _arch_polygons(center: Vector2) -> Array[PackedVector2Array]:
	# Irregular physical stone: three simple polygons, a real open passage.
	var left := PackedVector2Array([
		Vector2(-420, -183), Vector2(-398, -235), Vector2(-340, -220),
		Vector2(-285, -250), Vector2(-207, -225), Vector2(-167, -209),
		Vector2(-166, -148), Vector2(-151, -64), Vector2(-164, 3),
		Vector2(-155, 79), Vector2(-170, 194), Vector2(-240, 210),
		Vector2(-298, 186), Vector2(-396, 219), Vector2(-425, 144),
		Vector2(-414, 40), Vector2(-434, -85)
	])
	var right := PackedVector2Array()
	for k in range(left.size() - 1, -1, -1):
		var p: Vector2 = left[k]
		right.append(Vector2(-p.x, p.y))
	var roof := PackedVector2Array([
		Vector2(-173, -220), Vector2(-118, -251), Vector2(-44, -240),
		Vector2(28, -257), Vector2(108, -235), Vector2(179, -215),
		Vector2(166, -164), Vector2(156, -116), Vector2(90, -106),
		Vector2(30, -113), Vector2(-33, -107), Vector2(-92, -116),
		Vector2(-160, -105), Vector2(-168, -165)
	])
	var result: Array[PackedVector2Array] = []
	for shape in [left, right, roof]:
		var absolute := PackedVector2Array()
		for vertex in shape:
			absolute.append(center + vertex)
		result.append(absolute)
	return result

func _build_arch_collision(center: Vector2) -> void:
	var body := StaticBody2D.new()
	body.name = "ArcoNavegavel"
	body.collision_layer = 2
	body.collision_mask = 0
	var outlines := _arch_polygons(center)
	arch_geometry.append({"center": center, "parts": outlines})
	for outline in outlines:
		var collider := CollisionPolygon2D.new()
		collider.polygon = outline
		body.add_child(collider)
	add_child(body)


func _rock_contour(center: Vector2, radius: float, seed: float) -> PackedVector2Array:
	# Identical polygon is used for drawing AND physics: no invisible rock walls.
	var points := PackedVector2Array()
	for i in range(28):
		var a := TAU * float(i) / 28.0
		var roughness := 0.88 + 0.064 * sin(a * 5.0 + seed) + 0.044 * cos(a * 3.0 + seed * 0.49)
		points.append(center + Vector2(cos(a), sin(a)) * radius * roughness)
	return points

func _seafloor_y(x: float) -> float:
	# Continental shelf descends to an enormous abyss to the far right.
	var continental := clampf((x - 2600.0) / 17200.0, 0.0, 1.0)
	var base := lerpf(1350.0, 20200.0, pow(continental, 1.32))
	return base + 76.0 * sin(x / 390.0) + 39.0 * sin(x / 109.0)

func _sunlight() -> float:
	return clampf(0.53 + 0.47 * cos(TAU * sky_time / DAY_DURATION_SECONDS), 0.06, 1.0)

func _water_light(depth_m: float) -> float:
	var solar := _sunlight()
	# Biological daylight ends near the continental deep sea.
	return solar * exp(-maxf(0.0, depth_m) / 160.0)

func _visible_bounds() -> Rect2:
	# Extra margin covers camera smoothing and 0.91 zoom.
	return Rect2(camera.get_screen_center_position() - Vector2(910, 590), Vector2(1820, 1180))

func _draw() -> void:
	if not active:
		return
	var area := _visible_bounds()
	_draw_water(area)
	Art.ocean_distance(self, self, area, time_s, _sunlight())
	_draw_light_beams(area)
	_draw_marine_snow(area)
	_draw_seafloor(area)
	_draw_landmark_rocks(area)
	_draw_navigable_arches(area)
	_draw_kelps(area)
	_draw_resources()
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
		var d := depth_at_y(y)
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
			var alpha := 0.07 + _water_light(depth_at_y(y)) * 0.23
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
	Art.seafloor_material(self, self, area, time_s)

func _draw_landmark_rocks(area: Rect2) -> void:
	for info in ROCKS:
		var pos: Vector2 = info["pos"]
		var radius: float = float(info["radius"])
		if not area.grow(radius).has_point(pos):
			continue
		var seed := pos.x * 0.0031 + pos.y * 0.0042
		# Exact same contour is drawn and used for physics.
		var outline := _rock_contour(pos, radius, seed)
		var shadow := _rock_contour(pos + Vector2(radius * 0.055, radius * 0.095), radius, seed)
		draw_colored_polygon(shadow, Color("#061522"))
		Art.rock_material(self, outline, pos, radius, _water_light(depth_at_y(pos.y)), time_s)

func _draw_navigable_arches(area: Rect2) -> void:
	for item in arch_geometry:
		var arch: Vector2 = item["center"]
		if not area.grow(485.0).has_point(arch):
			continue
		for outline in item["parts"]:
			Art.arch_material(self, outline, _water_light(depth_at_y(arch.y)))
		# Mineral edges around the genuine opening; no portal-like rectangle.
		for side in [-1.0, 1.0]:
			var edge_x := arch.x + side * 155.0
			draw_line(Vector2(edge_x, arch.y - 95.0),
				Vector2(edge_x + side * 4.0, arch.y + 75.0),
				Color(0.35, 0.61, 0.61, 0.18), 2.0, true)
		# Subtle active sediment around the supports.
		for i in range(4):
			var x: float = float(arch.x) + (-286.0 if i < 2 else 286.0)
			var rise := fposmod(time_s * (9.0 + float(i)) + float(i) * 21.0, 76.0)
			draw_circle(Vector2(x + sin(time_s + float(i)) * 7.0, arch.y + 183.0 - rise),
				2.5, Color(0.47, 0.82, 0.78, 0.28))


func _draw_kelps(area: Rect2) -> void:
	# The current biome permits kelp only where sunlight can reach the seabed.
	var start := int(floor(area.position.x / 115.0))
	for i in range(24):
		var x := float(start + i) * 115.0
		var seabed := _seafloor_y(x)
		if seabed < area.position.y - 150.0 or seabed > area.end.y + 300.0:
			continue
		if depth_at_y(seabed) > 200.0:
			continue
		var height := 90.0 + 115.0 * absf(sin(float(i + start) * 1.2))
		Art.kelp_frond(self, x, seabed, height, time_s, x * 0.013)

func _creatures_in_view(area: Rect2) -> Array[Dictionary]:
	var creatures: Array[Dictionary] = []
	var min_x := maxi(0, int(floor(area.position.x / CHUNK_W)) - 1)
	var max_x := mini(43, int(ceil(area.end.x / CHUNK_W)) + 1)
	var min_y := maxi(0, int(floor(area.position.y / CHUNK_H)) - 1)
	var max_y := mini(47, int(ceil(area.end.y / CHUNK_H)) + 1)
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
				var depth := depth_at_y(base.y)
				var pool := Ecology.candidates_at(depth, bottom_distance)
				if pool.is_empty():
					continue
				var species: Dictionary = pool[rng.randi_range(0, pool.size() - 1)]
				# Solitary oceanic giants should not cluster in schools.
				if species["id"] == "manta" and (cx + cy * 3 + j) % 5 != 0:
					species = pool[(rng.randi_range(0, pool.size() - 1) + 1) % pool.size()]
				if species["id"] in ["isopod", "seapig"]:
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
					"gulper":
						wander = Vector2(46.0 * sin(phase * 0.18), 12.0 * cos(phase * 0.22))
					"seapig":
						wander = Vector2(12.0 * sin(phase * 0.09), 0.0)
				var pos := base + wander
				if species["id"] in ["isopod", "seapig"]:
					pos.y = _seafloor_y(pos.x) - 36.0
				if _seafloor_y(pos.x) - pos.y < 40.0 and species["id"] not in ["isopod", "seapig"]:
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
		var d := depth_at_y(pos.y)
		var light := _water_light(d)
		Ecology.paint(self, info["id"], pos, creature["dir"], time_s,
			float(info["length_px"]), light)
		# Rare, non-intrusive bioluminescence breaks absolute darkness.
		if d > 240.0 and info["id"] in ["angler", "viper", "jelly"]:
			draw_arc(pos, 44.0, 0.0, TAU, 32, Color(0.1, 0.7, 0.8, 0.035), 2.0)

func get_rocks() -> Array:
	return ROCKS

func _refresh_deposits() -> void:
	if progress == null or diver == null or deposits == null:
		return
	var collected: Dictionary = progress.profile["collected"]
	visible_deposits = deposits.stream_near(self, diver.global_position, 1300.0, collected)
	nearest_deposit = {}
	var best_distance := 125.0
	for node in visible_deposits:
		var pos: Vector2 = node["pos"]
		var dist := diver.global_position.distance_to(pos)
		if dist < best_distance:
			nearest_deposit = node
			best_distance = dist

func _update_extraction(delta: float) -> void:
	if progress == null or inventory_open or field_guide_open or chart_open:
		extraction_time = 0.0
		extraction_target_id = ""
		return
	if not Input.is_action_pressed("extract") or nearest_deposit.is_empty():
		extraction_time = 0.0
		extraction_target_id = ""
		return
	var current_id := str(nearest_deposit["id"])
	if current_id != extraction_target_id:
		extraction_target_id = current_id
		extraction_time = 0.0
	var required: String = deposits.tool_for(str(nearest_deposit["type"]))
	if progress.selected_tool() != required:
		extraction_time = 0.0
		if time_s > status_until:
			_set_status("EQUIPE A FERRAMENTA CORRETA [1 / 2]")
		return
	if progress.get_count(required) < 1:
		extraction_time = 0.0
		return
	extraction_time += delta
	if extraction_time < deposits.duration_for(str(nearest_deposit["type"])):
		return
	var result: Dictionary = progress.collect(nearest_deposit, diver.global_position, progress.selected_tool())
	extraction_time = 0.0
	extraction_target_id = ""
	if result.get("ok", false):
		_set_status("COLETADO: +%d %s" % [int(result["amount"]), str(ProgressScript.RESOURCE_NAMES.get(result["item"], result["item"]))])
	else:
		_set_status(str(result.get("reason", "Coleta indisponivel")))
	_refresh_deposits()

func _draw_resources() -> void:
	for node in visible_deposits:
		var pos: Vector2 = node["pos"]
		if camera.get_screen_center_position().distance_squared_to(pos) > 1950.0 * 1950.0:
			continue
		var highlighted := not nearest_deposit.is_empty() and str(node["id"]) == str(nearest_deposit["id"])
		Deposits.paint(self, node, time_s, highlighted)

func _set_status(message: String) -> void:
	status_message = message
	status_until = time_s + 3.8

func _update_nearest() -> void:
	nearest = {}
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
	var depth := depth_at_y(diver.position.y)
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
	# HUD uses Camera2D center but is drawn after darkness and world scenery.
	var center := camera.get_screen_center_position()
	var x := center.x - 650.0
	var y := center.y - 370.0
	draw_rect(Rect2(x + 18, y + 14, 472, 141), Color(0.018, 0.069, 0.10, 0.91))
	_text("ABYSSAL  |  EXPLORACAO NATIVA", Vector2(x + 31, y + 38), 18, Color("#c9f7f4"))
	_bar(Vector2(x + 32, y + 54), 290.0, diver.oxygen / diver.oxygen_capacity, Color("#52cddb"))
	_text("O2 %ds" % int(diver.oxygen), Vector2(x + 336, y + 66), 15, Color("#b8ece9"))
	_bar(Vector2(x + 32, y + 81), 290.0, diver.health / diver.MAX_HEALTH, Color("#e9ac8b"))
	_text("VIDA", Vector2(x + 336, y + 93), 15, Color("#b8ece9"))
	_text("PROF. %.0f m  |  LIMITE %d m  |  PRESSAO %.1f atm" % [
		diver.depth_m, int(diver.safe_depth), 1.0 + diver.depth_m / 10.0
	], Vector2(x + 31, y + 121), 15, Color("#c9f7f4"))
	_text("SOL %d%%  |  DESCOBERTAS %d" % [int(_sunlight() * 100.0), discovered.size()],
		Vector2(x + 31, y + 146), 14, Color("#85d9dc"))
	if diver.depth_m > diver.safe_depth:
		_text("PRESSAO CRITICA! SUBA OU APRIMORE O TRAJE", Vector2(x + 390, y + 170), 18, Color("#f5b26a"))
	if not nearest_deposit.is_empty():
		var kind := str(nearest_deposit["type"])
		var required: String = Deposits.tool_for(kind)
		var name: String = str(ProgressScript.RESOURCE_NAMES.get(kind, kind)) if progress != null else kind
		_text("G  EXTRAIR: %s  [%s]" % [name, "2" if required == "emptyCylinder" else "1"],
			Vector2(x + 350, y + 312), 18, Color("#f9d99b"))
		if extraction_time > 0.0:
			_bar(Vector2(x + 353, y + 324), 270.0, extraction_time / Deposits.duration_for(kind), Color("#e9b574"))
	if not nearest.is_empty():
		_text("F  OBSERVAR: %s" % nearest["name"], Vector2(x + 350, y + 356), 18, Color("#b4eeeb"))
	if time_s < status_until:
		_text(status_message, Vector2(x + 350, y + 405), 18, Color("#e9c491"))
	_draw_sonar(x, y)
	_draw_quick_tools(x, y)
	draw_rect(Rect2(x + 24.0, y + 679.0, 900.0, 34.0), Color(0.016, 0.044, 0.068, 0.78))
	_text("WASD NADAR   G EXTRAIR   F OBSERVAR   I INVENTARIO   M MAPA   TAB DIARIO   ESC CABINE",
		Vector2(x + 36, y + 712), 14, Color("#cff7ec"))
	if inventory_open:
		_draw_inventory_panel(x, y)
	elif chart_open:
		_draw_navigation_chart(x, y)
	elif field_guide_open:
		_draw_field_guide(x, y)

func _draw_quick_tools(x: float, y: float) -> void:
	if progress == null:
		return
	var selected: String = str(progress.selected_tool())
	for i in range(2):
		var id := "abyssPickaxe" if i == 0 else "emptyCylinder"
		var p := Vector2(x + 565.0 + float(i) * 140.0, y + 604.0)
		var chosen: bool = id == selected
		draw_rect(Rect2(p, Vector2(133, 56)), Color("#0e4657") if chosen else Color("#092b3a"))
		draw_rect(Rect2(p + Vector2(3, 3), Vector2(127, 50)),
			Color("#194e5b") if chosen else Color("#113846"))
		_text(str(i + 1) + " | " + ("PICARETA" if i == 0 else "CILINDRO"),
			p + Vector2(8, 24), 14, Color("#f6d5a1") if chosen else Color("#a5d7dc"))
		_text("REUTILIZAVEL", p + Vector2(8, 44), 11, Color("#8bbfc7"))

func _draw_sonar(x: float, y: float) -> void:
	var w := 234.0
	var h := 135.0
	var p := Vector2(x + 1020.0, y + 20.0)
	draw_rect(Rect2(p, Vector2(w, h)), Color(0.015, 0.074, 0.103, 0.96))
	_text("SONAR  /  RELEVO", p + Vector2(12, 21), 15, Color("#b8eef0"))
	for yi in range(9):
		for xi in range(19):
			var sx := (float(xi) + 0.5) / 19.0
			var sy := (float(yi) + 0.5) / 9.0
			var sample := diver.position + Vector2((sx - 0.5) * (1840.0 + 260.0 * _sonar_level()),
				(sy - 0.5) * (1080.0 + 170.0 * _sonar_level()))
			var solid := not is_navigable(sample, 0.0)
			draw_rect(Rect2(p.x + 10 + float(xi) * 11.2, p.y + 31 + float(yi) * 10.2, 11.5, 10.5),
				Color("#546072") if solid else Color("#15556a"))
	draw_circle(p + Vector2(w * 0.5, 78.0), 5.0, Color("#ffcb77"))
	_text("M: MAPA COMPLETO", p + Vector2(27, 128), 13, Color("#a8dadd"))

func _sonar_level() -> int:
	return progress.research_level("sonar") if progress != null else 0

func _draw_inventory_panel(x: float, y: float) -> void:
	var p := Vector2(x + 315, y + 175)
	draw_rect(Rect2(p, Vector2(740, 408)), Color(0.013, 0.058, 0.082, 0.96))
	draw_rect(Rect2(p + Vector2(8, 8), Vector2(724, 391)), Color("#0d3443"))
	_text("INVENTARIO DE EXPLORACAO  [I FECHA]", p + Vector2(25, 41), 24, Color("#f1d29e"))
	_text("1 PICARETA   |   2 CILINDRO   |   G SEGURAR PARA EXTRAIR",
		p + Vector2(25, 69), 15, Color("#aedede"))
	var order := ["abyssPickaxe", "emptyCylinder", "seaMineral", "phosphorite",
		"ferromanganeseCrust", "polymetallicNodule", "hydrothermalSulfide",
		"oilCylinder", "gasCylinder", "salvageMetal", "deepCrystal"]
	if progress == null:
		return
	for i in range(order.size()):
		var id: String = order[i]
		var col := i % 2
		var row := int(i / 2)
		var pos := p + Vector2(24.0 + float(col) * 350.0, 105.0 + float(row) * 43.0)
		draw_rect(Rect2(pos, Vector2(333, 37)), Color("#123d4b"))
		draw_rect(Rect2(pos + Vector2(5, 6), Vector2(23, 23)), Deposits.color_for(id))
		_text(str(ProgressScript.RESOURCE_NAMES.get(id, id)), pos + Vector2(37, 25), 14, Color("#cde9e8"))
		_text("x%d" % progress.get_count(id), pos + Vector2(280, 25), 14, Color("#f5d2a6"))
	_text("FERRAMENTA EQUIPADA: %s" % str(ProgressScript.RESOURCE_NAMES.get(progress.selected_tool(), "")),
		p + Vector2(26, 382), 15, Color("#f5d2a6"))

func _draw_navigation_chart(x: float, y: float) -> void:
	if progress == null:
		return
	var p := Vector2(x + 310.0, y + 129.0)
	var chart := Rect2(p, Vector2(750, 485))
	draw_rect(chart, Color(0.012, 0.059, 0.084, 0.97))
	draw_rect(Rect2(p + Vector2(17, 57), Vector2(716, 388)), Color("#0a384c"))
	_text("CARTA DE NAVEGACAO  |  SETORES EXPLORADOS  [M FECHA]",
		p + Vector2(20, 36), 19, Color("#f5d2a6"))
	var plot := Rect2(p + Vector2(38, 77), Vector2(670, 335))
	for cy in range(18):
		for cx in range(20):
			if not progress.has_visited(cx, cy):
				continue
			var q := plot.position + Vector2(float(cx) / 20.0 * plot.size.x, float(cy) / 18.0 * plot.size.y)
			draw_rect(Rect2(q, Vector2(plot.size.x / 20.0 - 1, plot.size.y / 18.0 - 1)),
				Color("#186d7b"))
	var bottom_points := PackedVector2Array()
	for i in range(101):
		var sx := float(i) / 100.0 * MAP_W
		var ground := _seafloor_y(sx)
		bottom_points.append(plot.position + Vector2(float(i) / 100.0 * plot.size.x,
			clampf(ground / MAP_H, 0.0, 1.0) * plot.size.y))
	for i in range(bottom_points.size() - 1):
		draw_line(bottom_points[i], bottom_points[i + 1], Color("#a2adb0"), 2.2)
	for rock in ROCKS:
		var rp: Vector2 = rock["pos"]
		draw_circle(plot.position + Vector2(rp.x / MAP_W * plot.size.x, rp.y / MAP_H * plot.size.y),
			maxf(2.0, float(rock["radius"]) / MAP_W * plot.size.x), Color("#8b8190"))
	var marker := plot.position + Vector2(diver.position.x / MAP_W * plot.size.x,
		diver.position.y / MAP_H * plot.size.y)
	draw_circle(marker, 5.5, Color("#ffd78e"))
	draw_arc(marker, 12, 0, TAU, 28, Color("#d1f3e9"), 1.6)
	_text("POSICAO: %.0f / %.0f   |   %.0f m  |  +%d REGISTROS" %
		[diver.position.x, diver.position.y, diver.depth_m, discovered.size()],
		p + Vector2(31, 460), 15, Color("#cde9e8"))

func _draw_field_guide(x: float, y: float) -> void:
	draw_rect(Rect2(x + 640, y + 22, 610, 243), Color(0.013, 0.048, 0.076, 0.95))
	_text("DIARIO DE CAMPO  |  DESCOBERTAS", Vector2(x + 661, y + 53), 20, Color("#f9d99b"))
	var entries := _registered_species()
	var chosen: Dictionary = Ecology.get_species(last_observed_id)
	if entries.is_empty() or chosen.is_empty() or not entries.has(last_observed_id):
		_text("Nenhuma especie registrada ate agora.", Vector2(x + 661, y + 91), 16, Color("#c9f7f4"))
		_text("Aproxime-se de um animal e pressione F.", Vector2(x + 661, y + 126), 15, Color("#a7e6d0"))
	else:
		_text(chosen["name"], Vector2(x + 661, y + 86), 20, Color("#c9f7f4"))
		_text(chosen["scientific"], Vector2(x + 661, y + 112), 16, Color("#84c4cc"))
		_text(chosen["habitat"], Vector2(x + 661, y + 146), 14, Color("#c9f7f4"))
		_text(chosen["how_to_find"], Vector2(x + 661, y + 172), 14, Color("#a7e6d0"))
		_text(chosen["story"], Vector2(x + 661, y + 196), 14, Color("#c9f7f4"))
	_text("J / K NAVEGAR  |  REGISTROS %d / %d" % [entries.size(), Ecology.SPECIES.size()],
		Vector2(x + 661, y + 234), 15, Color("#f9d99b"))

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
