#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# =========================================================
# BRAIN — Portfolio : génération des visuels web + manifeste
# Source : ASSET/REALISATIONS/*.jpg (originaux conservés)
# Sortie  : ASSET/REALISATIONS/web/*.webp|.avif (+ miniatures)
#           js/realisations-data.js (catalogue exploité par le slider)
# Usage   : python tools/build-portfolio.py
# =========================================================
import os
import re
import json
import datetime

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "ASSET", "REALISATIONS")
OUT_DIR = os.path.join(SRC_DIR, "web")
MANIFEST = os.path.join(ROOT, "js", "realisations-data.js")

MAIN_WIDTH = 1920
THUMB_WIDTH = 480
WEBP_QUALITY = 80
THUMB_WEBP_QUALITY = 72
AVIF_QUALITY = 55
THUMB_AVIF_QUALITY = 48

CATEGORY = "Pressbook"

PAGE_RE = re.compile(r"page[-_]?(\d{2,4})", re.IGNORECASE)


def slugify(name):
    base = os.path.splitext(os.path.basename(name))[0]
    base = base.lower()
    base = re.sub(r"[àâä]", "a", base)
    base = re.sub(r"[éèêë]", "e", base)
    base = re.sub(r"[îï]", "i", base)
    base = re.sub(r"[ôö]", "o", base)
    base = re.sub(r"[ûü]", "u", base)
    base = re.sub(r"[ç]", "c", base)
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    base = re.sub(r"-{2,}", "-", base)
    return base


def resized(img, width):
    if img.width <= width:
        return img.copy()
    ratio = width / float(img.width)
    height = int(round(img.height * ratio))
    return img.resize((width, height), Image.LANCZOS)


def save_variants(img, stem):
    """Retourne un dict des fichiers réellement produits (clés: src/avif/thumb/thumbAvif)."""
    out = {}
    main = resized(img, MAIN_WIDTH)
    thumb = resized(img, THUMB_WIDTH)

    webp_main = os.path.join(OUT_DIR, stem + ".webp")
    main.save(webp_main, "WEBP", quality=WEBP_QUALITY, method=6)
    out["src"] = "ASSET/REALISATIONS/web/" + stem + ".webp"

    webp_thumb = os.path.join(OUT_DIR, stem + "-thumb.webp")
    thumb.save(webp_thumb, "WEBP", quality=THUMB_WEBP_QUALITY, method=6)
    out["thumb"] = "ASSET/REALISATIONS/web/" + stem + "-thumb.webp"

    try:
        avif_main = os.path.join(OUT_DIR, stem + ".avif")
        main.save(avif_main, "AVIF", quality=AVIF_QUALITY)
        out["avif"] = "ASSET/REALISATIONS/web/" + stem + ".avif"
    except Exception as exc:  # AVIF non supporté : on continue en WebP
        print("  [avif ignoré] " + stem + " : " + str(exc))

    try:
        avif_thumb = os.path.join(OUT_DIR, stem + "-thumb.avif")
        thumb.save(avif_thumb, "AVIF", quality=THUMB_AVIF_QUALITY)
        out["thumbAvif"] = "ASSET/REALISATIONS/web/" + stem + "-thumb.avif"
    except Exception as exc:
        print("  [avif ignoré] " + stem + "-thumb : " + str(exc))

    return out, main.width, main.height


def main():
    if not os.path.isdir(SRC_DIR):
        raise SystemExit("Dossier introuvable : " + SRC_DIR)
    os.makedirs(OUT_DIR, exist_ok=True)

    entries = []
    for name in sorted(os.listdir(SRC_DIR)):
        if not name.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        src_path = os.path.join(SRC_DIR, name)
        if not os.path.isfile(src_path):
            continue

        match = PAGE_RE.search(name)
        page = int(match.group(1)) if match else None
        stem = slugify(name)

        img = Image.open(src_path)
        img.load()
        orig_w, orig_h = img.size
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        files, main_w, main_h = save_variants(img, stem)

        page_label = ("%02d" % page) if page is not None else stem[-2:]
        title = "Pressbook BRAIN - Page " + page_label

        full_name = name.replace(" ", "%20")
        entry = {
            "id": stem,
            "page": page,
            "title": title,
            "category": CATEGORY,
            "alt": title + " (visuel de communication réalisé par BRAIN, Abidjan)",
            "src": files.get("src", ""),
            "avif": files.get("avif", ""),
            "thumb": files.get("thumb", ""),
            "thumbAvif": files.get("thumbAvif", ""),
            "full": "ASSET/REALISATIONS/" + full_name,
            "width": main_w,
            "height": main_h,
            "sourceWidth": orig_w,
            "sourceHeight": orig_h,
        }
        entries.append(entry)
        print("  + %-45s p.%s" % (name, page_label))

    entries.sort(key=lambda e: (e["page"] is None, e["page"] or 0, e["id"]))

    payload = {
        "generatedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "category": CATEGORY,
        "count": len(entries),
        "items": entries,
    }

    banner = (
        "/* =========================================================\n"
        "   BRAIN - Catalogue REALISATIONS (auto-genere)\n"
        "   Genere par tools/build-portfolio.py - ne pas editer a la main.\n"
        "   Images affichees : ASSET/REALISATIONS/web/ (originaux conserves)\n"
        "   ========================================================= */\n"
    )
    with open(MANIFEST, "w", encoding="ascii", errors="ignore") as handle:
        handle.write(banner)
        handle.write("window.BRAIN_REALISATIONS = ")
        handle.write(json.dumps(payload, ensure_ascii=True, indent=2))
        handle.write(";\n")

    print("")
    print("Visuels : " + str(len(entries)) + " page(s) traitées -> " + OUT_DIR)
    print("Manifeste : " + MANIFEST)


if __name__ == "__main__":
    main()
