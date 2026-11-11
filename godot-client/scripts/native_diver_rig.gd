extends Node2D
## Native, editable character presentation.
## This is a reusable visual child of CharacterBody2D; it never affects physics.
## MeshInstance2D preserves high-resolution texture, AnimationPlayer handles
## whole-body float/kick rhythm and CPUParticles2D emits independent bubbles.
## Replacing baked PNG with a layered skeletal rig will not change its interface.
const Anime = preload("res://scripts/anime_diver_art.gd")
const Look = preload("res://scripts/diver_appearance.gd")

var character_mesh: MeshInstance2D
var animation_player: AnimationPlayer
var bubble_emitter: CPUParticles2D
var _material: ShaderMaterial
var _body: String = ""
var _animation: String = ""

func _ready() -> void:
	name = "AnimeCharacterRig"
	character_mesh = MeshInstance2D.new()
	character_mesh.name = "CharacterMesh"
	character_mesh.mesh = Anime.mesh()
	_material = Anime.make_material()
	character_mesh.material = _material
	add_child(character_mesh)
	_create_animation_player()
	_create_bubbles()
	visible = false

func _create_animation_player() -> void:
	animation_player = AnimationPlayer.new()
	animation_player.name = "CharacterAnimations"
	add_child(animation_player)
	animation_player.root_node = NodePath("..")
	var library := AnimationLibrary.new()
	var idle := Animation.new()
	idle.length = 2.8
	idle.loop_mode = Animation.LOOP_LINEAR
	var lift := idle.add_track(Animation.TYPE_VALUE)
	idle.track_set_path(lift, NodePath("CharacterMesh:position"))
	idle.track_insert_key(lift, 0.0, Vector2(0,-1.2))
	idle.track_insert_key(lift, 1.4, Vector2(0,1.2))
	idle.track_insert_key(lift, 2.8, Vector2(0,-1.2))
	var idle_pitch := idle.add_track(Animation.TYPE_VALUE)
	idle.track_set_path(idle_pitch, NodePath("CharacterMesh:rotation"))
	idle.track_insert_key(idle_pitch, 0.0, -0.018)
	idle.track_insert_key(idle_pitch, 1.4, 0.018)
	idle.track_insert_key(idle_pitch, 2.8, -0.018)
	library.add_animation("float", idle)
	var swim := Animation.new()
	swim.length = 1.25
	swim.loop_mode = Animation.LOOP_LINEAR
	var thrust := swim.add_track(Animation.TYPE_VALUE)
	swim.track_set_path(thrust, NodePath("CharacterMesh:position"))
	swim.track_insert_key(thrust, 0.0, Vector2(0,0))
	swim.track_insert_key(thrust, 0.31, Vector2(1.1,-2.0))
	swim.track_insert_key(thrust, 0.62, Vector2(0,0))
	swim.track_insert_key(thrust, 0.94, Vector2(-1.1,1.5))
	swim.track_insert_key(thrust, 1.25, Vector2(0,0))
	var pitch := swim.add_track(Animation.TYPE_VALUE)
	swim.track_set_path(pitch, NodePath("CharacterMesh:rotation"))
	swim.track_insert_key(pitch, 0.0, -0.025)
	swim.track_insert_key(pitch, 0.62, 0.025)
	swim.track_insert_key(pitch, 1.25, -0.025)
	library.add_animation("swim", swim)
	animation_player.add_animation_library("", library)

static func _bubble_texture() -> Texture2D:
	var image := Image.create(24, 24, false, Image.FORMAT_RGBA8)
	for y in range(24):
		for x in range(24):
			var d := Vector2(float(x)-11.5, float(y)-11.5).length()
			var ring := 1.0-smoothstep(1.6, 3.8, absf(d-8.2))
			var shine := 1.0-smoothstep(0.0, 2.8,
				Vector2(float(x)-7.6, float(y)-6.4).length())
			var alpha := clampf(ring*0.48 + shine*0.30, 0.0, 0.86)
			image.set_pixel(x, y, Color(0.69, 0.95, 1.0, alpha))
	return ImageTexture.create_from_image(image)

func _create_bubbles() -> void:
	bubble_emitter = CPUParticles2D.new()
	bubble_emitter.name = "RegulatorBubbles"
	bubble_emitter.texture = _bubble_texture()
	bubble_emitter.amount = 12
	bubble_emitter.lifetime = 2.9
	bubble_emitter.explosiveness = 0.0
	bubble_emitter.direction = Vector2.UP
	bubble_emitter.spread = 14.0
	bubble_emitter.gravity = Vector2.ZERO
	bubble_emitter.initial_velocity_min = 19.0
	bubble_emitter.initial_velocity_max = 34.0
	bubble_emitter.scale_amount_min = 0.18
	bubble_emitter.scale_amount_max = 0.34
	bubble_emitter.color = Color(0.70, 0.94, 1.0, 0.72)
	bubble_emitter.local_coords = false
	bubble_emitter.position = Vector2(68, -31)
	bubble_emitter.emitting = false
	add_child(bubble_emitter)

func update_look(candidate: Dictionary, time_s: float,
	moving: bool, facing_right: bool) -> bool:
	var look := Look.normalize(candidate)
	var body := str(look["body"])
	if body != _body:
		var texture: Texture2D = Anime.texture_for(body)
		if texture == null:
			_body = ""
			visible = false
			bubble_emitter.emitting = false
			return false
		character_mesh.texture = texture
		_body = body
	visible = true
	character_mesh.scale.x = 1.0 if facing_right else -1.0
	bubble_emitter.position.x = 68.0 if facing_right else -68.0
	Anime.update_material(_material, look, time_s, moving)
	var target := "swim" if moving else "float"
	if _animation != target:
		_animation = target
		animation_player.play(target, 0.18)
	bubble_emitter.emitting = true
	return true

func has_visible_character() -> bool:
	return visible and character_mesh.texture != null

func get_animation_name() -> String:
	return _animation
