extends RefCounted
## Small deterministic geological resource fields, loaded only around the diver.
## Schema, tool selection, ranges and amount follow abyssal-resource-fields.js.
const CHUNK := 1200.0
const WORLD_W := 24000.0
const WORLD_H := 21000.0
const INTERACT_RANGE := 125.0
const ICON_COLORS := {
	"seaMineral": Color("#7796a8"),
	"phosphorite": Color("#d5b377"),
	"ferromanganeseCrust": Color("#69758c"),
	"polymetallicNodule": Color("#ad9e91"),
	"hydrothermalSulfide": Color("#88b998"),
	"oilSeep": Color("#98795a"),
	"gasSeep": Color("#5fc4b1")
}
var _cache: Dictionary = {}

func _cell(cx: int, cy: int, world: Node2D) -> Array:
	var key := str(cx) + ":" + str(cy)
	if _cache.has(key):
		return _cache[key]
	if _cache.size() >= 100:
		_cache.clear()
	var rng := RandomNumberGenerator.new()
	rng.seed = int((cx + 7) * 439483 + (cy + 3) * 92717 + 48153)
	var found: Array = []
	for slot in range(2):
		var candidate := Vector2.ZERO
		var near_rock := false
		var valid := false
		for attempt in range(14):
			near_rock = false
			if attempt < 7:
				for rock in world.ROCKS:
					var rock_pos: Vector2 = rock["pos"]
					var radius: float = float(rock["radius"])
					if int(floor(rock_pos.x / CHUNK)) != cx or int(floor(rock_pos.y / CHUNK)) != cy:
						continue
					var theta := rng.randf_range(-2.9, -0.3)
					candidate = rock_pos + Vector2(cos(theta), sin(theta)) * (radius + 58.0)
					near_rock = true
					break
			if not near_rock:
				var x := float(cx) * CHUNK + rng.randf_range(85.0, CHUNK - 85.0)
				candidate = Vector2(x, float(world.call("_seafloor_y", x)) - rng.randf_range(46.0, 61.0))
			if candidate.x < float(cx) * CHUNK + 45.0 or candidate.x > float(cx + 1) * CHUNK - 45.0:
				continue
			if candidate.y < float(cy) * CHUNK + 40.0 or candidate.y > float(cy + 1) * CHUNK - 40.0:
				continue
			if not bool(world.call("is_navigable", candidate, 36.0)):
				continue
			valid = true
			break
		if not valid:
			continue
		var depth := float(world.call("depth_at_y", candidate.y))
		var kind := _choose_type(depth, near_rock, rng)
		# Seeps are attached to bedrock; no floating gas/oil deposits.
		if not near_rock and (kind == "gasSeep" or kind == "oilSeep"):
			kind = "ferromanganeseCrust"
		var amt := 1 if kind == "gasSeep" or kind == "oilSeep" else rng.randi_range(1, 3)
		found.append({
			"id": "geo:" + str(cx) + ":" + str(cy) + ":" + str(slot),
			"type": kind,
			"pos": candidate,
			"amount": amt,
			"depth": depth,
			"rock_attached": near_rock
		})
	_cache[key] = found
	return found

func _choose_type(depth: float, rock: bool, rng: RandomNumberGenerator) -> String:
	var types: Array[String] = []
	if depth < 180.0:
		types = ["seaMineral", "seaMineral", "phosphorite"]
	elif depth < 550.0:
		types = ["seaMineral", "phosphorite", "ferromanganeseCrust", "ferromanganeseCrust", "oilSeep"]
	elif depth < 1200.0:
		types = ["ferromanganeseCrust", "hydrothermalSulfide", "phosphorite", "oilSeep", "gasSeep"]
	else:
		types = ["polymetallicNodule", "polymetallicNodule", "ferromanganeseCrust", "hydrothermalSulfide", "gasSeep", "oilSeep"]
	var kind := str(types[rng.randi_range(0, types.size() - 1)])
	if (kind == "gasSeep" or kind == "oilSeep") and rng.randf() > 0.38:
		kind = "polymetallicNodule" if depth > 1200.0 else "ferromanganeseCrust"
	if kind == "polymetallicNodule" and rock:
		kind = "ferromanganeseCrust"
	if kind == "hydrothermalSulfide" and depth < 650.0:
		kind = "phosphorite"
	if kind == "hydrothermalSulfide" and not rock:
		kind = "polymetallicNodule" if depth > 1200.0 else "ferromanganeseCrust"
	return kind

