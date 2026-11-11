extends RefCounted
## Camera-local ecological illustration: marine atmosphere, reef gardens, glowing life.
## Solid scenery is provided by ocean_expedition.gd; this layer never changes hitboxes.
const UI = preload("res://scripts/ui_art_primitives.gd")
const OriginalArt = preload("res://scripts/cinematic_art.gd")
const SHALE := Color("#143655")
const TEAL := Color("#1bd4e5")
const JADE := Color("#54d2a2")
const PINK := Color("#dd64c4")
const AMBER := Color("#ffc46b")

static func atmosphere(c: Node2D, area: Rect2, t: float, solar: float, depth_m: float) -> void:
	# Volumetric hue and a visible three-dimensional water column.
	var surface := clampf(1.0-depth_m/950.0,0.09,1.0)
	var visible := clampf(solar*surface,0.08,1.0)
	var start_x := floorf(area.position.x/400.0)*400.0
	for k in range(7):
		var x := start_x+float(k)*400.0
		var shift := sin(t*0.15+float(k))*39.0
		UI.poly(c,[Vector2(x+shift,area.position.y),Vector2(x+45+shift,area.position.y),
			Vector2(x+270+shift,area.end.y),Vector2(x+64+shift,area.end.y)],
			Color(0.34,0.91,0.97,0.024*visible))
	# Distant rocky terraces, bluer and less detailed than playable geology.
	for layer in range(3):
		var dx := 150.0 + float(layer)*145.0
		var coords := PackedVector2Array()
		var start := floorf(area.position.x/78.0)*78.0-78.0
		for i in range(27):
			var x := start+float(i)*78.0
			var floor_y: float = float(c.call("_seafloor_y",clampf(x,0.0,23980.0)))
			var top := floor_y-dx+sin(x/(155.0+float(layer)*68.0)+float(layer))*66.0
			coords.append(Vector2(x,top))
		coords.append(Vector2(start+2028.0,22000.0))
		coords.append(Vector2(start,22000.0))
		c.draw_colored_polygon(coords,Color(0.06+float(layer)*0.016,0.23,0.37,0.20*surface))
	# Remote drifting shoals; little silhouettes never compete with the foreground.
	var start_cell := int(floor(area.position.x/640.0))
	var first_row := int(floor(area.position.y/510.0))
	for iy in range(first_row-1,first_row+4):
		for ix in range(start_cell-1,start_cell+5):
			var anchor := Vector2(float(ix)*640.0+290.0,float(iy)*510.0+205.0)
			var seafloor: float = float(c.call("_seafloor_y",anchor.x))
			if seafloor-anchor.y<160.0 or anchor.y<90.0:
				continue
			for fish in range(7):
				var p := anchor+Vector2(float(fish)*28.0+sin(t*0.23+fish*0.8)*19.0,
					sin(float(fish)*1.7+float(ix))*22.0)
				if not area.grow(70).has_point(p):
					continue
				_fish(c,p,8.0+float(fish%3)*3.0,Color(0.06,0.27,0.40,0.15+0.12*surface))
	# Sparkling caustics above 200 simulated meters.
	if depth_m<235.0:
		var intensity := clampf(1.0-depth_m/235.0,0.0,1.0)*solar
		for k in range(17):
			var x := floorf(area.position.x/122.0)*122.0+float(k)*122.0
			var y := area.position.y+50.0+float((k*59)%420)
			var wave := sin(t*0.53+float(k)*0.91)*24.0
			c.draw_arc(Vector2(x+wave,y),38.0+float(k%3)*17.0,0.1,2.4,20,
				Color(0.57,1.0,0.97,0.08*intensity),2.0,true)

static func _fish(c: CanvasItem, p: Vector2, size: float, tint: Color) -> void:
	UI.poly(c,[p+Vector2(-size,0),p+Vector2(-size*1.8,-size*0.8),
		p+Vector2(-size*1.8,size*0.8)],tint)
	c.draw_circle(p,size*0.45,tint)

