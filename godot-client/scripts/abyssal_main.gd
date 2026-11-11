extends Node2D
## Cinematic submarine bridge. The world/physics live in ocean_expedition.gd.
const ExpeditionScript = preload("res://scripts/ocean_expedition.gd")
var expedition: Node2D
## Native 2.5D presentation prototype. No production gameplay has been migrated yet.
## Kept independent from the existing Node.js/WebSocket server.
const W := 1280.0
const H := 720.0
const INK := Color("#041426")
const BLUE := Color("#126c91")
const AQUA := Color("#49e2ef")
const GOLD := Color("#f9b55d")
const FOAM := Color("#c8f8f5")

var in_open_sea := false
var pilot_position := Vector2(640.0, 340.0)
var time_s := 0.0
var bubbles: Array[Vector2] = []

func _ready() -> void:
	for i in range(75):
		bubbles.append(Vector2(fposmod(float(i * 197 + 31), W), fposmod(float(i * 113 + 47), H)))
	expedition = ExpeditionScript.new()
	expedition.name = "ExpedicaoOceanica"
	expedition.process_mode = Node.PROCESS_MODE_DISABLED
	expedition.visible = false
	add_child(expedition)
	set_process(true)

func _process(delta: float) -> void:
	time_s += delta
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			if in_open_sea:
				in_open_sea = false
				expedition.call("end_expedition")
		elif event.keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE] and not in_open_sea:
			_start_sea()
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if not in_open_sea and Rect2(468, 609, 345, 63).has_point(get_global_mouse_position()):
			_start_sea()

func _start_sea() -> void:
	in_open_sea = true
	expedition.call("begin_expedition")

func _draw() -> void:
	if in_open_sea:
		return
	_draw_ocean()
	# Slow day/night shift on the window; warm interior LEDs remain readable.
	var daylight := 0.53 + 0.47 * cos(TAU * time_s / 420.0)
	draw_rect(Rect2(0, 0, W, H), Color(0.008, 0.015, 0.055, (1.0 - daylight) * 0.68))
	_draw_cockpit()
	_draw_pilot(Vector2(640, 490))
	_draw_console()
	_draw_cabin_instruments(daylight)
	_draw_label("ABYSSAL", Vector2(510, 77), 43, FOAM)
	_draw_label("EXPEDICAO OCEANICA", Vector2(521, 111), 16, GOLD)
	_draw_label("INICIAR EXPLORACAO [ENTER]", Vector2(483, 651), 21, FOAM)

func _draw_ocean() -> void:
	# Depth-graded seascape, with layered shafts and suspended particles.
	for band in range(42):
		var blend := float(band) / 42.0
		var shade := Color("#127d98").lerp(Color("#031326"), blend)
		draw_rect(Rect2(0, band * H / 42.0, W, H / 42.0 + 2), shade)
	for ray in range(8):
		var shift := sin(time_s * 0.24 + ray) * 23.0
		var top := 100.0 + ray * 167.0
		draw_colored_polygon(PackedVector2Array([
			Vector2(top + shift, 0), Vector2(top + 31 + shift, 0),
			Vector2(top + 320 + shift, H), Vector2(top + 200 + shift, H)
		]), Color(0.16, 0.82, 0.88, 0.025))
	for i in range(bubbles.size()):
		var p := bubbles[i]
		var x := p.x + sin(time_s * 0.8 + float(i)) * 8
		var y := fposmod(p.y - time_s * (5.0 + float(i % 8) * 2.1), H)
		draw_circle(Vector2(x, y), 0.9 + float(i % 3) * 0.5, Color(0.7, 0.98, 1, 0.19))
	for i in range(14):
		var x := 50.0 + float((i * 251) % 1200)
		var y := 115.0 + float((i * 149) % 460)
		var phase := time_s * (0.36 + float(i % 4) * 0.1)
		_draw_fish(Vector2(x + sin(phase) * 42.0, y + cos(phase * 0.7) * 6.0), 0.6 + float(i % 4) * 0.13)

