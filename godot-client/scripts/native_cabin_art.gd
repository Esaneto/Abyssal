extends RefCounted
## Native responsive-looking 1280x720 command-bridge composition.
## No reference screenshot is displayed: every visual is separately drawn and animated.
const UI = preload("res://scripts/ui_art_primitives.gd")
const Doll = preload("res://scripts/diver_paper_doll.gd")
const Anime = preload("res://scripts/anime_diver_art.gd")
const MENU := ["Loja","Laboratório","Mar Aberto","Fossas","Espécimes","Minérios"]
const KEYS := ["salvageMetal","sonar","fish","deepCrystal","turtle","polymetallicNodule"]
const DESCRIPTIONS := [
	"CATALOGO WEB","TECNOLOGIA DE SOBREVIVENCIA","EXPEDICAO DE EXPLORACAO",
	"MODOS DE COMBATE","DIARIO BIOLOGICO","RECURSOS DO OCEANO"
]

static func vertical_nav(i: int) -> Rect2:
	return Rect2(378.0, 257.0 + float(i) * 41.0, 170.0, 35.0)

static func bottom_nav(i: int) -> Rect2:
	return Rect2(360.0 + float(i) * 139.0, 563.0, 131.0, 62.0)

static func click_menu(point: Vector2) -> int:
	# Menu canvas is visually shifted/rescaled to reserve a real seat for the pilot.
	var local := Vector2((point.x-55.0)/0.95,point.y)
	for i in range(MENU.size()):
		if vertical_nav(i).has_point(local) or bottom_nav(i).has_point(local):
			return i
	return -1

static func paint(canvas: Node2D, t: float, selected: int, progress: RefCounted, status: String) -> void:
	_paint_ocean(canvas, t)
	_paint_bridge(canvas, t)
	_paint_console(canvas, t)
	_paint_pilot(canvas, t, progress.appearance_snapshot())
	# Screen shifts to starboard so the pilot remains visible, not hidden.
	canvas.draw_set_transform(Vector2(55.0,0.0),0.0,Vector2(0.95,1.0))
	_paint_monitor(canvas, t, selected, progress)
	canvas.draw_set_transform(Vector2.ZERO,0.0,Vector2.ONE)
	_paint_status(canvas, t, status)

