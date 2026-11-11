extends Node2D
## Cinematic submarine bridge. The world/physics live in ocean_expedition.gd.
const ExpeditionScript = preload("res://scripts/ocean_expedition.gd")
const ProgressScript = preload("res://scripts/exploration_progress.gd")
const CabinArt = preload("res://scripts/native_cabin_art.gd")
const UIArt = preload("res://scripts/ui_art_primitives.gd")
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
	# Keep real research data, costs and click regions. Only the presentation changes.
	draw_rect(Rect2(0,83,1280,565),Color(0.0,0.03,0.09,0.78))
	UIArt.panel(self,Rect2(104,127,1070,420),true)
	UIArt.caption(self,"LABORATORIO ABISSAL",Vector2(151,174),25,Color("#ebfaff"))
	UIArt.caption(self,"PESQUISA  /  EQUIPAMENTO DE EXPEDICAO",Vector2(151,199),15,Color("#8de4f0"))
	UIArt.caption(self,"1-6 SELECIONAR   |   R PESQUISAR   |   ESC FECHAR",Vector2(704,175),14,Color("#ffcb79"))
	for i in range(ProgressScript.SHOP_ORDER.size()):
		var id: String = str(ProgressScript.SHOP_ORDER[i])
		var def: Dictionary = ProgressScript.RESEARCH[id]
		var col := i%2
		var row := int(i/2)
		var p := Vector2(170.0+float(col)*475.0,212.0+float(row)*84.0)
		var chosen := i==lab_selected
		UIArt.panel(self,Rect2(p,Vector2(450,73)),chosen)
		var tech_icon := "emptyCylinder" if id=="oxygenTank" else "polymetallicNodule" if id=="pressureSuit" else "sonar" if id=="sonar" else "deepCrystal"
		UIArt.item(self,tech_icon,p+Vector2(34,35),0.57)
		UIArt.caption(self,str(i+1)+"  "+str(def["label"]),p+Vector2(67,24),16,Color("#e8faff"))
		var level: int = progress.research_level(id)
		var status: String = progress.study_status(id)
		UIArt.caption(self,"NIVEL %d/%d  |  %s" % [level,int(def["max"]),status],
			p+Vector2(67,45),13,Color("#ffcc7c") if status=="DISPONIVEL" else Color("#a1dae3"))
		var costs: Dictionary = progress.research_cost(id)
		var info: Array[String] = []
		for key in costs.keys():
			info.append("%s %d/%d" % [str(key),progress.get_count(str(key)),int(costs[key])])
		UIArt.caption(self,"  ".join(info),p+Vector2(67,64),11,Color("#8cbdc9"),366.0)
	var selected_id: String = str(ProgressScript.SHOP_ORDER[lab_selected])
	UIArt.caption(self,str(ProgressScript.RESEARCH[selected_id]["detail"]),Vector2(159,494),15,Color("#d7f6f5"),736.0)
	UIArt.panel(self,Rect2(918,469,226,50),true)
	UIArt.caption(self,"PESQUISAR  [R]",Vector2(943,501),18,Color("#fff2ca"))
	if not lab_feedback.is_empty():
		UIArt.caption(self,lab_feedback,Vector2(155,532),13,Color("#ffc77b"),738.0)

func _draw_label(value: String, pos: Vector2, size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, pos, value, HORIZONTAL_ALIGNMENT_LEFT, -1, size, color)

func _draw_filled_ellipse(center: Vector2, radii: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for k in range(33):
		var angle := TAU * float(k) / 32.0
		points.append(center + Vector2(cos(angle) * radii.x, sin(angle) * radii.y))
	draw_colored_polygon(points, color)