static func reef_stone(c: CanvasItem, points: PackedVector2Array, light: float) -> void:
	# Strata shading is tied to EXACT same outline used by the collision polygon.
	var bounds := Rect2(points[0],Vector2.ZERO)
	for vertex in points:
		bounds=bounds.expand(vertex)
	var palette := PackedColorArray()
	for vertex in points:
		var t := clampf((bounds.end.y-vertex.y)/maxf(1.0,bounds.size.y),0.0,1.0)
		palette.append(Color("#152f4a").lerp(Color("#2d6887"),clampf(0.14+t*0.60+light*0.22,0.0,0.82)))
	var uvs := PackedVector2Array()
	for vertex in points:
		uvs.append((vertex-bounds.position)/Vector2(maxf(1,bounds.size.x),maxf(1,bounds.size.y)))
	c.draw_polygon(points,palette,uvs,OriginalArt.stone_texture())
	# Fine blue rim light follows upper edges; reflected cyan is localized.
	for i in range(points.size()-1):
		var a: Vector2 = points[i]
		var b: Vector2 = points[i+1]
		if b.y-a.y<65.0 and b.y-a.y>-75.0 and b.x-a.x>0:
			c.draw_line(a,b,Color(0.16,0.83,0.97,0.10+light*0.23),2.2,true)

static func gardens(c: Node2D, area: Rect2, t: float) -> void:
	# Biological growth attaches to physical stone, and becomes sparse in darkness.
	var rocks: Array = c.call("get_rocks")
	for rock in rocks:
		var center: Vector2 = rock["pos"]
		var radius: float = float(rock["radius"])
		if not area.grow(radius+90.0).has_point(center):
			continue
		var depth: float = float(c.call("depth_at_y",center.y))
		if depth>360.0:
			if depth>1200.0:
				_glow_polyps(c,center+Vector2(radius*0.2,-radius*0.78),t)
			continue
		for i in range(8):
			var angle := -PI*0.92 + float(i)*PI*0.115
			var foot := center+Vector2(cos(angle),sin(angle))*radius*0.79
			var color := PINK if i%3==0 else JADE if i%3==1 else AMBER
			UI.coral(c,foot,36.0+float((i*17)%48),color,t,foot.x*0.01)
		if depth<150.0:
			UI.crystal(c,center+Vector2(-radius*0.15,-radius*0.91),0.69,Color("#38dcf0"))
	for i in range(26):
		var x := floorf(area.position.x/160.0)*160.0+float(i)*160.0
		var ground: float = float(c.call("_seafloor_y",x))
		if ground<area.position.y-70.0 or ground>area.end.y+40.0:
			continue
		var depth: float = float(c.call("depth_at_y",ground))
		if depth>280.0:
			if int(x/160.0)%5==0:
				_glow_polyps(c,Vector2(x,ground),t)
			continue
		var tint := PINK if int(x/160.0)%3==0 else JADE if int(x/160.0)%3==1 else AMBER
		UI.coral(c,Vector2(x,ground-2),42.0+float((int(x)%7))*9.0,tint,t,x*0.02)
		if int(x/160.0)%4==0:
			UI.crystal(c,Vector2(x+28,ground-1),0.78,Color("#28d2f1"))
		elif int(x/160.0)%4==2:
			_sponges(c,Vector2(x+19,ground),t)

static func structures_gardens(c: Node2D, structures: Array[PackedVector2Array], area: Rect2, t: float) -> void:
	for polygon in structures:
		var bounds := Rect2(polygon[0],Vector2.ZERO)
		for pt in polygon:
			bounds=bounds.expand(pt)
		if not bounds.grow(80).intersects(area):
			continue
		var depth: float = float(c.call("depth_at_y",bounds.get_center().y))
		var light := clampf(1.0-depth/380.0,0.07,0.85)
		reef_stone(c,polygon,light)
		if depth>350.0:
			continue
		for i in range(5):
			var v: Vector2 = polygon[(i*2+1)%polygon.size()]
			if v.y>bounds.position.y+bounds.size.y*0.55:
				continue
			UI.coral(c,v+Vector2(0,-3),34.0+float(i%3)*15.0,
				PINK if i%2==0 else JADE,t,v.x*0.01)
		var top := polygon[1]
		UI.crystal(c,top+Vector2(0,-4),0.85,Color("#31d9f4"))