static func _paint_ocean(c: CanvasItem, t: float) -> void:
	var solar := 0.55 + 0.45 * cos(t * TAU / 420.0)
	for i in range(54):
		var ratio := float(i)/53.0
		var col := Color("#073b61").lerp(Color("#16add5"), (1.0-ratio)*solar*0.92)
		col = col.lerp(Color("#082747"), pow(ratio,1.8)*0.55)
		c.draw_rect(Rect2(0,float(i)*11.0,1280,12),col)
	# Ocean surface and slowly swinging rays.
	for i in range(48):
		var x := float(i)*32.0
		c.draw_line(Vector2(x,94+sin(x*0.035+t*0.62)*3.0),Vector2(x+30,95+sin(x*0.035+t*0.62+0.7)*3.0),
			Color(0.48,0.97,0.96,0.42*solar),2.0,true)
	for i in range(13):
		var x := float(i)*135.0-55.0+sin(t*0.14+float(i))*16.0
		UI.poly(c,[Vector2(x,100),Vector2(x+24,100),Vector2(x+230,530),Vector2(x+65,530)],
			Color(0.32,0.91,0.94,0.022*solar))
	# Three layers of rocky distant seafloor. No collision (visible outside the glass).
	for layer in range(3):
		var row := 365.0 + float(layer)*44.0
		var rock := PackedVector2Array()
		for k in range(33):
			var x := float(k)*42.0
			rock.append(Vector2(x,row+35.0*sin(x/110.0+float(layer)*2.0)+11.0*sin(x/26.0+float(layer))))
		rock.append(Vector2(1330,590))
		rock.append(Vector2(0,590))
		c.draw_colored_polygon(rock,Color("#0a3557").lerp(Color("#06203c"),float(layer)*0.24))
	# Convex geological window walls add believable foreground layers.
	# They are window scenery, entirely separate from explorable terrain.
	UI.poly(c,[Vector2(0,190),Vector2(64,222),Vector2(126,283),
		Vector2(175,343),Vector2(142,405),Vector2(226,487),Vector2(0,520)],Color("#0a365e"))
	UI.poly(c,[Vector2(0,224),Vector2(66,248),Vector2(120,303),Vector2(44,330)],
		Color("#1d6484"))
	UI.poly(c,[Vector2(0,380),Vector2(84,346),Vector2(153,405),Vector2(225,487),Vector2(0,487)],
		Color("#123c62"))
	UI.poly(c,[Vector2(1280,196),Vector2(1230,224),Vector2(1193,291),
		Vector2(1153,341),Vector2(1201,410),Vector2(1112,491),Vector2(1280,520)],Color("#0a355b"))
	UI.poly(c,[Vector2(1280,223),Vector2(1224,244),Vector2(1181,315),Vector2(1260,331)],
		Color("#236e86"))
	for i in range(10):
		var yy := 225.0+float(i)*27.0
		if i%2==0:
			UI.coral(c,Vector2(45.0+float(i%3)*21.0,yy),23.0+float(i%4)*8.0,
				Color("#ec69b3") if i%3==0 else Color("#ffb45e"),t,float(i))
		else:
			UI.coral(c,Vector2(1240.0-float(i%3)*18.0,yy),24.0+float(i%4)*9.0,
				Color("#e174c8") if i%3==0 else Color("#77df9a"),t,float(i)*0.8)
	UI.crystal(c,Vector2(75,429),0.95,Color("#54edff"))
	UI.crystal(c,Vector2(1209,431),1.1,Color("#4ff3ef"))
	# Shimmering sea turtles pass outside the central panoramic glass.
	for i in range(3):
		_turtle(c,Vector2(592.0+float(i)*106.0+sin(t*0.11+i)*17.0,
			154.0+float(i%2)*37.0),0.8+float(i%3)*0.17,t+float(i))
	# Brilliant decorative reef at both window edges.
	for side in [0,1]:
		var origin := 80.0 if side==0 else 1120.0
		for j in range(11):
			var xx := origin + float(j-5)*24.0
			var yy := 456.0+sin(float(j)*1.3)*28.0
			var tone := Color("#e250a4") if j%3==0 else Color("#eaa85e") if j%3==1 else Color("#8ce7b1")
			UI.coral(c,Vector2(xx,yy),26.0+float(j%4)*10.0,tone,t,float(j)*1.2)
		UI.crystal(c,Vector2(origin+50.0,456.0),1.1,Color("#49dff2"))
	# Whale and distant biological silhouettes through the panoramic windows.
	_whale(c,Vector2(1040.0+sin(t*0.055)*20.0,202.0+sin(t*0.13)*8.0),0.95)
	for i in range(19):
		var x := 260.0 + float(i%7)*27.0+sin(t*0.12+float(i))*12.0
		var y := 178.0+float(i/7)*17.0+sin(float(i))*9.0
		_fish(c,Vector2(x,y),0.9+float(i%3)*0.15,Color(0.04,0.20,0.37,0.74))
	for i in range(5):
		var xx := 80.0+float(i%3)*60.0 if i%2==0 else 1180.0+float(i%3)*30.0
		var yy := 175.0+float(i)*48.0+sin(t*0.25+float(i))*14.0
		_jelly(c,Vector2(xx,yy),t+float(i)*2.0)
	for i in range(34):
		var x := fposmod(float(i*237+33),1280.0)
		var y := fposmod(float(i*79+91)-t*(5.0+float(i%4)*2.0),430.0)+95.0
		c.draw_arc(Vector2(x,y),2.0+float(i%3),0,TAU,12,Color(0.63,0.97,0.99,0.35),1.0,true)

static func _fish(c: CanvasItem, p: Vector2, scale: float, tint: Color) -> void:
	UI.poly(c,[p+Vector2(-18,-1)*scale,p+Vector2(-30,-9)*scale,p+Vector2(-28,9)*scale],tint)
	UI.oval(c,p,Vector2(18,7)*scale,tint,18)
	c.draw_circle(p+Vector2(11,-2)*scale,1.2,tint.lightened(0.4))

static func _whale(c: CanvasItem, p: Vector2, scale: float) -> void:
	c.draw_set_transform(p,0.0,Vector2(scale,scale))
	UI.poly(c,[Vector2(-88,-9),Vector2(-47,-24),Vector2(11,-23),Vector2(53,-13),
		Vector2(81,-4),Vector2(88,1),Vector2(65,16),Vector2(7,31),Vector2(-45,20),
		Vector2(-71,6)],Color("#135376"))
	UI.poly(c,[Vector2(63,-5),Vector2(110,-28),Vector2(102,1),Vector2(113,20),Vector2(66,14)],Color("#0a355a"))
	UI.poly(c,[Vector2(-2,19),Vector2(35,43),Vector2(20,11)],Color("#0b4269"))
	UI.poly(c,[Vector2(8,-20),Vector2(-2,-48),Vector2(39,-20)],Color("#115076"))
	c.draw_line(Vector2(-67,4),Vector2(31,19),Color(0.40,0.76,0.85,0.34),1.5,true)
	c.draw_circle(Vector2(-65,-3),2.0,Color("#86cdd6"))
	c.draw_set_transform(Vector2.ZERO,0,Vector2.ONE)

