#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BRAIN — Visuels de contrôle ASSET/BLOG.

Genère un visuel graphique de remplacement (1200x630 / 1200x675) pour
chaque visuel IA attendu dans ASSET/BLOG/, avec le nom de fichier exact
et le titre de l'article. Ces images ne sont QUE des substituts de
contrôle : elles doivent être remplacées par les visuels IA générés
depuis ASSET/prompts-images-blog.md (personnages africains noirs, peau
noire naturelle, traits africains authentiques).

Usage : python tools/generer-placeholders.py
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "ASSET" / "BLOG"

FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"
FONT_REG = "C:/Windows/Fonts/arial.ttf"
FONT_MONO = "C:/Windows/Fonts/consola.ttf"

NAVY_A = (12, 18, 32)
NAVY_B = (22, 33, 62)
WHITE = (246, 247, 250)
GREY = (164, 176, 201)
ORANGE = (246, 139, 31)
ACCENTS = [(246, 139, 31), (62, 123, 255), (20, 184, 166), (139, 92, 246)]

IMAGES = [
    ("cout-site-web-cote-divoire.jpg", "Combien coûte la création d'un site web en Côte d'Ivoire ?", "principale"),
    ("devis-site-web-abidjan.jpg", "Scène de devis et de cotation", "secondaire"),
    ("ecommerce-ivoirien.jpg", "Équipe e-commerce au travail", "secondaire"),
    ("digitaliser-pme-cote-divoire.jpg", "Comment digitaliser une PME en Côte d'Ivoire ?", "principale"),
    ("audit-processus-pme.jpg", "Audit des processus d'entreprise", "secondaire"),
    ("formation-digitale-equipe.jpg", "Formation de l'équipe aux outils digitaux", "secondaire"),
    ("seo-local-abidjan.jpg", "Référencement local à Abidjan : être trouvé sur Google", "principale"),
    ("recherche-google-ivoire.jpg", "Recherche locale sur mobile", "secondaire"),
    ("community-management-abidjan.jpg", "Community management en Côte d'Ivoire", "principale"),
    ("tournage-contenu-tiktok.jpg", "Tournage de contenus réseaux sociaux", "secondaire"),
    ("branding-marque-ivoirienne.jpg", "Branding : bâtir une marque forte", "principale"),
    ("identite-visuelle-pratique.jpg", "Identité visuelle en pratique", "secondaire"),
    ("mobile-money-ivoire.jpg", "Mobile money, Wave & Orange Money", "principale"),
    ("paiement-ecommerce-mobile.jpg", "Panier e-commerce et paiement mobile", "secondaire"),
    ("film-publicitaire-cote-divoire.jpg", "Films publicitaires pour votre marque", "principale"),
    ("montage-postproduction.jpg", "Post-production et montage", "secondaire"),
]

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(w, h, c1, c2):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        col = lerp(c1, c2, y / h)
        for x in range(w):
            px[x, y] = col
    return img

def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def render(name, title, kind, index):
    w, h = (1200, 630) if kind == "principale" else (1200, 675)
    accent = ACCENTS[index % len(ACCENTS)]

    base = gradient(w, h, NAVY_A, NAVY_B)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    lw = 90 if kind == "principale" else 70
    od.ellipse([-220, -220, 260, 260], outline=accent + (70,), width=lw)
    od.ellipse([w - 300, h - 220, w + 120, h + 200], outline=accent + (55,), width=lw)
    od.ellipse([w - 640, -160, w - 300, 180], outline=(62, 123, 255) + (38,), width=40)
    img = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(img)

    f_logo = font(FONT_BOLD, 42)
    f_sub = font(FONT_REG, 22)
    f_title = font(FONT_BOLD, 62 if kind == "principale" else 56)
    f_info = font(FONT_REG, 21)
    f_file = font(FONT_MONO, 20)

    # En-tête BRAIN
    d.text((48, 42), "BRAIN.", font=f_logo, fill=WHITE)
    d.text((48 + d.textlength("BRAIN.", font=f_logo) + 12, 50), "Communication digitale & audiovisuelle", font=f_sub, fill=GREY)
    d.text((w - 48, 46), "Abidjan · Côte d'Ivoire", font=f_sub, fill=GREY, anchor="ra")

    # Titre centré
    lines = wrap(d, title, f_title, w - 260)
    lh_title = f_title.size + 18
    y = (h // 2) - (len(lines) * lh_title // 2) + 10
    for ln in lines:
        tw = d.textlength(ln, font=f_title)
        d.text(((w - tw) / 2, y), ln, font=f_title, fill=WHITE)
        y += lh_title

    # Pied : mention de contrôle
    m = len(IMAGES)
    d.text((48, h - 96), "VISUEL DE CONTRÔLE — à remplacer par l'image IA du prompt associé.", font=f_info, fill=accent)
    d.text((48, h - 62), "Personnages : Africains noirs, peau noire naturelle (cf. AGENTS.md + ASSET/prompts-images-blog.md).", font=f_info, fill=GREY)
    tag = "IMAGE PRINCIPALE  1200×630" if kind == "principale" else "IMAGE SECONDAIRE  1200×675"
    d.text((w - 48, h - 62), tag, font=f_file, fill=GREY, anchor="ra")
    d.text((48, 8), "", font=f_file)
    out = OUT / name
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=88)
    print("OK  %-40s %s %dx%d" % (name, tag, w, h))

if __name__ == "__main__":
    for i, (name, title, kind) in enumerate(IMAGES):
        render(name, title, kind, i)
    print("\n%d visuel(s) généré(s) dans %s" % (len(IMAGES), OUT))