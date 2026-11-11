extends Node2D
## Cinematic submarine bridge. The world/physics live in ocean_expedition.gd.
const ExpeditionScript = preload("res://scripts/ocean_expedition.gd")
const ProgressScript = preload("res://scripts/exploration_progress.gd")
const CabinArt = preload("res://scripts/native_cabin_art.gd")
var expedition: Node2D
var progress: RefCounted
var lab_open := false
var lab_selected := 0
var lab_feedback := ""
var menu_selected := 5
var menu_feedback := ""

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
		if lab_open:
			if event.keycode in [KEY_ESCAPE, KEY_L]:
				lab_open = false
			elif event.keycode >= KEY_1 and event.keycode <= KEY_6:
				lab_selected = clampi(int(event.keycode - KEY_1),0,ProgressScript.SHOP_ORDER.size()-1)
			elif event.keycode == KEY_R:
				_study_selected()
			return
		if event.keycode == KEY_L:
			_choose_menu(1)
			return
		if event.keycode == KEY_M:
			_choose_menu(5)
			return
		if event.keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
			_start_sea()
			return
		if event.keycode >= KEY_1 and event.keycode <= KEY_6:
			_choose_menu(int(event.keycode-KEY_1))
			return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed and not in_open_sea:
		var pointer := get_global_mouse_position()
		if lab_open:
			for k in range(ProgressScript.SHOP_ORDER.size()):
				var px := 170.0 + float(k % 2) * 475.0
				var py := 212.0 + float(int(k / 2)) * 84.0
				if Rect2(px,py,450.0,74.0).has_point(pointer):
					lab_selected = k
					return
			if Rect2(918,469,226,50).has_point(pointer):
				_study_selected()
			return
		var chosen: int = CabinArt.click_menu(pointer)
		if chosen >= 0:
			_choose_menu(chosen)
		elif menu_selected == 2 and Rect2(592,406,485,57).has_point(Vector2((pointer.x-55.0)/0.95,pointer.y)):
			_start_sea()

func _choose_menu(index: int) -> void:
	menu_selected = clampi(index,0,CabinArt.MENU.size()-1)
	menu_feedback = ""
	match menu_selected:
		1:
			lab_open = true
		2:
			_start_sea()
		0:
			menu_feedback = "LOJA: DISPONIVEL APENAS NO CLIENTE WEB"
		3:
			menu_feedback = "FOSSAS: DISPONIVEL APENAS NO CLIENTE WEB"
	queue_redraw()

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
	CabinArt.paint(self,time_s,menu_selected,progress,menu_feedback)
	if lab_open:
		_draw_laboratory()

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