static func _turtle(c: CanvasItem, p: Vector2, scale: float, t: float) -> void:
	c.draw_set_transform(p,0.0,Vector2(scale,scale))
	var flap := sin(t*1.7)*7.0
	UI.poly(c,[Vector2(-16,-5),Vector2(-38,-23-flap),Vector2(-31,-30-flap),
		Vector2(3,-9),Vector2(16,-10),Vector2(33,-26+flap),Vector2(39,-19+flap),
		Vector2(15,5),Vector2(-14,16)],Color("#5dae9c"))
	UI.oval(c,Vector2(-1,0),Vector2(27,19),Color("#4a8a78"))
	UI.oval(c,Vector2(-2,-2),Vector2(23,16),Color("#8ab394"))
	for j in range(4):
		c.draw_arc(Vector2(-15+float(j)*9,-1),8,PI*0.7,PI*1.61,13,Color("#c8e8a4"),1.2,true)
	UI.oval(c,Vector2(29,0),Vector2(12,9),Color("#9ed3ae"))
	c.draw_circle(Vector2(35,-2),1.5,Color("#183b47"))
	c.draw_set_transform(Vector2.ZERO,0.0,Vector2.ONE)

static func _jelly(c: CanvasItem, p: Vector2, t: float) -> void:
	for i in range(5):
		var x := float(i-2)*6.0
		var target := p+Vector2(x+sin(t*0.75+float(i))*6.0,28.0+float(i%2)*14.0)
		c.draw_line(p+Vector2(x,5),target,Color(0.87,0.43,0.92,0.32),1.5,true)
	UI.oval(c,p,Vector2(19.0+sin(t)*2.0,13.0),Color(0.85,0.33,0.87,0.38),22)
	UI.oval(c,p+Vector2(0,-5),Vector2(14,5),Color(0.97,0.78,1.0,0.34),22)

static func _paint_bridge(c: CanvasItem, t: float) -> void:
	# Thick beveled steel hull, kept in front of moving underwater panorama.
	UI.poly(c,[Vector2(0,0),Vector2(1280,0),Vector2(1280,87),Vector2(0,87)],Color("#101c38"))
	for i in range(9):
		var x := float(i)*162.0
		UI.poly(c,[Vector2(x,0),Vector2(x+144,0),Vector2(x+125,47),Vector2(x+19,47)],Color("#253452"))
		c.draw_line(Vector2(x+20,46),Vector2(x+124,46),Color("#536787"),2.0,true)
	# Three structural ribs of the panoramic window.
	for x in [30.0,430.0,850.0,1260.0]:
		c.draw_line(Vector2(x,76),Vector2(x+20,472),Color("#061225"),30.0,true)
		c.draw_line(Vector2(x+6,91),Vector2(x+23,462),Color("#3c517b"),14.0,true)
		c.draw_line(Vector2(x+10,97),Vector2(x+26,447),Color(0.36,0.86,0.97,0.53),2.3,true)
	c.draw_line(Vector2(12,86),Vector2(1264,86),Color("#132d4d"),20,true)
	c.draw_line(Vector2(25,94),Vector2(1251,94),Color("#538bb0"),3.2,true)
	c.draw_line(Vector2(25,469),Vector2(1251,469),Color("#08182d"),24,true)
	c.draw_line(Vector2(25,458),Vector2(1251,458),Color("#4b6488"),4,true)
	# Service lights and orange/yellow contrast along the ceiling.
	for i in range(17):
		var x := 95.0+float(i)*67.0
		c.draw_rect(Rect2(x,57,34,7),Color("#6c4328"))
		c.draw_rect(Rect2(x+3,58,28,4),Color("#ffad4a"))
		c.draw_rect(Rect2(x+8,58,18,2),Color("#fff4b3"))
	for x in [26.0,413.0,831.0,1249.0]:
		for k in range(5):
			var y := 127.0+float(k)*57.0
			c.draw_line(Vector2(x+8,y),Vector2(x+9,y+18),Color("#f2a74c"),3.5,true)
	# Overhead grill and navigation ceiling.
	UI.panel(c,Rect2(474,3,342,49))
	for i in range(22):
		var x := 496.0+float(i%11)*26.0
		var y := 13.0+float(i/11)*17.0
		c.draw_rect(Rect2(x,y,14,7),Color("#dc8648"))
		c.draw_rect(Rect2(x+2,y+1,10,3),Color("#ffe2a1"))

