extends RefCounted
## Native OFFLINE expedition persistence. Never submit these values as online rewards.
## Item IDs and selected research recipes mirror public/abyssal-exploration-config.js.
const SAVE_FILE := "user://abyssal_native_exploration_v1.json"
const Appearance = preload("res://scripts/diver_appearance.gd")
const MAX_STACK := 1000000
const RESOURCE_NAMES := {
	"abyssPickaxe": "Picareta abissal",
	"emptyCylinder": "Cilindro de amostra",
	"seaMineral": "Minerio submarino",
	"phosphorite": "Fosforita",
	"ferromanganeseCrust": "Crosta ferromanganesifera",
	"polymetallicNodule": "Nodulo polimetalico",
	"hydrothermalSulfide": "Sulfeto hidrotermal",
	"oilSeep": "Exsudacao de petroleo",
	"gasSeep": "Exsudacao de gas",
	"oilCylinder": "Amostra de petroleo",
	"gasCylinder": "Amostra de gas",
	"salvageMetal": "Metal recuperado",
	"deepCrystal": "Cristal profundo"
}
const RESEARCH := {
	"oxygenTank": {
		"label": "Cilindro de autonomia", "max": 5, "cost": {"seaMineral": 3}, "requires": [],
		"detail": "Amplia a reserva de oxigenio por nivel."
	},
	"pressureSuit": {
		"label": "Traje de profundidade", "max": 5,
		"cost": {"seaMineral": 4, "ferromanganeseCrust": 2}, "requires": [],
		"detail": "Aumenta o limite operacional em 180 m por nivel."
	},
	"helmetLamp": {
		"label": "Lanterna do capacete", "max": 3,
		"cost": {"seaMineral": 5, "phosphorite": 3, "ferromanganeseCrust": 2}, "requires": [],
		"detail": "Expande a area iluminada na escuridao."
	},
	"salvageTool": {
		"label": "Ferramenta de salvamento", "max": 1,
		"cost": {"seaMineral": 2}, "requires": [],
		"detail": "Desbloqueia futuras tarefas de salvamento."
	},
	"sampler": {
		"label": "Coletor biologico", "max": 1,
		"cost": {"seaMineral": 2}, "requires": [],
		"detail": "Desbloqueia a pesquisa de sonar avancado."
	},
	"sonar": {
		"label": "Sonar de exploracao", "max": 3,
		"cost": {"ferromanganeseCrust": 2, "phosphorite": 1}, "requires": ["sampler"],
		"detail": "Amplia a area de cobertura do sonar."
	}
}
const SHOP_ORDER := ["oxygenTank", "pressureSuit", "helmetLamp", "salvageTool", "sampler", "sonar"]
const TOOL_IDS := ["abyssPickaxe", "emptyCylinder"]
var profile: Dictionary = {}
var _auto_save: bool = true

func _init(auto_save: bool = true) -> void:
	_auto_save = auto_save
	_reset_defaults()
	if _auto_save:
		load_from_path(SAVE_FILE)
	_ensure_starter_kit()

func _reset_defaults() -> void:
	profile = {
		"version": 1,
		"starter_granted": false,
		"inventory": {},
		"research": {},
		"collected": {},
		"observed": {},
		"visited": {},
		"selected_tool": "abyssPickaxe",
		"appearance": Appearance.defaults(),
		"last_position": [4150.0, 720.0],
		"day_seconds": 0.0
	}

func _ensure_starter_kit() -> void:
	var inventory: Dictionary = profile.get("inventory", {})
	if not bool(profile.get("starter_granted", false)):
		inventory["abyssPickaxe"] = maxi(1, int(inventory.get("abyssPickaxe", 0)))
		inventory["emptyCylinder"] = maxi(1, int(inventory.get("emptyCylinder", 0)))
		profile["starter_granted"] = true
		profile["inventory"] = inventory
		_save()
	elif int(inventory.get("emptyCylinder", 0)) < 1:
		inventory["emptyCylinder"] = 1
		profile["inventory"] = inventory
		_save()

func save_to_path(path: String) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_warning("Nao foi possivel abrir arquivo de progresso: " + path)
		return false
	file.store_string(JSON.stringify(profile, "\t"))
	file.close()
	return true