func _draw_fish(pos: Vector2, scale_factor: float) -> void:
	var xform := Transform2D(0.0, pos)
	draw_set_transform_matrix(xform.scaled(Vector2(scale_factor, scale_factor)))
	draw_colored_polygon(PackedVector2Array([
		Vector2(-13, 0), Vector2(-23, -8), Vector2(-21, 8)
	]), Color("#205f76"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(-15, 0), Vector2(-8, -6), Vector2(7, -7),
		Vector2(17, 0), Vector2(7, 7), Vector2(-8, 6)
	]), Color("#73c7ce"))
	draw_line(Vector2(-8, -4), Vector2(10, -1), Color("#d0f7ee"), 1.0)
	draw_circle(Vector2(10, -1), 1.7, INK)
	draw_set_transform_matrix(Transform2D.IDENTITY)

func _draw_cockpit() -> void:
	# Layered bulkheads and window frames for a pseudo-3D underwater bridge.
	draw_colored_polygon(PackedVector2Array([
		Vector2(0, 0), Vector2(270, 0), Vector2(218, 484), Vector2(0, 605)
	]), Color("#0a2639"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(1010, 0), Vector2(W, 0), Vector2(W, 605), Vector2(1062, 484)
	]), Color("#0a2639"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(0, 0), Vector2(W, 0), Vector2(1045, 98), Vector2(237, 98)
	]), Color("#082238"))
	draw_line(Vector2(240, 95), Vector2(215, 483), Color("#1c5874"), 18)
	draw_line(Vector2(1040, 95), Vector2(1066, 483), Color("#1c5874"), 18)
	draw_line(Vector2(245, 96), Vector2(1038, 96), AQUA.darkened(0.55), 11)
	draw_arc(Vector2(640, 330), 493, PI * 1.08, PI * 1.92, 56, Color("#17718d"), 10)
	draw_colored_polygon(PackedVector2Array([
		Vector2(0, 590), Vector2(280, 486), Vector2(998, 486),
		Vector2(W, 590), Vector2(W, H), Vector2(0, H)
	]), Color("#0c2637"))
	for i in range(2):
		var px := 79.0 if i == 0 else 1201.0
		draw_rect(Rect2(px - 31, 155, 62, 296), Color("#143a4b"))
		draw_rect(Rect2(px - 21, 174, 42, 244), Color("#051925"))
		for j in range(8):
			draw_rect(Rect2(px - 16, 183 + j * 27, 32, 4), AQUA.darkened(0.55))

func _draw_pilot(pos: Vector2) -> void:
	# Stylized bridge pilot assembled as separate shadow, suit, and face layers.
	_draw_filled_ellipse(pos + Vector2(0, 90), Vector2(88, 20), Color(0, 0, 0, 0.35))
	draw_colored_polygon(PackedVector2Array([
		pos + Vector2(-41, 16), pos + Vector2(-70, 132),
		pos + Vector2(70, 132), pos + Vector2(42, 16)
	]), Color("#102735"))
	draw_colored_polygon(PackedVector2Array([
		pos + Vector2(-31, 19), pos + Vector2(-44, 112),
		pos + Vector2(43, 112), pos + Vector2(30, 19)
	]), Color("#28556a"))
	for side in [-1.0, 1.0]:
		draw_line(pos + Vector2(side * 27, 39), pos + Vector2(side * 54, 102), Color("#33576b"), 24)
		draw_line(pos + Vector2(side * 23, 43), pos + Vector2(side * 48, 91), AQUA.darkened(0.65), 3)
	# Hair rendered behind the face with warm highlights.
	_draw_filled_ellipse(pos + Vector2(0, -43), Vector2(49, 69), Color("#281c20"))
	_draw_filled_ellipse(pos + Vector2(-6, -47), Vector2(39, 54), Color("#664038"))
	_draw_filled_ellipse(pos + Vector2(0, -38), Vector2(31, 39), Color("#dcab90"))
	_draw_filled_ellipse(pos + Vector2(-10, -12), Vector2(18, 10), Color("#ba7b68"))
	draw_line(pos + Vector2(-18, -44), pos + Vector2(-5, -43), INK, 2.8)
	draw_line(pos + Vector2(7, -43), pos + Vector2(20, -44), INK, 2.8)
	draw_circle(pos + Vector2(-11, -43), 2.5, Color("#263d43"))
	draw_circle(pos + Vector2(13, -43), 2.5, Color("#263d43"))
	draw_line(pos + Vector2(-4, -21), pos + Vector2(7, -21), Color("#9e6259"), 1.8)
	draw_arc(pos + Vector2(0, -51), 42, PI * 1.05, PI * 1.93, 24, Color("#3d2927"), 17)
	_draw_label("NF", pos + Vector2(-12, 83), 17, GOLD)

