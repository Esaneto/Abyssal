extends RefCounted
## Licensed artwork: generated original ABYSSAL anime-realistic diver PNGs.
## A single artwork is shared by every view: swim + submarine. No flattened HUD.
## Source assets are copied separately into assets/art/characters by the installer.
const FEMALE_PATH := "res://assets/art/characters/anime_diver_female.png"
const MALE_PATH := "res://assets/art/characters/anime_diver_male.png"
const EFFECT := preload("res://shaders/anime_diver_swim.gdshader")

const IMAGE_WIDTH := 1448.0
const IMAGE_HEIGHT := 1086.0
const SWIM_WIDTH := 274.0
const SWIM_HEIGHT := SWIM_WIDTH * IMAGE_HEIGHT / IMAGE_WIDTH
const COLS := 36
const ROWS := 28

static var _textures: Dictionary = {}
static var _mesh: ArrayMesh

static func source_path(body: String) -> String:
	return MALE_PATH if body == "male" else FEMALE_PATH

static func texture_for(body: String) -> Texture2D:
	var id := "male" if body == "male" else "female"
	if _textures.has(id):
		return _textures[id] as Texture2D
	var path := source_path(id)
	if not FileAccess.file_exists(path):
		# Fallback to the existing procedural artist, enabling CI and legacy users
		# to run the branch without installing the high-resolution artwork yet.
		return null
	var img: Image = Image.load_from_file(path)
	if img == null or img.is_empty():
		return null
	img.generate_mipmaps()
	var texture := ImageTexture.create_from_image(img)
	_textures[id] = texture
	return texture

static func has_art(candidate: Dictionary) -> bool:
	return texture_for(str(candidate.get("body", "female"))) != null

static func mesh() -> ArrayMesh:
	if _mesh != null:
		return _mesh
	var vertices := PackedVector3Array()
	var uv := PackedVector2Array()
	var indices := PackedInt32Array()
	for y in range(ROWS + 1):
		for x in range(COLS + 1):
			var u := float(x) / float(COLS)
			var v := float(y) / float(ROWS)
			vertices.append(Vector3((u - 0.53) * SWIM_WIDTH,
				(v - 0.55) * SWIM_HEIGHT, 0.0))
			uv.append(Vector2(u, v))
	for y in range(ROWS):
		for x in range(COLS):
			var a := y * (COLS + 1) + x
			var b := a + 1
			var c := a + COLS + 1
			var d := c + 1
			indices.append_array(PackedInt32Array([a, b, c, b, d, c]))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_TEX_UV] = uv
	arrays[Mesh.ARRAY_INDEX] = indices
	_mesh = ArrayMesh.new()
	_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return _mesh

static func make_material() -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = EFFECT
	return material

static func update_material(material: ShaderMaterial, candidate: Dictionary,
	time_s: float, moving: bool) -> void:
	var body := str(candidate.get("body", "female"))
	var hair := str(candidate.get("hair", "long"))
	material.set_shader_parameter("swim_time", time_s)
	material.set_shader_parameter("motion", 1.0 if moving else 0.20)
	material.set_shader_parameter("is_female", 1.0 if body == "female" else 0.0)
	material.set_shader_parameter("hair_change", _hair_variation(body,
		str(candidate.get("hair_color", "copper"))))
	material.set_shader_parameter("hair_color", _hair_color(str(candidate.get("hair_color", "copper"))))
	material.set_shader_parameter("suit_color", _suit_color(str(candidate.get("suit", "abyss"))))
	material.set_shader_parameter("suit_mix", 0.0 if candidate.get("suit", "abyss") == "abyss" else 0.38)
	# Hair style and tool variants are reserved for independently cutout rig
	# sprites. Never pretend the baked scanner or hair has been replaced.
	material.set_shader_parameter("detail_glow", 0.25 if moving else 0.15)

static func _hair_variation(body: String, color: String) -> float:
	if body == "male" and color == "black":
		return 0.0
	if body == "female" and color == "copper":
		return 0.0
	return 1.0

static func _hair_color(color: String) -> Color:
	match color:
		"black": return Color("#333e54")
		"silver": return Color("#ccd9e8")
		"brown": return Color("#775344")
		_: return Color("#c87c4c")

static func _suit_color(color: String) -> Color:
	match color:
		"tide": return Color("#4ec9ba")
		"ember": return Color("#edaa6a")
		_: return Color("#3d90f1")

static func draw_swimmer(canvas: CanvasItem, candidate: Dictionary) -> bool:
	var texture := texture_for(str(candidate.get("body", "female")))
	if texture == null:
		return false
	canvas.draw_mesh(mesh(), texture)
	return true

static func draw_cabin(canvas: CanvasItem, candidate: Dictionary,
	time_s: float) -> bool:
	var texture := texture_for(str(candidate.get("body", "female")))
	if texture == null:
		return false
	# An actual cropped portrait of THE SAME swimmer source. The art is live:
	# a subtle breathing translation, separately moving holographic glints and
	# a panel below stay independent of the cockpit, not a screenshot overlay.
	var image_rect := Rect2(645.0, 125.0, 765.0, 665.0)
	var bob := sin(time_s * 1.16) * 2.0
	var dest := Rect2(-71.0, 243.0 + bob, 450.0, 385.0)
	canvas.draw_texture_rect_region(texture, dest, image_rect)
	var glow := Color("#4cebf3")
	canvas.draw_line(Vector2(32.0, 605.0), Vector2(372.0, 605.0),
		Color(glow.r, glow.g, glow.b, 0.33), 1.4, true)
	canvas.draw_line(Vector2(53.0, 611.0), Vector2(346.0, 611.0),
		Color(glow.r, glow.g, glow.b, 0.11), 5.0, true)
	return true
