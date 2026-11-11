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
	# The diver is drawn in world units, always clearly readable at native zoom.
	var flip := 1.0 if is_facing_right else -1.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(flip, 1.0))
	var phase := time_s * (9.0 if is_moving else 3.0)
	var kick := sin(phase) * (10.0 if is_moving else 2.0)
	# Twin fins trail behind a horizontal human silhouette.
	draw_line(Vector2(-23, 4), Vector2(-48, 17 + kick), Color("#24455a"), 13.0, true)
	draw_line(Vector2(-21, 16), Vector2(-49, 28 - kick), Color("#325169"), 12.0, true)
	draw_colored_polygon(PackedVector2Array([
		Vector2(-47, 16 + kick), Vector2(-68, 7 + kick),
		Vector2(-62, 27 + kick), Vector2(-44, 25 + kick)
	]), Color("#142c40"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(-49, 27 - kick), Vector2(-67, 18 - kick),
		Vector2(-61, 37 - kick), Vector2(-43, 36 - kick)
	]), Color("#18384c"))
	# Breathing tank and backpack.
	draw_rect(Rect2(-31, -26, 38, 22), Color("#142f42"))
	draw_rect(Rect2(-27, -24, 27, 18), Color("#537b88"))
	draw_rect(Rect2(-21, -20, 16, 9), Color("#91b0b2"))
	# Torso and harness: no doubled arms.
	draw_colored_polygon(PackedVector2Array([
		Vector2(-26, -18), Vector2(17, -20),
		Vector2(24, 11), Vector2(-27, 18)
	]), Color("#244962"))
	draw_line(Vector2(-17, -16), Vector2(5, 14), Color("#5bd2d4"), 3.0, true)
	draw_line(Vector2(-21, 14), Vector2(22, 13), Color("#142938"), 2.0, true)
	# Forward arm and open hand, never a gun.
	draw_line(Vector2(10, -3), Vector2(32, 11 + sin(phase) * 2), Color("#1e3b4f"), 12.0, true)
	draw_circle(Vector2(32, 11 + sin(phase) * 2), 5.0, Color("#456c78"))
	# Head/mask, breathing pipe and bubbles.
	draw_circle(Vector2(32, -16), 16.0, Color("#132a3a"))
	draw_circle(Vector2(34, -16), 11.0, Color("#b89b89"))
	draw_rect(Rect2(28, -26, 18, 11), Color("#408498"))
	draw_rect(Rect2(31, -24, 12, 5), Color("#9ae8e5"))
	draw_line(Vector2(42, -8), Vector2(50, -3), Color("#a5c5bc"), 3.0)
	draw_line(Vector2(50, -3), Vector2(54, -14), Color("#a5c5bc"), 2.5)
	for k in range(3):
		var rise := fposmod(time_s * (14.0 + k * 4.0) + float(k * 21), 68.0)
		draw_arc(Vector2(57 + sin(time_s * 2.0 + k) * 5, -19 - rise), 2.6 + float(k) * 1.2, 0.0, TAU, 15, Color(0.65, 0.96, 0.98, 0.6), 1.3)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
