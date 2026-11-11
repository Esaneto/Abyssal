extends RefCounted
## Procedural cinematic materials for Abyssal's native exploration.
## Rendering only: never create collision geometry, rewards or game state.
## Every detail is deterministic and bounded to the active camera.
const NIGHT := Color("#020b16")
const WATER := Color("#0a5668")
const ICE := Color("#7bc3c2")
const STEEL := Color("#152c39")
const GOLD := Color("#dd9b59")
static var _stone_texture: Texture2D = null

static func stone_texture() -> Texture2D:
	if _stone_texture != null:
		return _stone_texture
	# CPU-generated once, then sampled by the renderer. No external art assets.
	var coarse := FastNoiseLite.new()
	coarse.seed = 184321
	coarse.frequency = 0.039
	var fine := FastNoiseLite.new()
	fine.seed = 31781
	fine.frequency = 0.21
	var img := Image.create(192, 192, false, Image.FORMAT_RGBA8)
	for y in range(192):
		for x in range(192):
			var low := coarse.get_noise_2d(float(x), float(y))
			var high := fine.get_noise_2d(float(x), float(y))
			var veins := sin(float(y) * 0.24 + low * 8.0) * 0.045
			var v := clampf(0.77 + low * 0.19 + high * 0.14 + veins, 0.39, 1.0)
			img.set_pixel(x, y, Color(v * 0.48, v * 0.74, v * 0.94, 1.0))
	img.generate_mipmaps()
	_stone_texture = ImageTexture.create_from_image(img)
	return _stone_texture

static func poly(canvas: CanvasItem, vertices: PackedVector2Array, tint: Color) -> void:
	canvas.draw_colored_polygon(vertices, tint)