func load_from_path(path: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if not parsed is Dictionary:
		return false
	var input_data: Dictionary = parsed
	if int(input_data.get("version", 0)) != 1:
		return false
	var inventory: Dictionary = input_data.get("inventory", {}) if input_data.get("inventory", {}) is Dictionary else {}
	var levels: Dictionary = input_data.get("research", {}) if input_data.get("research", {}) is Dictionary else {}
	var collected: Dictionary = input_data.get("collected", {}) if input_data.get("collected", {}) is Dictionary else {}
	var observed: Dictionary = input_data.get("observed", {}) if input_data.get("observed", {}) is Dictionary else {}
	var visited: Dictionary = input_data.get("visited", {}) if input_data.get("visited", {}) is Dictionary else {}
	_reset_defaults()
	profile["starter_granted"] = bool(input_data.get("starter_granted", false))
	profile["inventory"] = {}
	for key in inventory.keys():
		if RESOURCE_NAMES.has(key):
			profile["inventory"][key] = clampi(int(inventory[key]), 0, MAX_STACK)
	profile["research"] = {}
	for key in levels.keys():
		if RESEARCH.has(key):
			profile["research"][key] = clampi(int(levels[key]), 0, int(RESEARCH[key]["max"]))
	# Bounded journals prevent a tampered save from expanding memory endlessly.
	profile["collected"] = {}
	for key in collected.keys().slice(0, 10000):
		if str(key).begins_with("geo:") and bool(collected[key]):
			profile["collected"][key] = true
	profile["observed"] = {}
	for key in observed.keys().slice(0, 1000):
		if bool(observed[key]):
			profile["observed"][key] = true
	profile["visited"] = {}
	for key in visited.keys().slice(0, 4000):
		if bool(visited[key]):
			profile["visited"][key] = true
	var selected := str(input_data.get("selected_tool", "abyssPickaxe"))
	profile["selected_tool"] = selected if TOOL_IDS.has(selected) else "abyssPickaxe"
	# Backward-compatible with all existing v1 saved games; never trust raw IDs.
	profile["appearance"] = Appearance.normalize(input_data.get("appearance", {}))
	var pos: Variant = input_data.get("last_position", [])
	if pos is Array and pos.size() >= 2:
		profile["last_position"] = [clampf(float(pos[0]), 70.0, 23900.0), clampf(float(pos[1]), 75.0, 20900.0)]
	profile["day_seconds"] = fposmod(maxf(0.0, float(input_data.get("day_seconds", 0.0))), 420.0)
	_ensure_starter_kit()
	return true

func _save() -> void:
	if _auto_save:
		save_to_path(SAVE_FILE)

## Cosmetic data never grants stat upgrades, loot or online rewards.
func appearance_snapshot() -> Dictionary:
	return Appearance.normalize(profile.get("appearance", {}))

func set_appearance(candidate: Dictionary) -> void:
	profile["appearance"] = Appearance.normalize(candidate)
	_save()

func cycle_appearance(slot: String, offset: int = 1) -> bool:
	if not Appearance.OPTIONS.has(slot):
		return false
	profile["appearance"] = Appearance.next_choice(appearance_snapshot(), slot, offset)
	_save()
	return true

func get_count(item_id: String) -> int:
	var inventory: Dictionary = profile["inventory"]
	return int(inventory.get(item_id, 0))

func inventory_snapshot() -> Dictionary:
	return (profile["inventory"] as Dictionary).duplicate(true)

func research_level(research_id: String) -> int:
	var levels: Dictionary = profile["research"]
	return int(levels.get(research_id, 0))

func research_cost(research_id: String) -> Dictionary:
	if not RESEARCH.has(research_id):
		return {}
	var def: Dictionary = RESEARCH[research_id]
	var level := research_level(research_id)
	var cost: Dictionary = {}
	for item_id in def["cost"].keys():
		cost[item_id] = int(def["cost"][item_id]) * (1 + level)
	return cost

func study_status(research_id: String) -> String:
	if not RESEARCH.has(research_id):
		return "Pesquisa desconhecida"
	var def: Dictionary = RESEARCH[research_id]
	if research_level(research_id) >= int(def["max"]):
		return "CONCLUIDO"
	for prerequisite in def["requires"]:
		if research_level(str(prerequisite)) < 1:
			return "REQUER " + str(RESEARCH[prerequisite]["label"])
	var cost: Dictionary = research_cost(research_id)
	for resource in cost.keys():
		if get_count(str(resource)) < int(cost[resource]):
			return "FALTAM RECURSOS"
	return "DISPONIVEL"

func study(research_id: String) -> Dictionary:
	var status := study_status(research_id)
	if status != "DISPONIVEL":
		return {"ok": false, "reason": status}
	var levels: Dictionary = profile["research"]
	var inventory: Dictionary = profile["inventory"]
	for resource in research_cost(research_id).keys():
		inventory[resource] = int(inventory.get(resource, 0)) - int(research_cost(research_id)[resource])
	levels[research_id] = research_level(research_id) + 1
	_save()
	return {"ok": true, "id": research_id, "level": research_level(research_id)}

func select_tool(tool_id: String) -> bool:
	if not TOOL_IDS.has(tool_id) or get_count(tool_id) < 1:
		return false
	profile["selected_tool"] = tool_id
	_save()
	return true

func selected_tool() -> String:
	return str(profile.get("selected_tool", "abyssPickaxe"))

func collect(node: Dictionary, player_position: Vector2, selected: String) -> Dictionary:
	# Solo only, but still enforce distance, tool, item type and one-time collection.
	var node_id := str(node.get("id", ""))
	var kind := str(node.get("type", ""))
	if not node_id.begins_with("geo:") or not RESOURCE_NAMES.has(kind):
		return {"ok": false, "reason": "Deposito invalido"}
	if not node.has("pos") or not node["pos"] is Vector2:
		return {"ok": false, "reason": "Posicao invalida"}
	var position: Vector2 = node["pos"]
	if player_position.distance_to(position) > 125.0:
		return {"ok": false, "reason": "Aproxime-se do deposito"}
	if (profile["collected"] as Dictionary).has(node_id):
		return {"ok": false, "reason": "Deposito esgotado"}
	var tool := "emptyCylinder" if kind == "oilSeep" or kind == "gasSeep" else "abyssPickaxe"
	if get_count(tool) < 1:
		return {"ok": false, "reason": "Ferramenta necessaria"}
	if selected != tool:
		return {"ok": false, "reason": "Equipe " + str(RESOURCE_NAMES[tool])}
	var output := kind
	if kind == "oilSeep":
		output = "oilCylinder"
	elif kind == "gasSeep":
		output = "gasCylinder"
	var amount := 1 if tool == "emptyCylinder" else clampi(int(node.get("amount", 1)), 1, 3)
	var inventory: Dictionary = profile["inventory"]
	if int(inventory.get(output, 0)) > MAX_STACK - amount:
		return {"ok": false, "reason": "Inventario cheio"}
	inventory[output] = int(inventory.get(output, 0)) + amount
	(profile["collected"] as Dictionary)[node_id] = true
	_save()
	return {"ok": true, "item": output, "amount": amount}

func was_collected(node_id: String) -> bool:
	return bool((profile["collected"] as Dictionary).get(node_id, false))

func observe(species_id: String) -> bool:
	if species_id.is_empty() or (profile["observed"] as Dictionary).has(species_id):
		return false
	(profile["observed"] as Dictionary)[species_id] = true
	_save()
	return true

func was_observed(species_id: String) -> bool:
	return bool((profile["observed"] as Dictionary).get(species_id, false))

func discovery_count() -> int:
	return (profile["observed"] as Dictionary).size()

func visit(cx: int, cy: int) -> void:
	var sector_id := str(cx) + ":" + str(cy)
	if not (profile["visited"] as Dictionary).has(sector_id):
		(profile["visited"] as Dictionary)[sector_id] = true
		_save()

func has_visited(cx: int, cy: int) -> bool:
	return (profile["visited"] as Dictionary).has(str(cx) + ":" + str(cy))

func set_checkpoint(position: Vector2, sky_time: float) -> void:
	profile["last_position"] = [clampf(position.x, 70.0, 23900.0), clampf(position.y, 75.0, 20900.0)]
	profile["day_seconds"] = fposmod(maxf(0.0, sky_time), 420.0)
	_save()

func get_checkpoint() -> Vector2:
	var position: Array = profile["last_position"]
	return Vector2(float(position[0]), float(position[1]))

func sun_time() -> float:
	return float(profile.get("day_seconds", 0.0))
