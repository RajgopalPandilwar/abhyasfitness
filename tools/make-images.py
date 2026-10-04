"""Generate the Open Graph share image and favicon.
Run: python tools/make-images.py
Output: og-image.png (1200x630) + favicon.png (512) + favicon.ico
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TMP = os.environ.get("TMPDIR", "/tmp")

BLACK = (10, 10, 10)
GOLD = (203, 173, 98)
GOLD_DIM = (138, 117, 68)
WHITE = (244, 242, 238)
GREY = (156, 163, 175)

BE = os.path.join(TMP, "bebas.ttf")
IN = os.path.join(TMP, "inter.ttf")


def read_brand():
    """Brand name comes from config.js so the images never go stale."""
    src = (os.path.join(ROOT, "config.js"))
    import re
    m = re.search(r"name:\s*'([^']+)'", open(src, encoding="utf-8").read())
    name = m.group(1) if m else "YOUR BRAND"
    parts = name.split()
    brand = parts[0]
    # A one-word brand has no accent half — printing it twice looks broken.
    accent = parts[-1] if len(parts) > 1 else ""
    return brand, accent, name


def font(path, size):
    return ImageFont.truetype(path, size)


def og_image():
    brand, accent, full = read_brand()
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BLACK)
    d = ImageDraw.Draw(img)

    # Subtle gold glow, top right
    for i in range(14, 0, -1):
        r = i * 34
        a = int(9 - i * 0.5)
        if a <= 0:
            continue
        d.ellipse([W - 300 - r, -300 - r, W - 300 + r, -300 + r],
                  fill=(a, int(a * 0.85), int(a * 0.5)))

    M = 80

    # Gold rule at top
    d.rectangle([M, M, M + 120, M + 6], fill=GOLD)

    # Eyebrow
    d.text((M, M + 34), "DIGITAL TRAINING PROGRAMS", font=font(IN, 21), fill=GOLD)

    # Headline
    d.text((M - 4, 190), "TRAIN WITH", font=font(BE, 132), fill=WHITE)
    d.text((M - 4, 310), "INTENT.", font=font(BE, 132), fill=GOLD)

    # Sub
    d.text((M, 480),
           "Fat Loss  ·  Muscle Building  ·  At Home  ·  Performance",
           font=font(IN, 27), fill=GREY)

    # UPI badge
    label = "PAY VIA UPI"
    tw = d.textlength(label, font=font(IN, 18))
    bx = W - M - tw - 44
    by = M + 24
    d.rectangle([bx, by, bx + tw + 44, by + 48], outline=GOLD, width=2)
    d.text((bx + 22, by + 15), label, font=font(IN, 18), fill=GOLD)

    # Bottom rule + wordmark
    d.rectangle([M, H - 108, W - M, H - 106], fill=(38, 38, 38))
    d.text((M, H - 88), brand, font=font(BE, 44), fill=WHITE)
    wm = d.textlength(brand, font=font(BE, 44))
    d.text((M + wm, H - 88), accent, font=font(BE, 44), fill=GOLD)

    out = os.path.join(ROOT, "og-image.png")
    img.save(out, "PNG", optimize=True)
    print("wrote", out, img.size)


def favicon():
    brand, accent, full = read_brand()
    S = 512
    img = Image.new("RGBA", (S, S), BLACK)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, S - 1, S - 1], outline=GOLD, width=14)
    # anchor "mm" centres the glyph both ways, so x/y must be the middle of
    # the square. The old anchor "ma" at x=0 pinned the glyph's midpoint to
    # the left edge and rendered half of the letter off-canvas.
    d.text((S / 2, S / 2), brand[0].upper(), font=font(BE, 340),
           fill=GOLD, anchor="mm")
    png = os.path.join(ROOT, "favicon.png")
    img.save(png, "PNG", optimize=True)
    img.resize((256, 256), Image.LANCZOS).save(
        os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote", png, "and favicon.ico")


if __name__ == "__main__":
    if not os.path.exists(BE) or not os.path.exists(IN):
        raise SystemExit("Fonts missing — download bebas.ttf and inter.ttf to " + TMP)
    og_image()
    favicon()
