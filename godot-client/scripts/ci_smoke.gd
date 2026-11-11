extends SceneTree
## Run with: godot --headless --path godot-client --script res://scripts/ci_smoke.gd
func _initialize() -> void:
	call_deferred("_smoke")

func _smoke() -> void:
	var scene: PackedScene = load("res://scenes/main.tscn")
	if scene == null:
		push_error("Cena principal nao carregou")
		quit(2)
		return
	var main := scene.instantiate()
	root.add_child(main)
	await process_frame
	var world := main.get_node_or_null("ExpedicaoOceanica")
	if world == null:
		push_error("Expedicao Oceanica nao foi criada")
		quit(3)
		return
	main.call("_start_sea")
	await physics_frame
	if not world.visible:
		push_error("Mar Aberto nao abriu")
		quit(4)
		return
	var diver := world.get_node_or_null("Mergulhador")
	if diver == null:
		push_error("Mergulhador nativo ausente")
		quit(5)
		return
	var old_y: float = diver.position.y
	Input.action_press("move_down")
	for i in range(35):
		await physics_frame
	Input.action_release("move_down")
	if diver.position.y <= old_y + 10.0:
		push_error("Fisica de mergulho nao respondeu ao controle")
		quit(6)
		return
	var ecology = load("res://scripts/marine_ecology.gd")
	if ecology == null or ecology.SPECIES.size() < 8:
		push_error("Catalogo da fauna ausente ou incompleto")
		quit(7)
		return
	for species in ecology.SPECIES:
		if float(species["length_px"]) < ecology.MIN_LENGTH_PX:
			push_error("Criatura abaixo da escala minima: " + species["id"])
			quit(8)
			return
	main.call("_unhandled_input", InputEventKey.new())
	print("GODOT_SMOKE_PASS: cabine, mar aberto, fisica e escala da fauna")
	quit(0)
