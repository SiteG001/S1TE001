"""Build the Open Graph share cards from the site's hero artwork.

Run after either source image changes:

    npm run og

The cards are derived from the page artwork rather than drawn separately so a
link preview looks like the page it opens. Type falls back to Georgia and Segoe UI —
the exact fallbacks declared for Cormorant Garamond and Jost in tokens.css, so
the substitution is the one the site itself would make.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "..", "public", "img")

W, H = 1200, 630

CREAM = (250, 246, 238)
STONE = (211, 199, 174)
GOLD = (223, 196, 142)
FOREST = (14, 27, 21)

FONTS = r"C:/Windows/Fonts"
display = lambda size: ImageFont.truetype(os.path.join(FONTS, "georgia.ttf"), size)
display_b = lambda size: ImageFont.truetype(os.path.join(FONTS, "georgiab.ttf"), size)
body = lambda size: ImageFont.truetype(os.path.join(FONTS, "segoeui.ttf"), size)


def cover(path, box):
    """Centre-crop `path` to the aspect of `box`, then resize to it."""
    im = Image.open(path).convert("RGB")
    tw, th = box
    scale = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    return im.crop((left, top, left + tw, top + th))


def scrim(im, strength=0.82):
    """Left-to-right plus bottom-up darkening, so type always clears AA contrast."""
    overlay = Image.new("L", (W, H), 0)
    px = overlay.load()
    for x in range(W):
        horizontal = max(0.0, 1.0 - (x / (W * 0.78)) ** 1.5)
        for y in range(H):
            vertical = max(0.0, (y / H - 0.35) / 0.65) ** 2 * 0.55
            px[x, y] = int(min(1.0, horizontal * strength + vertical) * 255)
    return Image.composite(Image.new("RGB", (W, H), FOREST), im, overlay)


def tracked(draw, xy, text, font, fill, tracking):
    """Letter-spaced text. Pillow has no tracking, and the eyebrow needs 0.22em."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


# The oak leaf, copied verbatim from partials/brand-mark.html so the share card
# and the site can never drift apart. Subpath 0 fills; the midrib and the four
# veins that follow are knockouts, which is why the mark is pasted through a
# mask — the photograph shows through the veins exactly as it does in the SVG.
BLADE = """M 20 3.6 C 23.4 5.6 25.5 7.2 25.5 9.6 C 25.5 11.5 24.2 12.2 22.5 12.5
C 25.6 12.1 29.4 13.2 30.5 15.8 C 31.5 18.2 29.2 19.6 22.2 20.2
C 25.4 19.9 28.6 21 29.3 23.4 C 30 25.7 27.4 26.5 21.7 26.9
C 24 26.9 25.5 27.8 25.6 29.3 C 25.7 30.9 23.6 31.6 20.3 31.8
L 20 31.8 L 19.7 31.8 C 16.4 31.6 14.3 30.9 14.4 29.3
C 14.5 27.8 16 26.9 18.3 26.9 C 12.6 26.5 10 25.7 10.7 23.4
C 11.4 21 14.6 19.9 17.8 20.2 C 10.8 19.6 8.5 18.2 9.5 15.8
C 10.6 13.2 14.4 12.1 17.5 12.5 C 15.8 12.2 14.5 11.5 14.5 9.6
C 14.5 7.2 16.6 5.6 20 3.6 Z
M 20 7.8 C 20.62 8.4 20.72 10.2 20.72 13 C 20.72 19 20.6 24.4 20.45 29.6
C 20.42 30.6 19.58 30.6 19.55 29.6 C 19.4 24.4 19.28 19 19.28 13
C 19.28 10.2 19.38 8.4 20 7.8 Z
M 20.8 13.6 C 22.4 14 25 14.9 27.4 16.4 C 24.8 15.6 22.2 15 20.8 14.9 Z
M 19.2 13.6 C 17.6 14 15 14.9 12.6 16.4 C 15.2 15.6 17.8 15 19.2 14.9 Z
M 20.8 20.8 C 22.2 21.2 24.4 22.1 26.4 23.4 C 24 22.6 21.9 22.1 20.8 22 Z
M 19.2 20.8 C 17.8 21.2 15.6 22.1 13.6 23.4 C 16 22.6 18.1 22.1 19.2 22 Z"""

