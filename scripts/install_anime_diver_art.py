#!/usr/bin/env python3
"""Install the original anime-realistic PNGs into an Abyssal Godot checkout.

Usage:
    python scripts/install_anime_diver_art.py /path/to/abyssal_anime_art_originals.zip
    python scripts/install_anime_diver_art.py /path/to/folder_with_the_two_PNGs

The official art pack is supplied separately with the ChatGPT release.
This installer intentionally does not download any external URL or modify game logic.
"""
from __future__ import annotations

import hashlib
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "godot-client" / "assets" / "art" / "characters"
ASSETS = {
    "anime_diver_female.png": "67e69b24fedb2a9907ac275d9b6093cdd149a3beffaec76753a4bbf690220904",
    "anime_diver_male.png": "c5f4203ec28957ff5e96d46bbfa49625f8ca65aabf9b4365bb6d08cf9e6d74b2",
}
ALIASES = {
    "anime_diver_female.png": (
        "anime_diver_female.png",
        "abyssal_diver_female_side_anime_realista.png",
        "a_high_quality_detailed_digital_illustration_ga_1.png",
    ),
    "anime_diver_male.png": (
        "anime_diver_male.png",
        "abyssal_diver_male_side_anime_realista.png",
        "a_high_detail_polished_anime_realistic_game_chara_2.png",
    ),
}


def load_assets(source: Path) -> dict[str, bytes]:
    if source.is_dir():
        files = list(source.rglob("*.png"))
        return {
            target: next((p.read_bytes() for p in files if p.name in aliases), b"")
            for target, aliases in ALIASES.items()
        }
    if not zipfile.is_zipfile(source):
        raise ValueError("Informe a pasta dos PNGs ou o arquivo .zip com os dois personagens.")
    with zipfile.ZipFile(source) as archive:
        files = [n for n in archive.namelist() if n.lower().endswith(".png")]
        return {
            target: next((archive.read(n) for n in files if Path(n).name in aliases), b"")
            for target, aliases in ALIASES.items()
        }


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    source = Path(sys.argv[1]).expanduser()
    if not source.exists():
        print(f"Arquivo ou pasta nao encontrada: {source}")
        return 2
    assets = load_assets(source)
    errors = []
    for name, digest in ASSETS.items():
        data = assets.get(name, b"")
        if not data:
            errors.append(f"Faltando: {name}")
        elif hashlib.sha256(data).hexdigest() != digest:
            errors.append(f"SHA-256 diferente: {name} (use os PNGs originais aprovados)")
        elif not data.startswith(b"\x89PNG\r\n\x1a\n"):
            errors.append(f"Arquivo invalido: {name}")
    if errors:
        for msg in errors:
            print(msg)
        print("Nenhum arquivo foi alterado.")
        return 1
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, data in assets.items():
        p = TARGET / name
        tmp = p.with_suffix(".png.tmp")
        tmp.write_bytes(data)
        tmp.replace(p)
        print(f"Instalado: {p.relative_to(ROOT)} ({len(data):,} bytes)")
    print("Instalacao concluida. Abra godot-client/project.godot no Godot 4.7.2.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
