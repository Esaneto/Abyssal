"""Guard against duplicated enemy artwork and corrupt atlas ZIPs."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
s = importlib.util.spec_from_file_location("horror_installer", ROOT / "scripts" / "install-horror-atlases.py")
installer = importlib.util.module_from_spec(s)
s.loader.exec_module(installer)

def fixture_webp(tag):
    header = b"VP8X" + (10).to_bytes(4,"little") + bytes([16,0,0,0])
    header += (1679).to_bytes(3,"little") + (1279).to_bytes(3,"little")
    chunk = b"VP8 " + (2200).to_bytes(4,"little") + bytes([tag & 255])*2200
    body = b"WEBP" + header + chunk
    return b"RIFF" + len(body).to_bytes(4,"little") + body

def pack(where,duplicate=False,corrupt=False):
    with ZipFile(where,"w") as z:
        for i,path in enumerate(sorted(installer.REQUIRED)):
            code = 1 if duplicate and i==1 else i+1
            data = fixture_webp(code)
            if corrupt and i==1: data=b"broken"+data
            z.writestr(path,data)
        z.writestr("public/abyssal-horror/manifest.json","{}")
        z.writestr("README.txt","fixture")

class AtlasInstallerTests(unittest.TestCase):
    def test_valid_package(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir);archive=root/"ok.zip";pack(archive)
            installer.install(archive,root)
            manifest=json.loads((root/"public/abyssal-horror/manifest.json").read_text())
            self.assertTrue(manifest["enabled"])
            self.assertEqual(len(manifest["sha256"]),26)
    def test_duplicate_rejected_without_changes(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir);archive=root/"duplicate.zip";pack(archive,duplicate=True)
            with self.assertRaisesRegex(ValueError,"Duplicate creature animation"):
                installer.install(archive,root)
            self.assertFalse((root/"public/abyssal-horror/manifest.json").exists())
    def test_corrupted_atlas_rejected_without_changes(self):
        with tempfile.TemporaryDirectory() as dir:
            root=Path(dir);archive=root/"bad.zip";pack(archive,corrupt=True)
            with self.assertRaises(ValueError):
                installer.install(archive,root)
            self.assertFalse((root/"public/abyssal-horror/manifest.json").exists())

if __name__=="__main__":unittest.main()