STEM = ("M 20 31 C 20.85 32.6 20.85 34.4 20.45 36 "
        "C 20.36 36.5 19.64 36.5 19.55 36 C 19.15 34.4 19.15 32.6 20 31 Z")

MARK_SCALE = 1.12          # matches the transform on the SVG group


def flatten(d, steps=40):
    """Absolute M/L/C path -> one point list per subpath. Enough of an SVG path
    parser for artwork we author ourselves."""
    toks = re.findall(r"[MLCZ]|-?\d*\.?\d+", d)
    subs, cur, pt, cmd, i = [], [], (0.0, 0.0), None, 0
    while i < len(toks):
        t = toks[i]
        if t in "MLCZ":
            cmd = t
            i += 1
            if cmd == "Z" and cur:
                subs.append(cur)
                cur = []
            continue
        f = lambda k: float(toks[i + k])
        if cmd == "M":
            if cur:
                subs.append(cur)
            pt = (f(0), f(1)); cur = [pt]; i += 2; cmd = "L"
        elif cmd == "L":
            pt = (f(0), f(1)); cur.append(pt); i += 2
        else:
            p1, p2, p3 = (f(0), f(1)), (f(2), f(3)), (f(4), f(5))
            for n in range(1, steps + 1):
                t_, u = n / steps, 1 - n / steps
                cur.append((u*u*u*pt[0] + 3*u*u*t_*p1[0] + 3*u*t_*t_*p2[0] + t_*t_*t_*p3[0],
                            u*u*u*pt[1] + 3*u*u*t_*p1[1] + 3*u*t_*t_*p2[1] + t_*t_*t_*p3[1]))
            pt = p3; i += 6
    if cur:
        subs.append(cur)
    return subs


def mark(im, x, y, size, ss=4):
    """Paste the oak leaf at `size` px with its top-left at (x, y)."""
    n = size * ss
    k = n / 40 * MARK_SCALE
    off = 20 * (1 - MARK_SCALE) / MARK_SCALE        # scale about the box centre
    mask = Image.new("L", (n, n), 0)
    md = ImageDraw.Draw(mask)
    for path, knockouts in ((BLADE, True), (STEM, False)):
        for j, pts in enumerate(flatten(path)):
            md.polygon([((px + off) * k, (py + off) * k) for px, py in pts],
                       fill=0 if (knockouts and j > 0) else 255)
    im.paste(GOLD, (x, y), mask.resize((size, size), Image.LANCZOS))


def card(source, out, headline, sub, meta, eyebrow):
    im = scrim(cover(os.path.join(IMG, source), (W, H)))
    d = ImageDraw.Draw(im)

    pad = 72
    mark(im, pad, pad - 4, 52)
    d.text((pad + 68, pad - 2), "White Oak", font=display_b(30), fill=CREAM)
    tracked(d, (pad + 70, pad + 34), "STEWARDSHIP", body(13), STONE, 2.6)

    tracked(d, (pad, 258), eyebrow.upper(), body(15), GOLD, 3.4)

    y = 292
    for line in headline:
        d.text((pad, y), line, font=display(60), fill=CREAM)
        y += 68

    d.text((pad, y + 14), sub, font=body(25), fill=STONE)

    d.line([(pad, H - 104), (pad + 44, H - 104)], fill=GOLD, width=2)
    d.text((pad, H - 88), meta, font=body(21), fill=STONE)

    im.save(os.path.join(IMG, out), "JPEG", quality=86, optimize=True, progressive=True)
    print(f"{out:24} {os.path.getsize(os.path.join(IMG, out)) / 1024:6.1f} KB")


card(
    "north-georgia-mountain-home-at-dusk.jpg",
    "white-oak-stewardship-og-home.jpg",
    ["Someone is there", "when you are not."],
    "Private home watch and concierge stewardship",
    "North Georgia mountains  ·  470-859-3583",
    "Second-home stewardship",
)

card(
    "home-watch-coverage-cutaway-diagram.jpg",
    "white-oak-stewardship-og-memberships.jpg",
    ["Three levels", "of care."],
    "Home watch, concierge and private stewardship",
    "Founding rate $249/month  ·  First 10 members",
    "Memberships",
)
