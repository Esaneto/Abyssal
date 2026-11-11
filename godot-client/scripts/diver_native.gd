extends CharacterBody2D
## Explorador nativo: movimento submarino continuo, sem combate.
## Colisoes Godot, nado com aceleracao/arrasto, flutuabilidade e correntes.
signal diver_died

const MAX_OXYGEN := 300.0
const MAX_HEALTH := 100.0
const MAX_SPEED := 245.0
const SWIM_ACCELERATION := 620.0
const WATER_DRAG := 2.5
const BUOYANCY := 28.0
const SURFACE_Y := 75.0

var oxygen_capacity := MAX_OXYGEN
var safe_depth := 300.0
var oxygen := MAX_OXYGEN
var time_without_air := 0.0
var health := MAX_HEALTH
var swim_force := Vector2.ZERO
var current_force := Vector2.ZERO
var time_s := 0.0
var depth_m := 0.0
var is_moving := false
var is_facing_right := true

func _ready() -> void:
	collision_layer = 1
	collision_mask = 2
	var collision := CollisionShape2D.new()
	var shape := CapsuleShape2D.new()
	shape.radius = 17.0
	shape.height = 91.0
	collision.shape = shape
	collision.rotation = PI / 2.0
	add_child(collision)
	queue_redraw()

func _physics_process(delta: float) -> void:
	time_s += delta
	var steering := Vector2(
		Input.get_axis("move_left", "move_right"),
		Input.get_axis("move_up", "move_down")
	).normalized()
	is_moving = steering.length_squared() > 0.02
	if absf(steering.x) > 0.1:
		is_facing_right = steering.x > 0.0
	depth_m = clampf((global_position.y - SURFACE_Y) / (21000.0 - SURFACE_Y), 0.0, 1.0) * 2200.0
	# Slow depth-dependent currents. The character does not move by teleport.
	current_force = Vector2(
		21.0 * sin(global_position.y * 0.0025 + time_s * 0.18),
		7.0 * cos(global_position.x * 0.0009 + time_s * 0.15)
	)
	swim_force = steering * SWIM_ACCELERATION + Vector2.UP * BUOYANCY + current_force
	velocity += swim_force * delta
	velocity *= exp(-WATER_DRAG * delta)
	velocity = velocity.limit_length(MAX_SPEED)
	move_and_slide()
	global_position.x = clampf(global_position.x, 60.0, 23940.0)
	if global_position.y <= SURFACE_Y:
		global_position.y = SURFACE_Y
		velocity.y = maxf(velocity.y, 0.0)
	if global_position.y >= 20940.0:
		global_position.y = 20940.0
		velocity.y = minf(velocity.y, 0.0)
	if global_position.y <= SURFACE_Y + 7.0:
		oxygen = minf(oxygen_capacity, oxygen + oxygen_capacity * 0.65 * delta)
	else:
		oxygen = maxf(0.0, oxygen - delta)
	if oxygen <= 0.0:
		time_without_air += delta
		health = maxf(0.0, health - minf(160.0, 9.0 + time_without_air * 3.0) * delta)
	else:
		time_without_air = 0.0
	# Mirrors JS pressureSafety formula; these are game rules, not dive medicine.
	if depth_m > safe_depth:
		var excess := depth_m - safe_depth
		var pressure_hazard := minf(160.0, 3.0 * pow(excess / 10.0, 1.55))
		health = maxf(0.0, health - pressure_hazard * delta)
	if health <= 0.0:
		diver_died.emit()
	queue_redraw()

func configure_equipment(oxygen_level: int, suit_level: int) -> void:
	oxygen_capacity = MAX_OXYGEN * (1.0 + float(clampi(oxygen_level, 0, 5)))
	safe_depth = 300.0 + float(clampi(suit_level, 0, 5)) * 180.0
	oxygen = minf(oxygen, oxygen_capacity)

func recover() -> void:
	oxygen = oxygen_capacity
	health = MAX_HEALTH
	time_without_air = 0.0
	velocity = Vector2.ZERO