static func _sponges(c: CanvasItem, p: Vector2, t: float) -> void:
	for j in range(4):
		var x := p.x+float(j-2)*10.0
		var y := p.y-float(j%2)*6.0
		c.draw_line(Vector2(x,p.y),Vector2(x,y-21.0),Color("#d38d48"),7.5,true)
		c.draw_arc(Vector2(x,y-21.0),5.0,PI,TAU,16,Color("#ffcd7a"),3.1,true)

static func _glow_polyps(c: CanvasItem, base: Vector2, t: float) -> void:
	for i in range(5):
		var dx := float(i-2)*9.0
		var top := base+Vector2(dx+sin(t*0.34+i)*3.0,-25.0-float(i%2)*10.0)
		c.draw_line(base+Vector2(dx*0.4,0),top,Color(0.15,0.59,0.61,0.5),2,true)
		c.draw_circle(top,2.4,Color("#b3ffce"))
		c.draw_circle(top,7.0,Color(0.23,0.98,0.79,0.07))

static func foreground(c: CanvasItem, area: Rect2, t: float, depth: float) -> void:
	# Camera-relative parallax edges. These are intentionally out of focus and NON-SOLID.
	# Playable caves, reefs and rock arches continue to have true physics polygons.
	if depth>340.0:
		return
	var x0 := area.position.x
	var y0 := area.position.y
	var x1 := area.end.x
	var y1 := area.end.y
	# Soft blue-black lower corners frame light and emphasize water depth.
	UI.poly(c,[Vector2(x0-30,y1+55),Vector2(x0-30,y1-160),
		Vector2(x0+48,y1-120),Vector2(x0+105,y1-58),Vector2(x0+175,y1+60)],
		Color(0.012,0.08,0.19,0.44))
	UI.poly(c,[Vector2(x1+30,y1+60),Vector2(x1+30,y1-175),
		Vector2(x1-40,y1-125),Vector2(x1-118,y1-46),Vector2(x1-180,y1+60)],
		Color(0.012,0.08,0.19,0.38))
	# Suspended stems in extreme foreground sway independently from the reef plants.
	for side in [0,1]:
		var anchor := x0+55.0 if side==0 else x1-57.0
		for j in range(5):
			var start := Vector2(anchor+float(j-2)*25.0,y1+10.0)
			var tip := start+Vector2(sin(t*0.41+float(j))*24.0,-110.0-float(j%3)*42.0)
			c.draw_line(start,tip,Color(0.04,0.23,0.28,0.37),6.5,true)
			c.draw_line(start+Vector2(1,0),tip,Color(0.19,0.53,0.50,0.17),2.2,true)

static func flashlight(c: CanvasItem, pos: Vector2, facing_right: bool, t: float, depth: float) -> void:
	# Always present but subtle in shallows, brighter and narrower beyond the twilight zone.
	var dir := 1.0 if facing_right else -1.0
	var intensity := 0.022+clampf(depth/720.0,0.0,1.0)*0.043
	var start := pos+Vector2(40.0*dir,-9.0)
	var end := start+Vector2(410.0*dir,0)
	UI.poly(c,[start+Vector2(0,-6),end+Vector2(0,-101),end+Vector2(0,101),start+Vector2(0,8)],
		Color(0.56,0.93,0.99,intensity))
	UI.poly(c,[start+Vector2(0,-3),end+Vector2(0,-37),end+Vector2(0,37),start+Vector2(0,5)],
		Color(0.75,0.97,1.0,intensity*0.55))
	c.draw_circle(start,5.0,Color("#98ffff"))
	c.draw_circle(start,13.0,Color(0.26,0.95,1.0,0.10))
