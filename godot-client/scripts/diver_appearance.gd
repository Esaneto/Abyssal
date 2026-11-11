extends RefCounted
## Single source of truth for the native diver's visual loadout.
## Deliberately separate from research/loot/power: cosmetics never modify physics.
## Similar to a paper-doll / vanity slot system: pose renderers consume the same IDs.
const SLOT_ORDER := ["body", "hair", "hair_color", "suit", "mask", "handheld"]
const OPTIONS := {
	"body": ["female", "male"],
	"hair": ["long", "short", "tied"],
	"hair_color": ["copper", "black", "brown", "silver"],
	"suit": ["abyss", "tide", "ember"],
	"mask": ["aqua", "amber"],
	"handheld": ["scanner", "cutter", "none"]
}
const LABELS := {
	"body": "CORPO", "hair": "CABELO", "hair_color": "COR DO CABELO",
	"suit": "TRAJE", "mask": "VISEIRA", "handheld": "EQUIPAMENTO"
}
const CHOICE_LABELS := {
	"female": "MERGULHADORA", "male": "MERGULHADOR",
	"long": "SOLTO", "short": "CURTO", "tied": "PRESO",
	"copper": "ACOBREADO", "black": "PRETO", "brown": "CASTANHO",
	"silver": "PRATEADO", "abyss": "ABISSAL", "tide": "MARINHO",
	"ember": "AMBAR", "aqua": "CIANO", "amber": "DOURADO",
	"scanner": "SCANNER", "cutter": "CORTADOR", "none": "SEM FERRAMENTA"
}
const DEFAULT := {
	"body": "female", "hair": "long", "hair_color": "copper",
	"suit": "abyss", "mask": "aqua", "handheld": "scanner"
}
const HAIR_TINTS := {
	"copper": Color("#fff3e5"),
	"black": Color("#38445b"),
	"brown": Color("#936c61"),
	"silver": Color("#d9e1f4")
}
const SUIT_TINTS := {
	"abyss": Color("#f0f5ff"),
	"tide": Color("#96d8d5"),
	"ember": Color("#ffb78f")
}
const SUIT_BASE := {
	"abyss": Color("#213d68"),
	"tide": Color("#16646a"),
	"ember": Color("#68404c")
}
const SUIT_ACCENT := {
	"abyss": Color("#35def0"),
	"tide": Color("#76f4bd"),
	"ember": Color("#f7b45a")
}

static func defaults() -> Dictionary:
	return DEFAULT.duplicate(true)

static func normalize(candidate: Variant) -> Dictionary:
	var result := defaults()
	if candidate is Dictionary:
		for slot in SLOT_ORDER:
			var chosen := str(candidate.get(slot, result[slot]))
			if OPTIONS[slot].has(chosen):
				result[slot] = chosen
	return result

static func next_choice(candidate: Dictionary, slot: String, offset: int = 1) -> Dictionary:
	var updated := normalize(candidate)
	if not OPTIONS.has(slot):
		return updated
	var values: Array = OPTIONS[slot]
	var position: int = values.find(updated[slot])
	updated[slot] = values[posmod(position + offset, values.size())]
	return updated

static func selected(candidate: Dictionary, slot: String) -> String:
	var safe := normalize(candidate)
	return str(safe.get(slot, ""))

static func display_value(slot: String, value: String) -> String:
	return str(CHOICE_LABELS.get(value, value.to_upper()))

static func palette(candidate: Dictionary) -> Dictionary:
	var safe := normalize(candidate)
	return {
		"hair": HAIR_TINTS[safe["hair_color"]],
		"suit": SUIT_TINTS[safe["suit"]],
		"cloth": SUIT_BASE[safe["suit"]],
		"accent": SUIT_ACCENT[safe["suit"]],
		"visor": Color("#57dfff") if safe["mask"] == "aqua" else Color("#ffc976")
	}
