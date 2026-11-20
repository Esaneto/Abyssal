#!/usr/bin/env python3
"""Install the pre-validated Abyssal horror sprite ZIP without touching game logic."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

KINDS = ("drifter","stinger","brute","lurker","whiteShark","boss","angler","maw","leviathan","whiteSharkBoss","kraken","devourer","riftSmile",)
PREFIX = "public/abyssal-horror/"
REQUIRED = {f"{PREFIX}{kind}/{mode}.webp" for kind in KINDS for mode in ("swim", "attack")}

def check_webp(blob):
    if len(blob) < 30 or blob[:4] != b"RIFF" or blob[8:16] != b"WEBPVP8X":
        raise ValueError("Expected WebP VP8X atlas")
    if int.from_bytes(blob[4:8], "little") + 8 != len(blob):
        raise ValueError("WebP RIFF size mismatch")
    if int.from_bytes(blob[16:20], "little") != 10 or not blob[20] & 16:
        raise ValueError("Invalid VP8X RGBA header")
    width = 1 + int.from_bytes(blob[24:27], "little")
    height = 1 + int.from_bytes(blob[27:30], "little")
    if (width, height) != (1680, 1280):
        raise ValueError(f"Wrong atlas size: {width}x{height}")

def install(archive, root):
    with ZipFile(archive) as zf:
        names = zf.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate filenames in ZIP")
        if set(names) != REQUIRED | {f"{PREFIX}manifest.json", "README.txt"}:
            raise ValueError("Unexpected or missing atlas files")
        payloads = {}
        hashes = {}
        for name in sorted(REQUIRED):
            info = zf.getinfo(name)
            if info.file_size < 2000 or info.file_size > 3000000:
                raise ValueError(f"Invalid atlas size: {name}")
            if ((info.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError("ZIP symlinks are not allowed")
            blob = zf.read(name)
            check_webp(blob)
            payloads[name] = blob
            hashes[name[len(PREFIX):]] = hashlib.sha256(blob).hexdigest()
        # Write only when every single file has passed validation.
        for name, blob in payloads.items():
            dest = root / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(blob)
        manifest = {"version":1,"enabled":True,"columns":4,"rows":4,
                    "frameWidth":420,"frameHeight":320,"creatures":list(KINDS),
                    "formats":["webp"],"sha256":hashes}
        (root / PREFIX / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        print(json.dumps({"installed":len(payloads),"species":len(KINDS),
                          "total_bytes":sum(len(b) for b in payloads.values())}))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--archive",type=Path,required=True)
    p.add_argument("--root",type=Path,default=Path("."))
    args = p.parse_args()
    install(args.archive,args.root)
