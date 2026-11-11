extends RefCounted
## Shared visual attachments for both poses of the same saved character.
## SVG layers are authored separately, never a flattened screenshot of the cabin.
const Look = preload("res://scripts/diver_appearance.gd")
const CHAIR = preload("res://assets/art/character/cabin_layer_chair.svg")
const TANK = preload("res://assets/art/character/cabin_layer_tank.svg")
const SUIT = preload("res://assets/art/character/cabin_layer_suit.svg")
const FACE_F = preload("res://assets/art/character/cabin_layer_face_female.svg")
const FACE_M = preload("res://assets/art/character/cabin_layer_face_male.svg")
const HAIR_LONG_BACK = preload("res://assets/art/character/cabin_layer_hair_back_long.svg")
const HAIR_LONG_FRONT = preload("res://assets/art/character/cabin_layer_hair_front_long.svg")
const HAIR_SHORT_BACK = preload("res://assets/art/character/cabin_layer_hair_back_short.svg")
const HAIR_SHORT_FRONT = preload("res://assets/art/character/cabin_layer_hair_front_short.svg")
const HAIR_TIED_BACK = preload("res://assets/art/character/cabin_layer_hair_back_tied.svg")
const HAIR_TIED_FRONT = preload("res://assets/art/character/cabin_layer_hair_front_tied.svg")
const MASK = preload("res://assets/art/character/cabin_layer_mask.svg")
const ARM = preload("res://assets/art/character/cabin_layer_arm.svg")
# Swim hair is more saturated than cabin hair: cabin layers contain copper
# pigment already, while the tiny in-game silhouette needs readable colors.
const SWIM_HAIR := {
	"copper": Color("#db845d"),
	"black": Color("#24334a"),
	"brown": Color("#977050"),
	"silver": Color("#c1dce3")
}


static func _paint_layer(c: CanvasItem, layer: Texture2D, rect: Rect2, tint: Color = Color.WHITE) -> void:
	c.draw_texture_rect(layer,rect,false,tint)

static func _back_hair(style: String) -> Texture2D:
	match style:
		"short": return HAIR_SHORT_BACK
		"tied": return HAIR_TIED_BACK
		_: return HAIR_LONG_BACK

static func _front_hair(style: String) -> Texture2D:
	match style:
		"short": return HAIR_SHORT_FRONT
		"tied": return HAIR_TIED_FRONT
		_: return HAIR_LONG_FRONT

static func draw_cabin(c: CanvasItem, candidate: Dictionary, time_s: float) -> void:
	var look := Look.normalize(candidate)
	var tones := Look.palette(look)
	var breathe := sin(time_s*1.11)*1.7
	var rect := Rect2(-62.0,169.0+breathe,449.0,579.0)
	var hair_tint: Color = tones["hair"]
	var suit_tint: Color = tones["suit"]
	var mask_tint: Color = Color.WHITE if look["mask"]=="aqua" else Color("#ffe0b4")
	# Hair starts behind the seat and suit, while the fringe is in front of the face.
	var sway := sin(time_s*0.74)*2.1 if look["hair"]!="short" else 0.4*sin(time_s)
	_paint_layer(c,_back_hair(str(look["hair"])),Rect2(rect.position + Vector2(sway,0),rect.size),hair_tint)
	_paint_layer(c,CHAIR,rect)
	_paint_layer(c,TANK,rect)
	_paint_layer(c,SUIT,rect,suit_tint)
	_paint_layer(c,FACE_F if look["body"]=="female" else FACE_M,rect)
	_paint_layer(c,_front_hair(str(look["hair"])),Rect2(rect.position + Vector2(sway*0.28,0),rect.size),hair_tint)
	_paint_layer(c,MASK,rect,mask_tint)
	_paint_layer(c,ARM,rect,suit_tint)
	# Luminescent mask rim in the chosen visor palette.
	var visor: Color = tones["visor"]
	var flash := Vector2(242.0+sin(time_s*0.62)*6.0,365.0+breathe)
	c.draw_line(flash,flash+Vector2(27,-5),Color(visor.r,visor.g,visor.b,0.24),2.0,true)
	# Wearable wrist tool: equipment is cosmetic only, never a hidden weapon.
	_draw_cabin_handheld(c,look,tones,time_s)

