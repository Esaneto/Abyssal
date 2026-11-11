extends RefCounted
## Nine-slot native exploration HUD; no fabricated inventory or online status.
const UI=preload("res://scripts/ui_art_primitives.gd")
const ITEMS=["abyssPickaxe","emptyCylinder","seaMineral","phosphorite",
	"ferromanganeseCrust","polymetallicNodule","hydrothermalSulfide","oilCylinder","gasCylinder"]
const TITLES=["PICARETA","CILINDRO","MINERIO","FOSFORITA","CROSTA","NODULO","SULFETO","PETROLEO","GAS"]

static func paint(c: Node2D, rect: Rect2, diver: CharacterBody2D, progress: RefCounted,
	observed: int, nearest_deposit: Dictionary, extract_time: float, deposit_time: float,
	nearest_species: Dictionary, message: String, show_status: bool, sunlight: float) -> void:
	var x := rect.position.x
	var y := rect.position.y
	var side := x+22.0
	var top := y+15.0
	UI.panel(c,Rect2(side,top,325,61),true)
	UI.item(c,"fish",Vector2(side+31,top+30),0.47)
	UI.caption(c,"A B Y S S A L",Vector2(side+65,top+29),24,Color("#e7fcff"))
	UI.caption(c,"ECOS DAS PROFUNDEZAS",Vector2(side+67,top+49),11,Color("#91e7f4"))
	UI.panel(c,Rect2(side,top+70,325,161))
	UI.caption(c,"EXPLORACAO  /  MAR ABERTO",Vector2(side+15,top+91),14,Color("#9cedf6"))
	UI.caption(c,"PROF.  %.0f m" % diver.depth_m,Vector2(side+18,top+123),23,Color("#f1fcff"))
	UI.caption(c,"PRESSAO  %.1f atm" % (1.0+diver.depth_m/10.0),Vector2(side+18,top+150),16,Color("#b1e8ed"))
	var ratio: float = float(diver.oxygen)/maxf(1.0,float(diver.oxygen_capacity))
	UI.caption(c,"OXIGENIO  %d%%" % int(ratio*100.0),Vector2(side+18,top+179),17,
		Color("#ffb08d") if ratio<0.3 else Color("#83f5e4"))
	c.draw_rect(Rect2(side+18,top+187,286,8),Color("#1d4b60"))
	c.draw_rect(Rect2(side+19,top+188,284*ratio,6),Color("#31dcdd"))
	UI.panel(c,Rect2(side,top+239,325,63))
	UI.caption(c,"VITALIDADE",Vector2(side+16,top+260),15,Color("#e7fcff"))
	UI.caption(c,"%d / %d" % [int(diver.health),int(diver.MAX_HEALTH)],
		Vector2(side+240,top+260),14,Color("#e8f8fc"))
	c.draw_rect(Rect2(side+16,top+271,290,16),Color("#12394b"))
	c.draw_rect(Rect2(side+18,top+273,286*clampf(diver.health/diver.MAX_HEALTH,0,1),12),Color("#45e8e4"))
	if diver.depth_m>diver.safe_depth:
		UI.panel(c,Rect2(side,top+314,382,36),true,true)
		UI.caption(c,"PRESSAO CRITICA  /  RETORNE A SUPERFICIE",Vector2(side+11,top+340),14,Color("#ffd4a8"))
	# Status buttons and session indicator are read-only, not misleading online UI.
	UI.panel(c,Rect2(x+rect.size.x-236,top+8,217,47))
	c.draw_circle(Vector2(x+rect.size.x-213,top+32),4.3,Color("#60dfbe"))
	UI.caption(c,"EXPEDICAO SOLO",Vector2(x+rect.size.x-199,top+38),14,Color("#c8faff"))
	if sunlight>0.2:
		UI.caption(c,"LUZ AMBIENTE",Vector2(x+rect.size.x-222,top+88),13,Color("#97dfea"))
	else:
		UI.caption(c,"ZONA SEM LUZ",Vector2(x+rect.size.x-222,top+88),13,Color("#9ad6de"))
	# Important exploration notices remain near the diver, not over the hotbar.
	var notices := Vector2(x+rect.size.x*0.49,y+rect.size.y*0.42)
	if not nearest_deposit.is_empty():
		UI.panel(c,Rect2(notices.x-210,notices.y,420,41))
		UI.caption(c,"SEGURE G PARA EXTRAIR  |  FERRAMENTA 1 / 2",notices+Vector2(-190,27),15,Color("#ffdda2"))
		if extract_time>0.0:
			c.draw_rect(Rect2(notices.x-188,notices.y+32,376*clampf(extract_time/maxf(0.1,deposit_time),0,1),3),Color("#65edfa"))
	elif not nearest_species.is_empty():
		UI.caption(c,"F  OBSERVAR: "+str(nearest_species.get("name","")),notices+Vector2(-168,21),16,Color("#bdf2ec"))
	if show_status:
		UI.panel(c,Rect2(x+rect.size.x*0.35,y+rect.size.y*0.50,490,38))
		UI.caption(c,message,Vector2(x+rect.size.x*0.35+13,y+rect.size.y*0.50+26),14,Color("#ffe0a2"),463)
	# All nine slots show the real local progress, not a placeholder screenshot.
	var slots := 9
	var slot_w := 62.0
	var gap := 4.0
	var full := float(slots)*slot_w+float(slots-1)*gap+26.0
	var bar_x := x+(rect.size.x-full)*0.5
	var bar_y := y+rect.size.y-103.0
	UI.panel(c,Rect2(bar_x,bar_y,full,84))
	for i in range(slots):
		var left := bar_x+13.0+float(i)*(slot_w+gap)
		var tool: String = str(ITEMS[i])
		var active: bool = i<2 and progress.selected_tool()==tool
		UI.panel(c,Rect2(left,bar_y+10,slot_w,64),active,active)
		UI.item(c,tool,Vector2(left+30,bar_y+37),0.74)
		UI.caption(c,str(i+1),Vector2(left+5,bar_y+21),11,Color("#ebfaff"))
		UI.caption(c,("∞" if i==1 else "x%d" % progress.get_count(tool)),
			Vector2(left+30,bar_y+67),11,Color("#ffdf9c") if active else Color("#c9f4f7"))
	UI.caption(c,"WASD  NADAR     G  EXTRAIR     F  OBSERVAR     I  INVENTARIO     M  CARTA     TAB  DIARIO     ESC  CABINE",
		Vector2(x+rect.size.x*0.15,y+rect.size.y-8),13,Color("#b8ebee"))
