"""Prepara la carpeta _site: copia la web y genera manifest.json
con la lista de archivos de cada sección. Lo ejecuta GitHub Actions
automáticamente en cada cambio; no hace falta ejecutarlo a mano."""

import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_site")

SECTIONS = ["diapositivas", "organizacion", "recursos", "prompts"]
EXCLUDE_TOP = {".git", ".github", "scripts", "_site", "README.md", ".gitignore"}
SKIP_NAMES = {".gitkeep", ".DS_Store", "Thumbs.db", "desktop.ini"}
# Archivos propios de la web (solo en la raíz de cada sección)
SKIP_AT_SECTION_ROOT = {"index.html", "enlaces.md", "prompts.md"}


def ignore(dirpath, names):
    if os.path.abspath(dirpath) == ROOT:
        return [n for n in names if n in EXCLUDE_TOP]
    return []


def list_files(section):
    base = os.path.join(ROOT, section)
    files = []
    if not os.path.isdir(base):
        return files
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name in SKIP_NAMES or name.startswith("."):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), base).replace(os.sep, "/")
            if rel in SKIP_AT_SECTION_ROOT:
                continue
            files.append(rel)
    return sorted(files, key=str.lower)


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(ROOT, OUT, ignore=ignore)
    manifest = {section: list_files(section) for section in SECTIONS}
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    total = sum(len(v) for v in manifest.values())
    print("Web preparada en _site (%d archivos listados)" % total)


if __name__ == "__main__":
    main()