func _draw() -> void:
	# Side-view expedition diver: anatomy, layered neoprene, steel tanks and flexible fins.
	# Every part is anchored to this CharacterBody2D; physics and hitbox remain unchanged.
	var flip := 1.0 if is_facing_right else -1.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(flip, 1.0))
	var phase := time_s * (8.4 if is_moving else 2.0)
	var kick := sin(phase) * (9.5 if is_moving else 2.2)
	var breathe := sin(time_s * 1.55) * 1.2
	var deep := clampf(depth_m / 900.0, 0.0, 1.0)
	var suit := Color("#203e4e").lerp(Color("#102432"), deep * 0.55)
	var seam := Color("#6f9a9d").lerp(Color("#315565"), deep * 0.6)
	# Rear leg and articulated boot, then its flexible blade.
	draw_line(Vector2(-18, 9), Vector2(-40, 21 - kick), Color("#0e2938"), 15.0, true)
	draw_line(Vector2(-40, 21 - kick), Vector2(-55, 21 - kick * 1.2), Color("#284b5e"), 12.0, true)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-53, 14 - kick * 1.2), Vector2(-71, 7 - kick * 1.4),
		Vector2(-75, 12 - kick * 1.4), Vector2(-70, 31 - kick * 1.2),
		Vector2(-53, 28 - kick * 1.2)
	]), Color("#173a4d"))
	draw_line(Vector2(-68, 12 - kick), Vector2(-62, 26 - kick), Color("#42687c"), 1.3, true)
	# Diving tank: rounded metal vessel with edge reflection and regulator mount.
	draw_colored_polygon(PackedVector2Array([
		Vector2(-31, -29), Vector2(-17, -35), Vector2(7, -34),
		Vector2(12, -21), Vector2(6, -7), Vector2(-29, -6)
	]), Color("#0b1c2c"))
	draw_rect(Rect2(-28, -29, 34, 22), Color("#597884"))
	draw_rect(Rect2(-22, -28, 5, 20), Color("#a4c0c2"))
	draw_line(Vector2(-30, -23), Vector2(9, -23), Color("#152b38"), 4.0, true)
	draw_line(Vector2(-29, -12), Vector2(9, -12), Color("#172a38"), 4.0, true)
	draw_circle(Vector2(-13, -34), 5.0, Color("#142c3a"))
	draw_circle(Vector2(-13, -34), 2.0, Color("#b8986a"))
	# Main wetsuit uses three geometric light planes instead of flat uniform fill.
	draw_colored_polygon(PackedVector2Array([
		Vector2(-29, -17), Vector2(-11, -21), Vector2(16, -17),
		Vector2(23, -3), Vector2(11, 18), Vector2(-23, 19),
		Vector2(-33, 7)
	]), Color("#0e2837"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(-22, -15), Vector2(-1, -18), Vector2(15, -14),
		Vector2(15, 5), Vector2(-3, 14), Vector2(-22, 10)
	]), suit)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-14, -13), Vector2(6, -13), Vector2(14, 2),
		Vector2(-7, 7)
	]), Color("#356175"))
	draw_line(Vector2(-25, -16), Vector2(-14, 13), seam, 1.8, true)
	draw_line(Vector2(-8, -19), Vector2(5, 16), Color("#102735"), 4.0, true)
	draw_line(Vector2(-12, 15), Vector2(13, 14), Color("#63838b"), 2.0, true)
	# Strap buckle and subtle life-support diode.
	draw_rect(Rect2(-5, -4, 9, 7), Color("#132c38"))
	draw_rect(Rect2(-3, -2, 5, 3), Color("#e5ae71"))
	draw_circle(Vector2(-21, -2), 2.1, Color("#75d9d0"))
	# Near leg kicks in opposition; the dark hip joint stays connected.
	draw_line(Vector2(-21, 9), Vector2(-39, 24 + kick), Color("#163848"), 14.0, true)
	draw_line(Vector2(-39, 24 + kick), Vector2(-54, 27 + kick * 1.1), Color("#41667b"), 12.0, true)
	draw_line(Vector2(-34, 20 + kick), Vector2(-47, 27 + kick), Color("#789ba4"), 2.0, true)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-53, 21 + kick * 1.1), Vector2(-68, 15 + kick * 1.2),
		Vector2(-76, 17 + kick * 1.2), Vector2(-72, 38 + kick * 1.1),
		Vector2(-55, 36 + kick * 1.1)
	]), Color("#1b3f51"))
	draw_line(Vector2(-70, 20 + kick), Vector2(-65, 33 + kick), Color("#5b8495"), 1.5, true)
	# One far forearm underneath the torso and one near forearm ahead.
	draw_line(Vector2(7, 11), Vector2(20, 17 + breathe), Color("#0c2533"), 10.0, true)
	draw_line(Vector2(20, 17 + breathe), Vector2(28, 12 + breathe), Color("#2b4c5d"), 8.0, true)
	draw_line(Vector2(11, -8), Vector2(27, 4 + breathe), Color("#193d50"), 12.0, true)
	draw_line(Vector2(27, 4 + breathe), Vector2(40, 7 + breathe), Color("#3b6274"), 10.0, true)
	draw_circle(Vector2(40, 7 + breathe), 5.0, Color("#345365"))
	# Regulator hose curls from the cylinder to the lower mask.
	draw_arc(Vector2(15, -14), 24.0, PI * 1.11, PI * 1.95, 16, Color("#0b2531"), 4.5, true)
	# Helmet, mask, shadowed skin and rim lighting.
	draw_circle(Vector2(33, -17 + breathe), 19.5, Color("#0b2331"))
	draw_circle(Vector2(34, -18 + breathe), 16.0, Color("#476c78"))
	draw_circle(Vector2(35, -19 + breathe), 12.8, Color("#ae9782"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(28, -31 + breathe), Vector2(46, -29 + breathe),
		Vector2(51, -20 + breathe), Vector2(47, -15 + breathe),
		Vector2(28, -17 + breathe)
	]), Color("#072b3b"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(30, -29 + breathe), Vector2(43, -28 + breathe),
		Vector2(46, -24 + breathe), Vector2(33, -24 + breathe)
	]), Color(0.58, 0.91, 0.89, 0.58))
	draw_arc(Vector2(33, -17 + breathe), 18.0, PI * 0.95, PI * 1.85, 18, Color("#88b9bb"), 2.6, true)
	draw_circle(Vector2(46, -12 + breathe), 5.0, Color("#122a35"))
	draw_line(Vector2(47, -12 + breathe), Vector2(56, -7 + breathe), Color("#4d7d85"), 3.4, true)
	# Tiny respirator bubbles rise only near the actual regulator.
	for k in range(3):
		var rise := fposmod(time_s * (12.0 + float(k) * 3.0) + float(k) * 25.0, 67.0)
		var p := Vector2(57.0 + sin(time_s * 1.6 + float(k)) * 4.0, -14.0 - rise)
		draw_arc(p, 2.2 + float(k) * 0.7, 0, TAU, 12, Color(0.60, 0.93, 0.92, 0.45), 1.0, true)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
