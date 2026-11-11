extends RefCounted
## In-world wardrobe UI. The diver preview is the SAME cabin avatar behind this panel.
const Look = preload("res://scripts/diver_appearance.gd")
const UI = preload("res://scripts/ui_art_primitives.gd")
const PANEL := Rect2(430.0,155.0,785.0,449.0)
const CLOSE := Rect2(1135.0,170.0,55.0,37.0)

static func row_rect(i: int) -> Rect2:
	return Rect2(474.0,245.0+float(i)*51.0,694.0,45.0)

static func hit(point: Vector2) -> Dictionary:
	if CLOSE.has_point(point):
		return {"close":true}
	for i in range(Look.SLOT_ORDER.size()):
		var r := row_rect(i)
		if r.has_point(point):
			var change := 0
			if point.x>=1090.0:
				change=1
			elif point.x>=1024.0 and point.x<=1066.0:
				change=-1
			return {"row":i,"delta":change}
	return {}

static func paint(c: CanvasItem, candidate: Dictionary, selected_row: int) -> void:
	var look := Look.normalize(candidate)
	c.draw_rect(Rect2(427,152,789,454),Color(0.0,0.006,0.023,0.49))
	UI.panel(c,PANEL,true)
	UI.caption(c,"PERSONALIZACAO DO MERGULHADOR",Vector2(466,194),24,Color("#ebfcff"))
	UI.caption(c,"CORPO + ITENS VISUAIS  |  EFEITO APENAS COSMETICO",Vector2(467,216),13,Color("#91e4f3"))
	UI.panel(c,CLOSE)
	UI.caption(c,"X",Vector2(1154,196),19,Color("#f9d18b"))
	for i in range(Look.SLOT_ORDER.size()):
		var slot: String = str(Look.SLOT_ORDER[i])
		var value: String = str(look[slot])
		var row := row_rect(i)
		var active := selected_row==i
		UI.panel(c,row,active,false)
		UI.caption(c,str(Look.LABELS[slot]),Vector2(row.position.x+17,row.position.y+28),15,
			Color("#f5e9ce") if active else Color("#b6e4eb"))
		# Small dye chip makes the visual layer's current tint immediately obvious.
		var palette: Dictionary = Look.palette(look)
		var chip := Color("#2c8797")
		match slot:
			"hair", "hair_color": chip = palette["hair"]
			"suit": chip = palette["cloth"]
			"mask": chip = palette["visor"]
			"handheld": chip = palette["accent"]
			"body": chip = Color("#7fe6e7") if value=="female" else Color("#f1b774")
		c.draw_circle(Vector2(793,row.position.y+23),9.0,Color(chip.r,chip.g,chip.b,0.18))
		c.draw_circle(Vector2(793,row.position.y+23),5.3,chip)
		UI.caption(c,Look.display_value(slot,value),Vector2(811,row.position.y+28),15,
			Color("#ffdc90") if active else Color("#d7f9fd"))
		UI.caption(c,"<",Vector2(1035,row.position.y+29),21,Color("#8dd6eb"))
		UI.caption(c,">",Vector2(1120,row.position.y+29),21,Color("#8dd6eb"))
		c.draw_line(Vector2(1013,row.position.y+6),Vector2(1013,row.end.y-6),
			Color("#317b99"),1.0,true)
	UI.caption(c,"FEMININO / MASCULINO SEM ALTERAR ATRIBUTOS, HITBOX OU PROGRESSO",
		Vector2(481,577),13,Color("#a6d9e1"),700)
	UI.caption(c,"C OU ESC: FECHAR    SETAS: ESCOLHER E TROCAR    CLIQUE: EDITAR",
		Vector2(474,596),13,Color("#ffc982"),700)
