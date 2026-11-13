"""Prepara la carpeta _site: copia la web y genera manifest.json
con la lista de archivos de cada sección. Lo ejecuta GitHub Actions
automáticamente en cada cambio; no hace falta ejecutarlo a mano."""

import json
import os
import shutil
import subprocess
import tempfile

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


# Formatos que el navegador no sabe mostrar: se convierten a PDF para la vista previa
CONVERT_EXT = {".ppt", ".pptx", ".pps", ".ppsx", ".odp", ".doc", ".docx", ".odt", ".rtf", ".xls", ".xlsx", ".ods"}


def make_previews(manifest):
    """Convierte con LibreOffice los archivos de Office a PDF (en _site/_preview/).
    Devuelve {ruta_original: ruta_del_pdf}. Si LibreOffice no está, no pasa nada:
    esos archivos simplemente se podrán descargar sin vista previa."""
    previews = {}
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    todo = [(sec, rel) for sec in SECTIONS for rel in manifest[sec]
            if os.path.splitext(rel)[1].lower() in CONVERT_EXT]
    if not todo:
        return previews
    if not soffice:
        print("Aviso: LibreOffice no está instalado; sin vista previa para PPTX/DOCX/XLSX")
        return previews
    profile = tempfile.mkdtemp(prefix="lo_profile_")
    for sec, rel in todo:
        src = os.path.join(OUT, sec, rel)
        tmp = tempfile.mkdtemp(prefix="lo_out_")
        try:
            subprocess.run(
                [soffice, "-env:UserInstallation=file://" + profile, "--headless",
                 "--convert-to", "pdf", "--outdir", tmp, src],
                check=True, timeout=300, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            pdf = os.path.join(tmp, os.path.splitext(os.path.basename(src))[0] + ".pdf")
            dest_rel = "_preview/%s/%s.pdf" % (sec, rel)
            dest = os.path.join(OUT, dest_rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(pdf, dest)
            previews["%s/%s" % (sec, rel)] = dest_rel
        except Exception as e:  # un archivo problemático no debe romper la publicación
            print("Aviso: no se pudo convertir %s/%s (%s)" % (sec, rel, e))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    shutil.rmtree(profile, ignore_errors=True)
    return previews


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(ROOT, OUT, ignore=ignore)
    manifest = {section: list_files(section) for section in SECTIONS}
    manifest["_previews"] = make_previews(manifest)
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    total = sum(len(manifest[sec]) for sec in SECTIONS)
    print("Web preparada en _site (%d archivos listados)" % total)


if __name__ == "__main__":
    main()
