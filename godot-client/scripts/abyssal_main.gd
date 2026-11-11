extends Node2D
## Cinematic submarine bridge. The world/physics live in ocean_expedition.gd.
const ExpeditionScript = preload("res://scripts/ocean_expedition.gd")
const ProgressScript = preload("res://scripts/exploration_progress.gd")
const Art = preload("res://scripts/cinematic_art.gd")
var expedition: Node2D
var progress: RefCounted
var lab_open := false
var lab_selected := 0
var lab_feedback := ""

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
	progress = ProgressScript.new()
	time_s = progress.sun_time()
	for i in range(75):
		bubbles.append(Vector2(fposmod(float(i * 197 + 31), W), fposmod(float(i * 113 + 47), H)))
	expedition = ExpeditionScript.new()
	expedition.name = "ExpedicaoOceanica"
	expedition.process_mode = Node.PROCESS_MODE_DISABLED
	expedition.visible = false
	add_child(expedition)
	expedition.call("set_progress", progress)
	set_process(true)

func _process(delta: float) -> void:
	time_s += delta
	queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if in_open_sea:
			if event.keycode == KEY_ESCAPE:
				time_s = float(expedition.get("sky_time"))
				in_open_sea = false
				expedition.call("end_expedition")
			return
		if event.keycode == KEY_ESCAPE and lab_open:
			lab_open = false
			return
		if event.keycode == KEY_L:
			lab_open = not lab_open
			return
		if lab_open:
			if event.keycode >= KEY_1 and event.keycode <= KEY_6:
				lab_selected = clampi(int(event.keycode - KEY_1), 0, ProgressScript.SHOP_ORDER.size() - 1)
				return
			if event.keycode == KEY_R:
				_study_selected()
				return
		if event.keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
			_start_sea()
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed and not in_open_sea:
		var pointer := get_global_mouse_position()
		if lab_open:
			# Clickable native Godot lab cards, not an HTML overlay.
			for i in range(ProgressScript.SHOP_ORDER.size()):
				var px := 170.0 + float(i % 2) * 475.0
				var py := 212.0 + float(int(i / 2)) * 84.0
				if Rect2(px, py, 450.0, 74.0).has_point(pointer):
					lab_selected = i
					return
			if Rect2(918, 469, 226, 50).has_point(pointer):
				_study_selected()
			return
		if Rect2(468, 609, 345, 63).has_point(pointer):
			_start_sea()
		elif Rect2(118, 615, 233, 81).has_point(pointer):
			lab_open = true

func _study_selected() -> void:
	if progress == null:
		return
	var id := str(ProgressScript.SHOP_ORDER[lab_selected])
	var result: Dictionary = progress.study(id)
	lab_feedback = "PESQUISA CONCLUIDA: NIVEL %d" % int(result["level"]) if result.get("ok", false) else str(result.get("reason", "Pesquisa indisponivel"))
	queue_redraw()

func _start_sea() -> void:
	in_open_sea = true
	lab_open = false
	expedition.set("sky_time", time_s)
	expedition.call("begin_expedition")

func _draw() -> void:
	if in_open_sea:
		return
	_draw_ocean()
	# Slow day/night shift on the window; warm interior LEDs remain readable.
	var daylight := 0.53 + 0.47 * cos(TAU * time_s / 420.0)
	draw_rect(Rect2(0, 0, W, H), Color(0.008, 0.015, 0.055, (1.0 - daylight) * 0.68))
	_draw_cockpit()
	Art.cabin_structure(self, time_s)
	_draw_pilot(Vector2(640, 490))
	_draw_console()
	_draw_cabin_instruments(daylight)
	_draw_label("ABYSSAL", Vector2(510, 77), 43, FOAM)
	_draw_label("EXPEDICAO OCEANICA", Vector2(521, 111), 16, GOLD)
	_draw_label("INICIAR EXPLORACAO [ENTER]", Vector2(483, 651), 21, FOAM)
	_draw_label("LABORATORIO [L]", Vector2(141, 672), 13, GOLD)
	if lab_open:
		_draw_laboratory()

func _draw_ocean() -> void:
	# A living panoramic view; atmospheric art is drawn, not a static image.
	Art.cabin_view(self, time_s)

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
	# Back-facing diver, integrated into seat, cylinders and control desk.
	Art.cabin_pilot(self, pos, time_s)

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
		var x: float = 640.0 + float(side) * 300.0
		draw_circle(Vector2(x, 114), 15.0, Color(1.0, 0.64, 0.24, 0.11))
		draw_circle(Vector2(x, 114), 5.0, GOLD)
		draw_line(Vector2(x, 118), Vector2(x - side * 34.0, 164.0), Color(1.0, 0.72, 0.43, 0.07), 22)

func _draw_laboratory() -> void:
	draw_rect(Rect2(105, 131, 1070, 416), Color(0.012, 0.049, 0.076, 0.98))
	draw_rect(Rect2(118, 142, 1044, 389), Color("#113644"))
	_draw_label("LABORATORIO ABISSAL  |  EQUIPAMENTOS DE EXPLORACAO", Vector2(157, 179), 24, FOAM)
	_draw_label("SELECIONE 1-6  |  R PESQUISAR  |  ESC FECHAR", Vector2(159, 201), 15, GOLD)
	for i in range(ProgressScript.SHOP_ORDER.size()):
		var id := str(ProgressScript.SHOP_ORDER[i])
		var definition: Dictionary = ProgressScript.RESEARCH[id]
		var col := i % 2
		var row := int(i / 2)
		var p := Vector2(170.0 + float(col) * 475.0, 212.0 + float(row) * 84.0)
		var selected := i == lab_selected
		draw_rect(Rect2(p, Vector2(451, 73)), Color("#276b77") if selected else Color("#183c4b"))
		draw_rect(Rect2(p + Vector2(3, 3), Vector2(445, 67)), Color("#234859") if selected else Color("#0c2c3d"))
		_draw_label(str(i + 1) + "  " + str(definition["label"]), p + Vector2(13, 25), 17, FOAM)
		var level: int = int(progress.research_level(id))
		var status: String = progress.study_status(id)
		_draw_label("NIVEL %d / %d  |  %s" % [level, int(definition["max"]), status],
			p + Vector2(14, 46), 13, GOLD if status == "DISPONIVEL" else Color("#a0c4c6"))
		var costs: Dictionary = progress.research_cost(id)
		var parts: Array[String] = []
		for material in costs.keys():
			parts.append("%s %d/%d" % [
				str(material), progress.get_count(str(material)), int(costs[material])
			])
		_draw_label("  ".join(parts), p + Vector2(14, 63), 12, Color("#b1d4cc"))
	var chosen_id := str(ProgressScript.SHOP_ORDER[lab_selected])
	_draw_label(str(ProgressScript.RESEARCH[chosen_id]["detail"]), Vector2(163, 493), 15, FOAM)
	draw_rect(Rect2(918, 469, 226, 50), Color("#1e7280"))
	_draw_label("PESQUISAR [R]", Vector2(937, 499), 20, FOAM)
	if not lab_feedback.is_empty():
		_draw_label(lab_feedback, Vector2(162, 523), 14, GOLD)

func _draw_label(value: String, pos: Vector2, size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, pos, value, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _draw_filled_ellipse(center: Vector2, radii: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for k in range(33):
		var angle := TAU * float(k) / 32.0
		points.append(center + Vector2(cos(angle) * radii.x, sin(angle) * radii.y))
	draw_colored_polygon(points, color)