static func _paint_pilot(c: CanvasItem, t: float, appearance: Dictionary) -> void:
	# Shared paper-doll: same validated look used by native swimmer.
	if not Anime.draw_cabin(c,appearance,t):
		Doll.draw_cabin(c,appearance,t)

static func _paint_console(c: CanvasItem, t: float) -> void:
	UI.poly(c,[Vector2(0,467),Vector2(1280,467),Vector2(1280,720),Vector2(0,720)],Color("#142642"))
	UI.poly(c,[Vector2(0,480),Vector2(1280,480),Vector2(1230,558),Vector2(62,558)],Color("#354465"))
	c.draw_line(Vector2(28,479),Vector2(1250,479),Color("#7084a8"),4,true)
	UI.poly(c,[Vector2(0,621),Vector2(1280,621),Vector2(1280,720),Vector2(0,720)],Color("#1b294b"))
	# Metal panel seams and yellow high contrast edges.
	for k in range(12):
		var xx := 28.0+float(k)*113.0
		c.draw_line(Vector2(xx,636),Vector2(xx-37,715),Color("#485b80"),2,true)
		c.draw_line(Vector2(xx+12,644),Vector2(xx+35,644),Color("#eea651"),4,true)
	# Segmented control gaskets and luminous hardware make the deck dimensional.
	for i in range(13):
		var x := 341.0+float(i)*66.0
		UI.poly(c,[Vector2(x,633),Vector2(x+49,633),Vector2(x+59,659),
			Vector2(x-9,659)],Color("#273b62"))
		c.draw_line(Vector2(x,634),Vector2(x+47,634),Color("#5e84a6"),1.8,true)
		if i%3==0:
			c.draw_rect(Rect2(x+12,644,26,6),Color("#e7a255"))
			c.draw_rect(Rect2(x+18,644,14,2),Color("#fff1aa"))
	# Three real console toggles are decorative local devices, not fake action buttons.
	for i in range(3):
		var x := 1089.0+float(i)*39.0
		c.draw_rect(Rect2(x,651,24,11),Color("#0b172c"))
		c.draw_line(Vector2(x+12,654),Vector2(x+9,631-float(i%2)*6),Color("#8d9ab1"),4.0,true)
		c.draw_circle(Vector2(x+9,631-float(i%2)*6),3.2,Color("#efb560"))
	# Sonar console at right, visible beside the central interface.
	UI.panel(c,Rect2(1158,501,110,103))
	for r in [18.0,32.0,44.0]:
		c.draw_arc(Vector2(1214,550),r,0,TAU,42,Color(0.26,0.83,0.88,0.55),1.6,true)
	c.draw_line(Vector2(1214,550),Vector2(1248+sin(t*0.5)*8.0,535),Color("#4ff4fa"),2,true)
	c.draw_circle(Vector2(1229,552),3.0,Color("#ffbf5d"))
	for k in range(4):
		var xx := 1171.0+float(k)*22.0
		c.draw_rect(Rect2(xx,610,10,5),Color("#fab255"))