func _draw_console() -> void:
	# Cockpit console is drawn last to occlude the pilot like physical foreground.
	draw_colored_polygon(PackedVector2Array([
		Vector2(206, 541), Vector2(1073, 541), Vector2(W, H),
		Vector2(0, H)
	]), Color("#061726"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(267, 546), Vector2(1012, 546),
		Vector2(1129, 699), Vector2(143, 699)
	]), Color("#173e52"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(301, 556), Vector2(978, 556),
		Vector2(1026, 614), Vector2(256, 614)
	]), Color("#071b29"))
	draw_line(Vector2(304, 557), Vector2(977, 557), AQUA, 3)
	for i in range(15):
		var x := 313 + i * 47
		draw_rect(Rect2(x, 572, 29, 15), AQUA.darkened(0.28) if i % 3 == 0 else Color("#225466"))
		draw_rect(Rect2(x + 5, 575, 18, 3), Color("#a6f7ec") if i % 3 == 0 else GOLD.darkened(0.4))
	draw_rect(Rect2(467, 608, 347, 66), Color("#072938"))
	draw_rect(Rect2(474, 615, 333, 52), Color("#0b6378"))
	draw_rect(Rect2(480, 620, 322, 42), Color("#104257"))
	draw_line(Vector2(481, 620), Vector2(800, 620), AQUA, 2.5)
	for i in range(4):
		draw_circle(Vector2(208 + i * 27, 660), 6, GOLD if i == 0 else AQUA.darkened(0.6))
		draw_circle(Vector2(990 + i * 27, 660), 6, GOLD if i == 0 else AQUA.darkened(0.6))


func _draw_cabin_instruments(daylight: float) -> void:
	# Architectural trim, brass highlights and emissive screen accents.
	var panel_light := AQUA.lerp(GOLD, 0.16)
	draw_line(Vector2(234, 124), Vector2(1046, 124), Color("#90dfe5"), 2.0)
	draw_line(Vector2(247, 130), Vector2(1033, 130), Color(0.16, 0.64, 0.68, 0.42), 7.0)
	draw_arc(Vector2(640, 330), 457.0, PI * 1.08, PI * 1.92, 56, Color("#89c9c5"), 3.0)
	# Animated map: a physical screen, not a detached HTML overlay.
	draw_rect(Rect2(118, 615, 233, 81), Color("#061a28"))
	draw_rect(Rect2(126, 622, 218, 65), Color("#0b3b49"))
	for k in range(6):
		var shift := float(k) * 22.0
		draw_arc(Vector2(235, 656), 13.0 + shift, -PI * 0.9, PI * 0.1,
			32, Color(0.2, 0.85, 0.82, 0.3), 1.5)
	draw_line(Vector2(235, 655), Vector2(235 + cos(time_s * 0.42) * 90.0,
		655 + sin(time_s * 0.42) * 44.0), panel_light, 2.0)
	_draw_label("SONAR  |  VIDA MARINHA", Vector2(137, 637), 12, FOAM)
	# Depth and habitat readout on starboard console.
	draw_rect(Rect2(927, 615, 236, 81), Color("#061a28"))
	draw_rect(Rect2(935, 622, 220, 65), Color("#123e4b"))
	_draw_label("OCEANO  /  EXPLORACAO", Vector2(943, 641), 13, FOAM)
	_draw_label("LUZ SOLAR: %d%%" % int(daylight * 100), Vector2(946, 666), 16, GOLD)
	for k in range(11):
		var x := 956.0 + float(k) * 17.0
		draw_rect(Rect2(x, 674, 11, 5), panel_light if k < int(daylight * 11.0) else Color("#1c404c"))
	# Reflections and the soft amber practical lights above the pilot.
	for side in [-1.0, 1.0]:
		var x := 640.0 + side * 300.0
		draw_circle(Vector2(x, 114), 15.0, Color(1.0, 0.64, 0.24, 0.11))
		draw_circle(Vector2(x, 114), 5.0, GOLD)
		draw_line(Vector2(x, 118), Vector2(x - side * 34.0, 164.0), Color(1.0, 0.72, 0.43, 0.07), 22)

func _draw_label(value: String, pos: Vector2, size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, pos, value, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _draw_filled_ellipse(center: Vector2, radii: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for k in range(33):
		var angle := TAU * float(k) / 32.0
		points.append(center + Vector2(cos(angle) * radii.x, sin(angle) * radii.y))
	draw_colored_polygon(points, color)
