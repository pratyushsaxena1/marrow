#!/usr/bin/env python3
"""Renders every app icon asset from one description of the mark.

The mark is a card held inside a ring: the idea, and the cycle that keeps bringing it
back. That is the whole product in two shapes, and it doubles as the meaning the name
never had, since "Marrow" began life as a folder name with nothing behind it: the core
inside the shell.

The card is a portrait rounded rectangle rather than a circle, and it sits at a slight
tilt. Both are load-bearing. A circle inside a ring is a bullseye, and at 40pt an
upright shape reads as a dot; the corners and the lean are what survive the shrink and
keep the icon looking like an object rather than a target.

Proportions are fractions of the canvas, so every size is the same drawing rather than
a resize of one bitmap. Everything is drawn at 4x and downsampled, which is what keeps
the curves clean without an SVG toolchain.

Run: python3 scripts/make-icons.py
"""

import os
from PIL import Image, ImageDraw

# The app's palette, verbatim from src/ui/theme.ts.
BG = (10, 10, 10, 255)          # neutral-950, the app's background
INK = (245, 245, 245, 255)      # neutral-100, the app's primary ink
ACCENT = (52, 211, 153, 255)    # emerald-400, the app's one accent
TRANSPARENT = (0, 0, 0, 0)

# Geometry, as fractions of the canvas edge.
RING_OUTER = 0.335   # radius
RING_STROKE = 0.100
GAP = 0.098          # dark space between the ring and the card
CARD_ASPECT = 0.62   # half-width over half-height: portrait, like the cards it stands for
CARD_RADIUS = 0.20   # corner radius as a fraction of the card's width
CARD_TILT = 8        # degrees, anticlockwise

SS = 4  # supersampling factor


def draw_mark(size, background, ring_color, card_color, scale=1.0):
    """The mark on one square canvas.

    `scale` shrinks the mark within the canvas without changing the canvas, which is how
    the Android adaptive foreground keeps its content inside the safe zone that launchers
    crop to.
    """
    n = size * SS
    img = Image.new("RGBA", (n, n), background)
    d = ImageDraw.Draw(img)

    centre = n / 2
    r_out = n * RING_OUTER * scale
    r_in = r_out - n * RING_STROKE * scale
    half_h = r_in - n * GAP * scale
    half_w = half_h * CARD_ASPECT

    # The ring is a filled disc with the background punched back out of it. A stroked
    # arc antialiases its two edges differently; this way they match.
    d.ellipse([centre - r_out, centre - r_out, centre + r_out, centre + r_out], fill=ring_color)
    d.ellipse([centre - r_in, centre - r_in, centre + r_in, centre + r_in], fill=background)

    # The card is drawn on its own layer so it can be rotated without dragging the
    # ring's antialiasing through the resample.
    layer = Image.new("RGBA", (n, n), TRANSPARENT)
    ImageDraw.Draw(layer).rounded_rectangle(
        [centre - half_w, centre - half_h, centre + half_w, centre + half_h],
        radius=int(half_w * 2 * CARD_RADIUS),
        fill=card_color,
    )
    layer = layer.rotate(CARD_TILT, resample=Image.BICUBIC, center=(centre, centre))
    img = Image.alpha_composite(img, layer)

    return img.resize((size, size), Image.LANCZOS)


def squircle_preview(icon, radius_fraction=0.2237):
    """iOS masks the square asset to a rounded shape. For previewing what the home
    screen will show; the shipped assets stay square."""
    size = icon.size[0]
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size * SS - 1, size * SS - 1],
        radius=int(size * SS * radius_fraction),
        fill=255,
    )
    out = icon.copy()
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def main():
    assets = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

    # iOS. The light variant carries its own background. The dark and tinted variants are
    # transparent, because the system draws its own backdrop behind them and a baked
    # black square would sit on that backdrop as a visible tile.
    draw_mark(1024, BG, INK, ACCENT).save(os.path.join(assets, "icon.png"))
    # Slightly off-white on the dark variant: pure white glares against the system's
    # dark backdrop in a way it does not against our own near-black.
    draw_mark(1024, TRANSPARENT, (229, 229, 229, 255), ACCENT).save(
        os.path.join(assets, "icon-dark.png")
    )
    # Tinted icons are recolored wholesale by the system, so the two elements have to
    # differ in luminance rather than hue or they merge into one flat blob.
    draw_mark(1024, TRANSPARENT, INK, (138, 138, 138, 255)).save(
        os.path.join(assets, "icon-tinted.png")
    )

    # Android adaptive. Launchers crop the foreground to their own shape and only the
    # middle two thirds is guaranteed to survive, so the mark is scaled to sit inside it.
    draw_mark(512, TRANSPARENT, INK, ACCENT, scale=0.72).save(
        os.path.join(assets, "android-icon-foreground.png")
    )
    Image.new("RGBA", (512, 512), BG).save(os.path.join(assets, "android-icon-background.png"))
    draw_mark(512, TRANSPARENT, INK, INK, scale=0.72).save(
        os.path.join(assets, "android-icon-monochrome.png")
    )

    # Splash and web.
    draw_mark(512, TRANSPARENT, INK, ACCENT, scale=0.72).save(
        os.path.join(assets, "splash-icon.png")
    )
    draw_mark(64, BG, INK, ACCENT).save(os.path.join(assets, "favicon.png"))

    print("wrote icon.png, icon-dark.png, icon-tinted.png, android-icon-*.png, "
          "splash-icon.png, favicon.png")


if __name__ == "__main__":
    main()