static func _paint_monitor(c: CanvasItem, t: float, selected: int, progress: RefCounted) -> void:
	# Central touchscreen is a real, functional menu, not baked onto scenery.
	UI.panel(c,Rect2(350,189,801,344),true)
	UI.panel(c,Rect2(362,201,777,321))
	c.draw_rect(Rect2(362,202,777,9),Color("#395276"))
	UI.glow_line(c,Vector2(521,207),Vector2(979,207),Color("#ffb35b"),3.0)
	for i in range(MENU.size()):
		var active := i==selected
		var r := vertical_nav(i)
		UI.panel(c,r,active,active)
		UI.item(c,KEYS[i],r.position+Vector2(18,17),0.34)
		UI.caption(c,MENU[i],r.position+Vector2(40,24),16,Color("#ffdd9c") if active else Color("#c5f5fa"))
	var body := Rect2(565,230,556,276)
	UI.panel(c,body)
	UI.item(c,KEYS[selected],Vector2(605,270),0.93)
	UI.caption(c,MENU[selected],Vector2(643,258),26,Color("#f0faff"))
	UI.caption(c,DESCRIPTIONS[selected],Vector2(645,284),13,Color("#8ad1dd"))
	c.draw_line(Vector2(580,296),Vector2(1108,296),Color(0.17,0.68,0.82,0.6),2,true)
	match selected:
		5:
			var items := ["polymetallicNodule","ferromanganeseCrust","phosphorite","hydrothermalSulfide","oilCylinder","gasCylinder"]
			var labels := ["Nódulo","Crosta","Fosforita","Sulfeto","Petróleo","Gás"]
			for i in range(6):
				var x := 578.0+float(i%3)*178.0
				var y := 309.0+float(i/3)*90.0
				UI.panel(c,Rect2(x,y,170,85))
				UI.item(c,items[i],Vector2(x+39,y+37),0.83)
				UI.caption(c,labels[i],Vector2(x+75,y+35),15,Color("#e5f8f8"))
				UI.caption(c,"x%d" % progress.get_count(items[i]),Vector2(x+75,y+58),14,Color("#ffce78"))
		4:
			UI.caption(c,"ESPECIES REGISTRADAS NO DIARIO",Vector2(589,323),17,Color("#a1f3e9"))
			UI.caption(c,"%d especies observadas" % progress.discovery_count(),Vector2(589,358),21,Color("#ffca7d"))
			UI.caption(c,"Explore e pressione F perto de um animal",Vector2(589,401),15,Color("#d9f2f4"))
		2:
			UI.caption(c,"UMA ODISSEIA PELO OCEANO",Vector2(589,333),21,Color("#b9f8ff"))
			UI.caption(c,"Explore cavernas, descubra especies e minere.",Vector2(589,369),15,Color("#cbebf2"))
			UI.panel(c,Rect2(592,406,485,57),true)
			UI.caption(c,"INICIAR EXPEDICAO  [ENTER]",Vector2(619,441),19,Color("#e7fdff"))
		1:
			UI.caption(c,"PESQUISA E APRIMORAMENTO",Vector2(589,333),20,Color("#b9f8ff"))
			UI.caption(c,"Tecnologias de oxigenio, traje e reconhecimento.",Vector2(589,370),15,Color("#c5edf2"))
			UI.caption(c,"Pressione L para abrir a bancada de pesquisas.",Vector2(589,425),16,Color("#ffc978"))
		0,3:
			UI.caption(c,"DISPONIVEL NO ABYSSAL WEB",Vector2(589,341),20,Color("#b3dce8"))
			UI.caption(c,"Esta funcionalidade nao foi migrada para o Godot.",Vector2(589,377),15,Color("#c5edf2"))
			UI.caption(c,"A exploracao nativa permanece independente.",Vector2(589,423),15,Color("#a1d5dc"))
	# Quick-access controls are real clickable surfaces.
	for i in range(MENU.size()):
		var active := i==selected
		var b := bottom_nav(i)
		UI.panel(c,b,active,active)
		UI.item(c,KEYS[i],b.position+Vector2(65,22),0.53)
		UI.caption(c,MENU[i].to_upper(),b.position+Vector2(11,53),12,
			Color("#ffce72") if active else Color("#dcf5f9"),112)

static func _paint_status(c: CanvasItem, t: float, status: String) -> void:
	UI.panel(c,Rect2(37,9,379,66),true)
	UI.caption(c,"A B Y S S A L",Vector2(115,41),27,Color("#f4fdff"))
	UI.caption(c,"SUBMARINO DE EXPLORACAO",Vector2(118,62),12,Color("#97e6f1"))
	c.draw_line(Vector2(70,37),Vector2(105,37),Color("#31ecf6"),3,true)
	c.draw_arc(Vector2(74,37),17,PI,TAU,20,Color("#56dbe9"),2,true)
	UI.panel(c,Rect2(989,12,265,49))
	UI.caption(c,"SOLO  |  PROGRESSO LOCAL",Vector2(1004,43),15,Color("#c6f7fb"))
	UI.panel(c,Rect2(1074,68,176,44))
	UI.caption(c,"PERSONAGEM [C]",Vector2(1088,96),15,Color("#ffe0a2"))
	c.draw_circle(Vector2(1236,29),4.0,Color("#54e3b4"))
	UI.panel(c,Rect2(207,663,875,37))
	UI.caption(c,status if not status.is_empty() else
		"SISTEMAS LOCAIS  |  PESQUISA OCEANICA  |  ENTER: MERGULHAR  |  L: LABORATORIO",
		Vector2(227,687),15,Color("#98eff1"),831)