static func _draw_cabin_handheld(c: CanvasItem, look: Dictionary, tones: Dictionary, t: float) -> void:
	var id := str(look["handheld"])
	if id=="none":
		return
	var p := Vector2(338,410+sin(t*1.11)*1.7)
	var accent: Color = tones["accent"]
	# Projection from the gloved wrist, not a second hand.
	if id=="scanner":
		c.draw_line(p,p+Vector2(25,-12),Color("#1b3049"),10.0,true)
		c.draw_line(p+Vector2(10,-5),p+Vector2(27,-13),accent,3.0,true)
		c.draw_circle(p+Vector2(27,-13),6.0,Color(accent.r,accent.g,accent.b,0.15))
		c.draw_circle(p+Vector2(27,-13),3.0,accent)
	elif id=="cutter":
		c.draw_line(p,p+Vector2(31,-11),Color("#2a3b50"),9.0,true)
		c.draw_line(p+Vector2(16,-5),p+Vector2(33,-12),accent,3.0,true)
		c.draw_line(p+Vector2(33,-12),p+Vector2(45,-15),Color("#dafaff"),2.5,true)

static func draw_swimmer_hair(c: CanvasItem, candidate: Dictionary, t: float, moving: bool, breathe: float) -> void:
	var look := Look.normalize(candidate)
	var tone: Color = SWIM_HAIR[str(look["hair_color"])]
	var phase := t*(1.75 if moving else 0.54)
	var style := str(look["hair"])
	if style=="short":
		c.draw_arc(Vector2(18,-29+breathe),11.0,PI*0.92,PI*1.58,14,
			tone.darkened(0.22),6.5,true)
		c.draw_arc(Vector2(17,-29+breathe),10.0,PI*0.99,PI*1.58,12,
			tone.lightened(0.34),1.8,true)
		return
	# Ribbon-based hair with a tapered outer edge and curved swim motion.
	# Monotonic x positions prevent self-intersection and keep the stream soft.
	var count := 3 if style=="long" else 2
	var length := 83.0 if style=="long" else 44.0
	for k in range(count):
		var upper := PackedVector2Array()
		var lower := PackedVector2Array()
		var highlight := PackedVector2Array()
		var base_y := -33.0+float(k)*3.5+breathe
		for j in range(11):
			var fraction := float(j)/10.0
			var x := 17.0-length*fraction-float(k)*7.0*fraction
			var motion := sin(phase+fraction*3.1+float(k)*0.65)*5.5*fraction*fraction
			var y := base_y-20.0*sin(fraction*PI*0.80)+motion+float(k)*4.5*fraction
			var width := (5.5-fraction*3.6)*(1.0-fraction*0.63)
			upper.append(Vector2(x,y-width))
			lower.append(Vector2(x,y+width))
			highlight.append(Vector2(x,y-width*0.48))
		var contour := PackedVector2Array()
		contour.append_array(upper)
		for j in range(lower.size()-1,-1,-1):
			contour.append(lower[j])
		c.draw_colored_polygon(contour,tone.darkened(float(k%2)*0.09))
		c.draw_polyline(highlight,Color(tone.lightened(0.45),0.72),0.85,true)
	if style=="tied":
		c.draw_circle(Vector2(11,-32+breathe),5.4,Color("#e5ad59"))
		c.draw_circle(Vector2(11,-32+breathe),2.4,Color("#344556"))

static func draw_swimmer_handheld(c: CanvasItem, candidate: Dictionary, breathe: float) -> void:
	var look := Look.normalize(candidate)
	var tones := Look.palette(look)
	var id := str(look["handheld"])
	if id=="none":
		return
	var accent: Color = tones["accent"]
	var start := Vector2(39.0,8.0+breathe)
	var muzzle := Vector2(77.0,7.0+breathe)
	# The equipment only changes the silhouette; no firing mechanics are installed.
	c.draw_line(start,muzzle,Color("#0b2332"),10.0,true)
	c.draw_line(start+Vector2(3,-3),muzzle+Vector2(-5,-3),Color("#42687e"),4.0,true)
	c.draw_line(start+Vector2(10,1),start+Vector2(14,14),Color("#1e4254"),4.0,true)
	if id=="scanner":
		c.draw_line(start+Vector2(15,-4),muzzle+Vector2(-3,-4),accent,2.0,true)
		c.draw_circle(muzzle,4.5,Color("#082d3c"))
		c.draw_circle(muzzle,2.2,accent)
		c.draw_arc(muzzle,9.0,PI*0.83,PI*1.18,12,Color(accent.r,accent.g,accent.b,0.37),1.2,true)
	else:
		c.draw_line(start+Vector2(16,-3),muzzle+Vector2(2,-3),accent,2.4,true)
		c.draw_line(muzzle,muzzle+Vector2(13,0),Color("#b2d6dc"),2.3,true)
		c.draw_circle(muzzle+Vector2(11,0),2.5,accent)