func stream_near(world: Node2D, center: Vector2, radius: float, collected: Dictionary) -> Array[Dictionary]:
	var output: Array[Dictionary] = []
	var left := maxi(0, int(floor((center.x - radius) / CHUNK)))
	var right := mini(int(WORLD_W / CHUNK) - 1, int(floor((center.x + radius) / CHUNK)))
	var top := maxi(0, int(floor((center.y - radius) / CHUNK)))
	var bottom := mini(int(WORLD_H / CHUNK) - 1, int(floor((center.y + radius) / CHUNK)))
	for cy in range(top, bottom + 1):
		for cx in range(left, right + 1):
			for node in _cell(cx, cy, world):
				if collected.has(node["id"]):
					continue
				var p: Vector2 = node["pos"]
				if center.distance_squared_to(p) <= radius * radius:
					output.append(node)
	output.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var apos: Vector2 = a["pos"]
		var bpos: Vector2 = b["pos"]
		return center.distance_squared_to(apos) < center.distance_squared_to(bpos)
	)
	if output.size() > 64:
		output.resize(64)
	return output

static func color_for(kind: String) -> Color:
	return ICON_COLORS.get(kind, Color("#b1c6bf"))

static func tool_for(kind: String) -> String:
	return "emptyCylinder" if kind == "oilSeep" or kind == "gasSeep" else "abyssPickaxe"

static func duration_for(kind: String) -> float:
	return 2.6 if tool_for(kind) == "emptyCylinder" else 1.9

static func paint(canvas: Node2D, node: Dictionary, t: float, highlighted: bool) -> void:
	var kind := str(node["type"])
	var p: Vector2 = node["pos"]
	var base_color := color_for(kind)
	var pulse := 0.8 + 0.2 * sin(t * 2.0 + p.x * 0.03)
	canvas.draw_set_transform(p, 0.0, Vector2.ONE)
	# Basalt socket beneath each geological find.
	canvas.draw_colored_polygon(PackedVector2Array([
		Vector2(-22, 13), Vector2(-18, -7), Vector2(-5, -15),
		Vector2(18, -10), Vector2(26, 11), Vector2(11, 18)
	]), Color("#092535"))
	if kind == "gasSeep" or kind == "oilSeep":
		for k in range(4):
			var rise := fposmod(t * (13.0 + float(k) * 3.0) + float(k) * 12.0, 50.0)
			var bubble_pos := Vector2(float(k * 6 - 12) + 5.0 * sin(t + float(k)), -rise - 7.0)
			canvas.draw_arc(bubble_pos, 3.5 + float(k % 2), 0.0, TAU, 18,
				base_color.lightened(0.25), 1.6)
		canvas.draw_line(Vector2(-11, 12), Vector2(10, -15), base_color, 4.0)
	elif kind == "hydrothermalSulfide":
		for k in range(5):
			var x := float(k) * 8.0 - 17.0
			canvas.draw_line(Vector2(x, 11), Vector2(x + 5, -21.0 - float(k % 3) * 6.0),
				base_color.lightened(float(k) * 0.04), 4.0)
	elif kind == "polymetallicNodule":
		for k in range(4):
			canvas.draw_circle(Vector2(float(k * 10 - 17), float(k % 2 * 7 - 1)),
				7.5 + float(k % 2) * 3.0, base_color.darkened(float(k) * 0.07))
	elif kind == "ferromanganeseCrust":
		canvas.draw_colored_polygon(PackedVector2Array([
			Vector2(-21, 8), Vector2(-18, -9), Vector2(-3, -17),
			Vector2(18, -6), Vector2(21, 10), Vector2(1, 14)
		]), base_color)
		canvas.draw_line(Vector2(-14, 0), Vector2(17, -2), base_color.lightened(0.22), 3.0)
	else:
		canvas.draw_colored_polygon(PackedVector2Array([
			Vector2(-13, 9), Vector2(-19, -9),
			Vector2(-4, -19), Vector2(10, -13), Vector2(19, 10), Vector2(0, 15)
		]), base_color)
		canvas.draw_line(Vector2(-11, -6), Vector2(9, -13), base_color.lightened(0.33), 2.0)
	if highlighted:
		canvas.draw_arc(Vector2.ZERO, 38.0, 0.0, TAU, 48,
			Color(0.93, 0.77, 0.49, pulse), 2.5)
	canvas.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
