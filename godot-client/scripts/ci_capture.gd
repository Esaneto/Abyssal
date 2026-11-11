extends SceneTree
## Automated actual-render capture in GitHub Actions with Xvfb (not Godot --headless).
func _initialize() -> void:
	call_deferred("_capture")

func _capture() -> void:
	var scene: PackedScene = load("res://scenes/main.tscn")
	var main := scene.instantiate()
	root.add_child(main)
	for i in range(15):
		await process_frame
	_save_screen("cabine-dia.png")
	main.call("_start_sea")
	for i in range(18):
		await process_frame
	_save_screen("mar-aberto-superficie.png")
	var world := main.get_node("ExpedicaoOceanica")
	var diver := world.get_node("Mergulhador")
	var camera := diver.get_node("CameraExploracao")
	camera.position_smoothing_enabled = false
	diver.position = Vector2(4850.0, 970.0)
	for i in range(18):
		await process_frame
	_save_screen("mar-aberto-recife.png")
	diver.position = Vector2(16000.0, 9040.0)
	world.sky_time = 210.0
	for i in range(18):
		await process_frame
	_save_screen("mar-aberto-profundezas.png")
	main.call("_unhandled_input", _escape_event())
	for i in range(8):
		await process_frame
	_save_screen("cabine-noite.png")
	quit(0)

func _escape_event() -> InputEventKey:
	var event := InputEventKey.new()
	event.pressed = true
	event.keycode = KEY_ESCAPE
	return event

func _save_screen(filename: String) -> void:
	var capture_dir := OS.get_environment("GODOT_CAPTURE_DIR")
	if capture_dir.is_empty():
		capture_dir = OS.get_user_data_dir()
	var image := root.get_texture().get_image()
	var result := image.save_png(capture_dir.path_join(filename))
	if result != OK:
		push_error("Nao foi possivel salvar captura: " + filename)
	else:
		print("CAPTURED: " + capture_dir.path_join(filename))
