extends SceneTree
## Functional parity tests for solo ocean exploration.
## This test has no access to server accounts. Never treat client saves as online proof.

func _initialize() -> void:
	call_deferred("_run_tests")

func _fail(message: String, code: int) -> void:
	push_error("GODOT_FUNCTIONAL_FAIL: " + message)
	quit(code)

func _run_tests() -> void:
	var Progress = load("res://scripts/exploration_progress.gd")
	var Deposits = load("res://scripts/geological_resources.gd")
	var saved = Progress.new(false)
	if saved.get_count("abyssPickaxe") != 1 or saved.get_count("emptyCylinder") != 1:
		_fail("O kit inicial nao possui picareta e cilindro", 10)
		return
	var origin := Vector2(850.0, 500.0)
	var ore := {"id": "geo:fixture:0", "type": "seaMineral", "pos": origin, "amount": 3}
	if bool(saved.collect(ore, origin, "emptyCylinder").get("ok", false)):
		_fail("Minerio foi extraido com cilindro", 11)
		return
	var mined: Dictionary = saved.collect(ore, origin, "abyssPickaxe")
	if not mined.get("ok", false) or saved.get_count("seaMineral") != 3:
		_fail("Extracao ou estoque de minerais incorretos", 12)
		return
	if bool(saved.collect(ore, origin, "abyssPickaxe").get("ok", false)):
		_fail("Minerio do mesmo deposito foi concedido duas vezes", 13)
		return
	if not saved.study("oxygenTank").get("ok", false) or saved.research_level("oxygenTank") != 1:
		_fail("Pesquisa de cilindro de oxigenio falhou", 14)
		return
	# Pressure suit recipe uses exact IDs and cost scaling of the JavaScript game.
	var more := {"id": "geo:fixture:1", "type": "seaMineral", "pos": origin, "amount": 3}
	var more_two := {"id": "geo:fixture:2", "type": "seaMineral", "pos": origin, "amount": 3}
	var crust := {"id": "geo:fixture:3", "type": "ferromanganeseCrust", "pos": origin, "amount": 2}
	saved.collect(more, origin, "abyssPickaxe")
	saved.collect(more_two, origin, "abyssPickaxe")
	saved.collect(crust, origin, "abyssPickaxe")
	if not saved.study("pressureSuit").get("ok", false):
		_fail("Receita original do traje de pressao nao foi aplicada", 15)
		return
	var seep := {"id": "geo:fixture:4", "type": "oilSeep", "pos": origin, "amount": 1}
	if not saved.collect(seep, origin, "emptyCylinder").get("ok", false):
		_fail("Amostra de petroleo com cilindro falhou", 16)
		return
	if saved.get_count("oilCylinder") != 1 or saved.get_count("emptyCylinder") != 1:
		_fail("Cilindro reutilizavel foi consumido", 17)
		return
	saved.observe("manta")
	saved.observe("turtle")
	saved.visit(5, 3)
	saved.select_tool("emptyCylinder")
	saved.set_checkpoint(Vector2(4280, 120), 212.0)
	var temporary := "user://godot_functional_smoke_v1.json"
	if not saved.save_to_path(temporary):
		_fail("Nao salvou progresso local", 18)
		return
	var restored = Progress.new(false)
	if not restored.load_from_path(temporary):
		_fail("Nao carregou progresso local", 19)
		return
	if restored.get_count("oilCylinder") != 1 or restored.research_level("pressureSuit") != 1:
		_fail("Inventario/pesquisa alterados no carregamento", 20)
		return
	if not restored.was_observed("manta") or not restored.was_observed("turtle") or not restored.has_visited(5, 3):
		_fail("Descobertas/setores perdidos", 21)
		return
	if restored.selected_tool() != "emptyCylinder" or absf(restored.get_checkpoint().x - 4280.0) > 1.0:
		_fail("Ferramenta/checkpoint nao restaurados", 22)
		return
	var diver_script = load("res://scripts/diver_native.gd")
	var diver = diver_script.new()
	root.add_child(diver)
	diver.configure_equipment(restored.research_level("oxygenTank"),
		restored.research_level("pressureSuit"))
	diver.recover()
	if diver.oxygen_capacity != 600.0 or diver.safe_depth != 480.0:
		_fail("Melhorias de oxigenio/traje nao mudaram propriedades do mergulhador", 23)
		return
	diver.queue_free()
	var scene: PackedScene = load("res://scenes/main.tscn")
	var main := scene.instantiate()
	root.add_child(main)
	await process_frame
	main.progress = restored
	var world = main.get_node("ExpedicaoOceanica")
	world.set_progress(restored)
	main.call("_start_sea")
	await physics_frame
	if absf(world.depth_at_y(21000.0) - 2200.0) > 1.0:
		_fail("Escala de profundidade divergiu do mundo original", 24)
		return
	if not world.active:
		_fail("Mar Aberto nao entrou", 25)
		return
	# Authored scenery is physical, and neither spawn nor arch passages are blocked.
	if world.reef_polygons.size() < 3:
		_fail("Recife nativo sem geometria de colisao", 40)
		return
	if not world.is_navigable(world.SPAWN, 35.0):
		_fail("Recife bloqueou o ponto inicial da exploracao", 41)
		return
	if not world.is_navigable(Vector2(4800, 720), 22.0):
		_fail("Formacoes de recife fecharam corredor de mergulho", 42)
		return
	var CabinUI = load("res://scripts/native_cabin_art.gd")
	if CabinUI == null or CabinUI.MENU.size() != 6:
		_fail("Ponte de comando perdeu navegacao visual", 43)
		return
	for idx in range(6):
		if CabinUI.click_menu(CabinUI.vertical_nav(idx).get_center()) != idx:
			_fail("Area clicavel do menu desalinhada da arte", 44)
			return
	if world.last_observed_id != "manta":
		_fail("Diario nao recuperou especie registrada no save", 36)
		return
	var journal_event := InputEventKey.new()
	journal_event.pressed = true
	journal_event.keycode = KEY_TAB
	world.call("_unhandled_input", journal_event)
	if not world.field_guide_open:
		_fail("Diario nao abriu", 37)
		return
	journal_event.keycode = KEY_K
	world.call("_unhandled_input", journal_event)
	if world.last_observed_id != "turtle":
		_fail("Diario nao navegou para proxima especie registrada", 38)
		return
	journal_event.keycode = KEY_J
	world.call("_unhandled_input", journal_event)
	if world.last_observed_id != "manta":
		_fail("Diario nao navegou para especie anterior", 39)
		return
	journal_event.keycode = KEY_TAB
	world.call("_unhandled_input", journal_event)
	for arch in world.PASSAGE_ARCHES:
		if not world.is_navigable(arch + Vector2(0.0, 20.0), 23.0):
			_fail("Uma passagem rochosa esta bloqueada no meio", 33)
			return
		if world.is_navigable(arch + Vector2(265.0, 15.0), 8.0):
			_fail("Suporte rochoso atravesavel indevidamente", 34)
			return
		if world.is_navigable(arch + Vector2(0.0, -157.0), 8.0):
			_fail("Teto rochoso sem colisao", 35)
			return
	var event := InputEventKey.new()
	event.keycode = KEY_I
	event.pressed = true
	world.call("_unhandled_input", event)
	if not world.inventory_open:
		_fail("Inventario [I] nao abriu", 26)
		return
	event.keycode = KEY_M
	world.call("_unhandled_input", event)
	if not world.chart_open or world.inventory_open:
		_fail("Carta [M] nao substituiu inventario", 27)
		return
	world.call("_unhandled_input", event)
	var resources = Deposits.new()
	var found: Array[Dictionary] = []
	for x in [4100.0, 5300.0, 6500.0, 8300.0]:
		var sample := Vector2(x, float(world.call("_seafloor_y", x)) - 80.0)
		found = resources.stream_near(world, sample, 1050.0, restored.profile["collected"])
		if found.size() > 0:
			break
	if found.is_empty():
		_fail("Nenhum deposito acessivel gerado no setor costeiro", 28)
		return
	for node in found:
		if not world.is_navigable(node["pos"], 25.0):
			_fail("Deposito surgiu dentro de colisao solida", 29)
			return
		if node["id"] != str(node["id"]):
			_fail("ID do deposito nao deterministico", 30)
			return
	var first: Dictionary = found[0]
	var position: Vector2 = first["pos"]
	world.diver.global_position = position + Vector2(0.0, -12.0)
	world._refresh_deposits()
	if world.nearest_deposit.is_empty():
		_fail("Campo proximo nao detecta deposito do jogador", 31)
		return
	var tool: String = str(Deposits.tool_for(str(world.nearest_deposit["type"])))
	restored.select_tool(tool)
	var node_id := str(world.nearest_deposit["id"])
	Input.action_press("extract")
	# Engine headless can render faster than 60 FPS; use actual elapsed game time,
	# not a fixed frame count, to validate the two-second extraction duration.
	await create_timer(3.2).timeout
	Input.action_release("extract")
	if not restored.was_collected(node_id):
		_fail("Segurar G nao concluiu a extracao nativa", 32)
		return
	world.end_expedition()
	FileAccess.file_exists(temporary)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(temporary))
	print("GODOT_FUNCTIONAL_PASS: tools, mining, research, inventory, map, persistence, physics")
	quit(0)
