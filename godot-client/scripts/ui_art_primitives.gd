extends RefCounted
## Art primitives shared by the cabin and the sea. No fullscreen screenshots.
## Geometry is drawn per frame; item counts and action state come from game data.
const CYAN := Color("#46e8f2")
const BLUE := Color("#067eaf")
const GOLD := Color("#ffba57")
const WHITE := Color("#e8fbff")
const INK := Color("#030e20")

static func poly(c: CanvasItem, coords: Array, color: Color) -> void:
	c.draw_colored_polygon(PackedVector2Array(coords), color)

static func oval(c: CanvasItem, pos: Vector2, radii: Vector2, color: Color, n: int = 24) -> void:
	var pts := PackedVector2Array()
	for i in range(n):
		var a := TAU * float(i) / float(n)
		pts.append(pos + Vector2(cos(a) * radii.x, sin(a) * radii.y))
	c.draw_colored_polygon(pts, color)

static func caption(c: CanvasItem, txt: String, pos: Vector2, sz: int = 16, color: Color = WHITE, max_w: float = -1.0) -> void:
	c.draw_string(ThemeDB.fallback_font, pos, txt, HORIZONTAL_ALIGNMENT_LEFT, max_w, sz, color)

static func chamfer(rect: Rect2, amount: float = 10.0) -> PackedVector2Array:
	var x := rect.position.x
	var y := rect.position.y
	var w := rect.size.x
	var h := rect.size.y
	var cut := minf(amount, minf(w, h) * 0.28)
	return PackedVector2Array([
		Vector2(x + cut, y), Vector2(x + w - cut, y),
		Vector2(x + w, y + cut), Vector2(x + w, y + h - cut),
		Vector2(x + w - cut, y + h), Vector2(x + cut, y + h),
		Vector2(x, y + h - cut), Vector2(x, y + cut)
	])

static func panel(c: CanvasItem, area: Rect2, selected: bool = false, warm: bool = false) -> void:
	var trim := GOLD if warm else CYAN
	poly(c, Array(chamfer(area.grow(4))), Color(trim.r, trim.g, trim.b, 0.07 if not selected else 0.23))
	poly(c, Array(chamfer(area)), Color("#061728") if not selected else Color("#123547"))
	poly(c, Array(chamfer(area.grow(-2.0))), Color("#081d31") if not selected else Color("#114059"))
	var ring := chamfer(area)
	c.draw_polyline(ring, Color(trim.r, trim.g, trim.b, 0.48 if not selected else 0.93), 1.6, true)
	c.draw_line(area.position + Vector2(15, 3), area.position + Vector2(area.size.x - 20, 3),
		Color(trim.r, trim.g, trim.b, 0.35 if not selected else 0.88), 1.2, true)
	if selected:
		c.draw_line(area.position + Vector2(13, area.size.y - 5),
			area.position + Vector2(area.size.x - 13, area.size.y - 5), trim, 2.3, true)

static func glow_line(c: CanvasItem, a: Vector2, b: Vector2, color: Color, thickness: float = 2.0) -> void:
	c.draw_line(a, b, Color(color.r, color.g, color.b, 0.085), thickness * 6.0, true)
	c.draw_line(a, b, Color(color.r, color.g, color.b, 0.35), thickness * 2.3, true)
	c.draw_line(a, b, color, thickness, true)