static func oval(canvas: CanvasItem, center: Vector2, radii: Vector2, tint: Color, segments: int = 28) -> void:
	var points := PackedVector2Array()
	for i in range(segments):
		var a := TAU * float(i) / float(segments)
		points.append(center + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	poly(canvas, points, tint)

static func cabin_view(canvas: CanvasItem, time_s: float) -> void:
	# Layered water, remote cliffs and beams make the front window look deep.
	var sun := 0.53 + 0.47 * cos(TAU * time_s / 420.0)
	for band in range(60):
		var t := float(band) / 59.0
		var base := Color("#041627").lerp(Color("#0e6377"), (1.0 - t) * sun * 0.91)
		canvas.draw_rect(Rect2(0.0, float(band) * 12.0, 1280.0, 13.0), base)
	# Distant continental formations: translucent, non-collidable silhouettes.
	for layer in range(3):
		var base_y := 315.0 + float(layer) * 92.0
		var ridge := PackedVector2Array()
		for i in range(30):
			var x := float(i) * 46.0
			var sway := sin(x / 138.0 + float(layer) * 1.4) * (32.0 + float(layer) * 12.0)
			var detail := sin(x / 41.0 + float(layer) * 2.9) * 11.0
			ridge.append(Vector2(x, base_y + sway + detail))
		ridge.append(Vector2(1335.0, 720.0))
		ridge.append(Vector2(0.0, 720.0))
		poly(canvas, ridge, Color("#062130").lerp(Color("#0b303b"), float(layer) * 0.15 + sun * 0.06))
	# Underwater rays are subtle and move without jitter.
	for ray in range(9):
		var top := float(ray) * 174.0 - 56.0
		var drift := sin(time_s * 0.15 + float(ray) * 0.53) * 35.0
		poly(canvas, PackedVector2Array([
			Vector2(top + drift, 0), Vector2(top + 32.0 + drift, 0),
			Vector2(top + 255.0 + drift, 660), Vector2(top + 74.0 + drift, 660)
		]), Color(0.35, 0.85, 0.82, 0.018 + sun * 0.019))
	# Remote creatures are tiny silhouettes, not a wall of identical fish.
	for i in range(10):
		var x := 165.0 + float((i * 257) % 1040) + sin(time_s * (0.09 + float(i % 4) * 0.04) + float(i)) * 24.0
		var y := 206.0 + float((i * 107) % 230)
		var size := 3.5 + float(i % 4) * 1.5
		# Two convex silhouettes. The former combined polygon self-intersected.
		poly(canvas, PackedVector2Array([
			Vector2(x - size * 1.7, y),
			Vector2(x - size * 3.0, y - size * 0.9),
			Vector2(x - size * 3.0, y + size * 0.9)
		]), Color(0.10, 0.33, 0.39, 0.30))
		poly(canvas, PackedVector2Array([
			Vector2(x - size * 2.0, y),
			Vector2(x - size, y - size * 0.67),
			Vector2(x + size, y - size * 0.55),
			Vector2(x + size * 2.0, y),
			Vector2(x + size, y + size * 0.55),
			Vector2(x - size, y + size * 0.67)
		]), Color(0.10, 0.33, 0.39, 0.30))
	# Atmospheric particulates imply scale between the glass and the distance.
	for i in range(84):
		var x := fposmod(float(i * 199 + 43) + sin(time_s * 0.18 + i) * 5.0, 1280.0)
		var y := fposmod(float(i * 337 + 29) - time_s * (1.9 + float(i % 4)), 720.0)
		canvas.draw_circle(Vector2(x, y), 0.65 + float(i % 3) * 0.35, Color(0.70, 0.93, 0.86, 0.13))

static func cabin_structure(canvas: CanvasItem, time_s: float) -> void:
	# Bevels, cast shadows and brushed ribs are physical parts of the bridge.
	for side in [-1.0, 1.0]:
		var edge := 231.0 if side < 0.0 else 1049.0
		canvas.draw_line(Vector2(edge, 98), Vector2(edge - side * 28.0, 478), Color("#020d18"), 28.0, true)
		canvas.draw_line(Vector2(edge + side * 5.0, 104), Vector2(edge - side * 19.0, 479),
			Color("#466c75"), 6.0, true)
		canvas.draw_line(Vector2(edge + side * 1.0, 125), Vector2(edge - side * 23.0, 470),
			Color(0.32, 0.80, 0.82, 0.28), 1.8, true)
	# Linear scuffs, riveting and warm points break sterile vector planes.
	for i in range(42):
		var x := 241.0 + float(i) * 19.0
		canvas.draw_line(Vector2(x, 97), Vector2(x + 9, 97), Color(0.60, 0.84, 0.85, 0.12), 1.0)
	for i in range(10):
		var x := 262.0 + float(i) * 83.0
		canvas.draw_circle(Vector2(x, 116), 2.3, Color("#061722"))
		canvas.draw_circle(Vector2(x - 0.7, 115.0), 0.8, Color("#90aeb0"))
	# Shaded top consoles and small indirect amber glows.
	for side in [-1.0, 1.0]:
		var lamp := Vector2(640.0 + 345.0 * side, 116.0)
		oval(canvas, lamp, Vector2(30, 18), Color(0.83, 0.39, 0.11, 0.04), 32)
		oval(canvas, lamp, Vector2(12, 8), Color(1.0, 0.70, 0.27, 0.13), 24)
		canvas.draw_circle(lamp, 3.3, GOLD)
	# Cabin glass reflections do not interfere with the physical UI.
	for i in range(3):
		var x := 338.0 + float(i) * 295.0 + sin(time_s * 0.2 + i) * 9.0
		canvas.draw_line(Vector2(x, 141), Vector2(x - 108.0, 394.0), Color(0.76, 0.94, 0.93, 0.045), 12.0, true)
		canvas.draw_line(Vector2(x + 20, 153), Vector2(x - 68, 353), Color(0.76, 0.94, 0.93, 0.07), 1.5, true)

static func cabin_pilot(canvas: CanvasItem, pos: Vector2, time_s: float) -> void:
	# A seated scuba pilot viewed from behind, no cartoon face and no doubled arms.
	var breath := sin(time_s * 1.25) * 1.6
	oval(canvas, pos + Vector2(0, 110), Vector2(104, 23), Color(0.0, 0.0, 0.0, 0.28))
	# Padded seat and mechanical backrest, shown behind the shoulders.
	poly(canvas, PackedVector2Array([
		pos + Vector2(-78, 117), pos + Vector2(-82, 14), pos + Vector2(-60, -12),
		pos + Vector2(60, -12), pos + Vector2(82, 14), pos + Vector2(78, 117)
	]), Color("#0b202d"))
	canvas.draw_line(pos + Vector2(-74, 14), pos + Vector2(-70, 98), Color("#376071"), 8, true)
	canvas.draw_line(pos + Vector2(74, 14), pos + Vector2(70, 98), Color("#376071"), 8, true)
	# Suit shoulder silhouette and neoprene folds.
	poly(canvas, PackedVector2Array([
		pos + Vector2(-48, -4 + breath), pos + Vector2(-77, 27),
		pos + Vector2(-62, 119), pos + Vector2(62, 119),
		pos + Vector2(77, 27), pos + Vector2(48, -4 + breath)
	]), Color("#102c3c"))
	poly(canvas, PackedVector2Array([
		pos + Vector2(-42, 2 + breath), pos + Vector2(-53, 78),
		pos + Vector2(-31, 116), pos + Vector2(33, 116),
		pos + Vector2(56, 78), pos + Vector2(42, 2 + breath)
	]), Color("#254a5a"))
	# Single arm on either side, reaching toward physical controls.
	for side in [-1.0, 1.0]:
		canvas.draw_line(pos + Vector2(side * 57, 28), pos + Vector2(side * 91, 90), Color("#102a3a"), 24, true)
		canvas.draw_line(pos + Vector2(side * 53, 25), pos + Vector2(side * 82, 79), Color("#366274"), 8, true)
		canvas.draw_line(pos + Vector2(side * 91, 90), pos + Vector2(side * 109, 117), Color("#172e40"), 17, true)
		oval(canvas, pos + Vector2(side * 109, 120), Vector2(10, 7), Color("#425967"))
	# Pressurised dive cylinder with bevelled metal, straps and reflective strip.
	oval(canvas, pos + Vector2(0, 42), Vector2(30, 64), Color("#071723"))
	oval(canvas, pos + Vector2(0, 39), Vector2(23, 58), Color("#557783"))
	canvas.draw_rect(Rect2(pos + Vector2(-16, -12), Vector2(32, 103)), Color("#2b5567"))
	canvas.draw_rect(Rect2(pos + Vector2(-9, -11), Vector2(5, 101)), Color(0.74, 0.93, 0.92, 0.25))
	for y in [5.0, 70.0]:
		canvas.draw_rect(Rect2(pos + Vector2(-29, y), Vector2(58, 12)), Color("#122c3a"))
		canvas.draw_line(pos + Vector2(-26, y + 3), pos + Vector2(26, y + 3), Color("#547786"), 1.5, true)
	# Two hoses connect mask and tank around shoulders, and harness locks to suit.
	canvas.draw_arc(pos + Vector2(-19, -15), 51, PI * 0.90, PI * 1.42, 22, Color("#0a222e"), 7)
	canvas.draw_arc(pos + Vector2(19, -15), 51, PI * 1.6, PI * 2.13, 22, Color("#0a222e"), 7)
	canvas.draw_line(pos + Vector2(-34, 0), pos + Vector2(22, 73), Color("#0b2430"), 9, true)
	canvas.draw_line(pos + Vector2(34, 0), pos + Vector2(-22, 73), Color("#0b2430"), 9, true)
	canvas.draw_circle(pos + Vector2(0, 40), 10.0, Color("#091b25"))
	canvas.draw_circle(pos + Vector2(0, 40), 4.0, Color("#c49257"))
	# Helmet from behind, black neck seal and translucent curved edge.
	oval(canvas, pos + Vector2(0, -59 + breath), Vector2(44, 55), Color("#081b2a"))
	oval(canvas, pos + Vector2(0, -65 + breath), Vector2(35, 46), Color("#345363"))
	oval(canvas, pos + Vector2(-5, -70 + breath), Vector2(25, 35), Color("#476b77"))
	canvas.draw_arc(pos + Vector2(0, -58 + breath), 42.0, PI * 0.16, PI * 0.93, 22, Color("#98bdba"), 3.0)
	canvas.draw_line(pos + Vector2(-23, -21 + breath), pos + Vector2(23, -21 + breath), Color("#092431"), 11.0)
	for i in range(4):
		var x := -18.0 + float(i) * 12.0
		canvas.draw_line(pos + Vector2(x, -91 + breath), pos + Vector2(x + 6.0, -47 + breath),
			Color(0.08, 0.17, 0.23, 0.35), 2.0, true)
	# Narrow LEDs belong to the device, not floating glow.
	canvas.draw_rect(Rect2(pos + Vector2(-7, 94), Vector2(14, 4)), Color("#83dce0"))
	canvas.draw_circle(pos + Vector2(0, 95), 1.8, Color("#d1faf3"))

static func ocean_distance(canvas: CanvasItem, world: Node2D, area: Rect2, time_s: float, solar: float) -> void:
	# Faraway relief is low contrast and does NOT imply physical obstacles.
	# Near rocks use actual collision geometry elsewhere.
	var camera_depth: float = float(world.call("depth_at_y", area.get_center().y))
	for layer in range(3):
		var margin := 190.0 + float(layer) * 145.0
		var x0 := floorf(area.position.x / 64.0) * 64.0 - 80.0
		var ridge := PackedVector2Array()
		for j in range(35):
			var x := x0 + float(j) * 64.0
			var seabed: float = float(world.call("_seafloor_y", clampf(x, 0.0, 23990.0)))
			var slow_wave := sin(x / (180.0 + float(layer) * 70.0) + float(layer) * 1.6) * 42.0
			ridge.append(Vector2(x, seabed - margin + slow_wave))
		# Close below every possible seabed sample, avoiding folded polygons
		# when the camera is thousands of pixels above the sloping shelf.
		ridge.append(Vector2(x0 + 34.0 * 64.0, 23000.0))
		ridge.append(Vector2(x0, 23000.0))
		var fog := clampf(0.16 - float(layer) * 0.033 + solar * 0.032, 0.055, 0.21)
		poly(canvas, ridge, Color(0.10, 0.39, 0.47, fog * clampf(1.4 - camera_depth / 2300.0, 0.35, 1.0)))
	# Large-scale alternating haze subtly breaks up the uniform gradient.
	for band in range(7):
		var y := area.position.y + float(band) * area.size.y / 7.0
		canvas.draw_rect(Rect2(area.position.x, y, area.size.x, 48.0),
			Color(0.15, 0.36, 0.43, 0.018 + solar * 0.018))
	# Caustic network restricted to illuminated zones, not fake neon surface.
	if camera_depth < 225.0:
		var intensity := solar * clampf(1.0 - camera_depth / 260.0, 0.0, 1.0)
		var origin := floorf(area.position.x / 136.0) * 136.0
		for i in range(17):
			var x := origin + float(i) * 136.0
			var sway := sin(time_s * 0.42 + i * 0.72) * 25.0
			var y := area.position.y + 130.0 + float((i * 59) % 520)
			canvas.draw_arc(Vector2(x + sway, y), 47.0 + float(i % 4) * 8.0,
				PI * 0.12, PI * 0.89, 12, Color(0.47, 0.91, 0.86, intensity * 0.055), 2.4, true)

static func seafloor_material(canvas: CanvasItem, world: Node2D, area: Rect2, time_s: float) -> void:
	# Dots, cracks and embedded pebbles stay BELOW the true collidable seabed.
	var start := int(floor(area.position.x / 48.0)) - 1
	for i in range(44):
		var x := float(start + i) * 48.0
		var floor_y: float = float(world.call("_seafloor_y", x))
		if floor_y < area.position.y - 55.0 or floor_y > area.end.y + 35.0:
			continue
		var depth: float = float(world.call("depth_at_y", floor_y))
		var light := clampf(0.7 - depth / 1700.0, 0.10, 0.7)
		var drift := sin(x * 0.016 + time_s * 0.05) * 0.5
		canvas.draw_line(Vector2(x - 22, floor_y + 2), Vector2(x + 22, floor_y + drift),
			Color(0.33, 0.64, 0.66, light * 0.50), 2.0, true)
		for j in range(3):
			var dx := float(j * 13 - 16) + sin(x * 0.33 + j) * 5.0
			var dy := 9.0 + float((i * 7 + j * 17) % 26)
			oval(canvas, Vector2(x + dx, floor_y + dy), Vector2(5.0 + float(j) * 2, 2.0 + float(j)),
				Color(0.22, 0.38, 0.43, 0.18 + light * 0.18), 12)
		if depth > 350.0 and i % 6 == 0:
			# Very occasional manganese flecks on the abyss floor.
			canvas.draw_circle(Vector2(x + 5.0, floor_y + 14.0), 2.1, Color(0.19, 0.56, 0.51, 0.20))

static func rock_material(canvas: CanvasItem, contour: PackedVector2Array, center: Vector2, radius: float, light: float, time_s: float) -> void:
	# Organic noise-mapped stone, no repeated radial fan triangles.
	var colors := PackedColorArray()
	var uv := PackedVector2Array()
	for vertex in contour:
		var light_side := clampf(0.70 - (vertex.x - center.x) / (radius * 3.4) - (vertex.y - center.y) / (radius * 4.2), 0.26, 1.0)
		var tint := Color("#4b6872").lerp(Color("#879b98"), clampf(light * 0.68, 0.0, 1.0))
		colors.append(tint * (0.38 + light_side * 0.53))
		uv.append((vertex - center) / (radius * 2.0) + Vector2(0.5, 0.5))
	canvas.draw_polygon(contour, colors, uv, stone_texture())
	# Scattered irregular lamination: short, oblique and never all from one center.
	for k in range(9):
		var a := float(k) * 1.73 + center.x * 0.0007
		var local := Vector2(cos(a) * radius * 0.38, sin(a * 1.13) * radius * 0.30)
		var start := center + local
		var bend := Vector2(radius * 0.13, radius * (0.03 + float(k % 3) * 0.019))
		canvas.draw_line(start, start + bend,
			Color(0.08, 0.18, 0.21, 0.24), 1.5 + float(k % 2), true)
	# Attached sessile growth uses low energy at depth rather than scattered neon.
	for k in range(4):
		var p := center + Vector2(
			sin(center.x * 0.01 + float(k) * 2.3) * radius * 0.57,
			cos(center.y * 0.01 + float(k) * 1.8) * radius * 0.47)
		if light > 0.22:
			oval(canvas, p, Vector2(4.0 + float(k % 2) * 2, 2.8),
				Color(0.25, 0.51, 0.37, 0.15 + light * 0.21), 12)
		elif k % 2 == 0:
			canvas.draw_circle(p, 1.7, Color(0.23, 0.72, 0.70, 0.14 + 0.08 * sin(time_s + k)))

static func arch_material(canvas: CanvasItem, outline: PackedVector2Array, light: float) -> void:
	# Draws exactly the polygon installed as a CollisionPolygon2D.
	var bounds := Rect2(outline[0], Vector2.ZERO)
	for vertex in outline:
		bounds = bounds.expand(vertex)
	var size := Vector2(maxf(1.0, bounds.size.x), maxf(1.0, bounds.size.y))
	var colors := PackedColorArray()
	var uv := PackedVector2Array()
	for vertex in outline:
		var height_light := clampf(1.0 - (vertex.y - bounds.position.y) / size.y, 0.0, 1.0)
		var tint := Color("#52616d").lerp(Color("#869792"), clampf(light, 0.0, 0.85))
		colors.append(tint * (0.38 + height_light * 0.33))
		uv.append((vertex - bounds.position) / size)
	canvas.draw_polygon(outline, colors, uv, stone_texture())
	# Geological seams remain contained inside the volume of the stone.
	for k in range(5):
		var y := bounds.position.y + bounds.size.y * (float(k) + 0.7) / 6.0
		var x := bounds.position.x + 18.0
		var candidate := Vector2(x, y)
		if Geometry2D.is_point_in_polygon(candidate, outline):
			canvas.draw_line(candidate, candidate + Vector2(24.0, 5.0),
				Color(0.04, 0.12, 0.15, 0.24), 1.4, true)


static func kelp_frond(canvas: CanvasItem, x: float, base: float, length: float, time_s: float, seed: float) -> void:
	# One flexible stalk with translucent leaves, instead of a geometric fence.
	var sway := sin(time_s * 0.58 + seed) * 21.0
	var previous := Vector2(x, base)
	for section in range(1, 10):
		var t := float(section) / 9.0
		var current := Vector2(x + sway * t * t + sin(seed + t * 5.0) * 6.0 * t,
			base - length * t)
		canvas.draw_line(previous, current, Color("#1c4f48").lerp(Color("#4a8a76"), t * 0.55),
			5.0 - t * 2.5, true)
		if section >= 2 and section < 9:
			var side := -1.0 if section % 2 == 0 else 1.0
			var tip := current + Vector2(side * (22.0 + float(section % 3) * 6.0), -19.0 + sin(time_s + section) * 3.0)
			poly(canvas, PackedVector2Array([
				previous, tip, current + Vector2(side * 7.0, -4.0), current
			]), Color(0.13, 0.48 + t * 0.12, 0.37, 0.34 + t * 0.13))
			canvas.draw_line(previous, tip, Color(0.50, 0.77, 0.56, 0.18), 1.0, true)
		previous = current