static func item(c: CanvasItem, id: String, p: Vector2, scale: float = 1.0) -> void:
	# All icons are independent assets from Godot drawing commands.
	c.draw_set_transform(p, 0.0, Vector2(scale, scale))
	match id:
		"abyssPickaxe":
			poly(c, [Vector2(-23,-10),Vector2(-11,-17),Vector2(19,-10),Vector2(25,-2),Vector2(1,-5)], Color("#c3eff0"))
			poly(c, [Vector2(-13,-12),Vector2(11,-13),Vector2(22,-5),Vector2(-19,-5)], Color("#39dce8"))
			poly(c, [Vector2(-5,-8),Vector2(1,-8),Vector2(13,22),Vector2(7,26)], Color("#8d6848"))
			c.draw_line(Vector2(-4,-6),Vector2(10,21),Color("#ffc875"),2.8,true)
		"emptyCylinder", "oilCylinder", "gasCylinder":
			var fluid := Color("#21c8bd") if id=="gasCylinder" else Color("#5c4d36") if id=="oilCylinder" else Color("#145676")
			poly(c,[Vector2(-11,-19),Vector2(11,-19),Vector2(13,17),Vector2(8,24),Vector2(-8,24),Vector2(-13,17)],Color("#afcad1"))
			c.draw_rect(Rect2(-9,-12,18,30),Color("#103b54"))
			c.draw_rect(Rect2(-7,-1,14,17),fluid)
			c.draw_rect(Rect2(-3,-17,6,32),Color(0.8,1,1,0.24))
			c.draw_rect(Rect2(-7,-23,14,6),Color("#deedf0"))
		"polymetallicNodule","seaMineral","phosphorite","ferromanganeseCrust","hydrothermalSulfide","salvageMetal","deepCrystal":
			var base := Color("#484d69")
			if id=="phosphorite":base=Color("#d6ba8e")
			elif id=="ferromanganeseCrust":base=Color("#414861")
			elif id=="hydrothermalSulfide":base=Color("#a75b39")
			elif id=="deepCrystal":base=Color("#2fcde9")
			elif id=="seaMineral":base=Color("#6e98ab")
			for i in range(5):
				var x := float((i*13)%48)-24.0
				var y := float((i*11)%22)-8.0
				poly(c,[Vector2(x-10,y+6),Vector2(x-8,y-4),Vector2(x,y-10),Vector2(x+10,y-4),Vector2(x+12,y+7),Vector2(x,y+12)],base.darkened(0.10+float(i%3)*0.09))
				poly(c,[Vector2(x-8,y-4),Vector2(x,y-10),Vector2(x+10,y-4),Vector2(x+1,y+1)],base.lightened(0.22))
				if id=="polymetallicNodule":
					c.draw_circle(Vector2(x+2,y-1),2.8,Color("#ffbb5f"))
			if id=="hydrothermalSulfide" or id=="deepCrystal":
				for i in range(3):
					var x := float(i-1)*12.0
					poly(c,[Vector2(x-6,14),Vector2(x-7,-4-float(i%2)*12),Vector2(x,-23-float(i%2)*10),Vector2(x+7,-6),Vector2(x+6,14)],Color("#2ff0fc") if id=="deepCrystal" else Color("#ed7d41"))
		"sonar":
			for i in range(3):
				c.draw_arc(Vector2.ZERO,float(i+1)*8.0,0.0,TAU,28,Color("#30d5e7"),1.2,true)
			c.draw_line(Vector2.ZERO,Vector2(19,-14),CYAN,2,true)
			c.draw_circle(Vector2.ZERO,3.5,GOLD)
		"manta","turtle","fish":
			poly(c,[Vector2(-22,1),Vector2(-8,-9),Vector2(10,-8),Vector2(23,0),Vector2(10,7),Vector2(-8,7)],Color("#65cbd1"))
			poly(c,[Vector2(-20,0),Vector2(-30,-12),Vector2(-30,12)],Color("#2d8fac"))
			c.draw_circle(Vector2(15,-2),2.0,INK)
		_:
			for i in range(4):
				c.draw_line(Vector2(float(i-2)*6,-14),Vector2(float(i-2)*6,16),CYAN,2.0,true)
	c.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

static func coral(c: CanvasItem, foot: Vector2, sz: float, tint: Color, time_s: float, seed: float) -> void:
	# Multi-branch translucent coral that grows from the terrain.
	var wind := sin(time_s*0.37 + seed)*sz*0.05
	for arm in range(5):
		var spread := float(arm-2)*sz*0.22
		var end := foot + Vector2(spread+wind,-sz*(0.65+0.08*float(arm%3)))
		var mid := foot + Vector2(spread*0.35,-sz*0.35)
		c.draw_line(foot,mid,tint.darkened(0.35),maxf(1.5,sz*0.09),true)
		c.draw_line(mid,end,Color(tint.r,tint.g,tint.b,0.10),maxf(3.0,sz*0.22),true)
		c.draw_line(mid,end,tint,maxf(1.3,sz*0.052),true)
		c.draw_line(mid+Vector2(1,-2),end+Vector2(1,-2),
			Color(0.92,1.0,0.92,0.14),maxf(0.7,sz*0.017),true)
		for j in range(2):
			var dir := -1.0 if j==0 else 1.0
			var a := mid.lerp(end,0.35+float(j)*0.24)
			c.draw_line(a,a+Vector2(dir*sz*0.14,-sz*0.24),tint,1.7,true)
		c.draw_circle(end,sz*0.077,Color(tint.r,tint.g,tint.b,0.13))
		c.draw_circle(end,sz*0.033,tint.lightened(0.42))

static func crystal(c: CanvasItem, center: Vector2, scale: float, color: Color) -> void:
	for i in range(5):
		var dx := float(i-2)*10.0*scale
		var ht := (20.0 + float((i*11)%22))*scale
		poly(c,[center+Vector2(dx-7*scale,0),center+Vector2(dx-8*scale,-ht*0.5),
			center+Vector2(dx,-ht),center+Vector2(dx+7*scale,-ht*0.5),
			center+Vector2(dx+9*scale,0)],color.darkened(0.24))
		poly(c,[center+Vector2(dx,-ht),center+Vector2(dx+7*scale,-ht*0.5),
			center+Vector2(dx+9*scale,0),center+Vector2(dx,0)],color)
		c.draw_line(center+Vector2(dx,-ht),center+Vector2(dx,0),Color(0.85,1,1,0.66),1.3,true)
