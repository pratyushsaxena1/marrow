#!/usr/bin/env python3
"""Composes App Store screenshots from raw simulator captures.

Each frame is a caption over a device shot that bleeds off the bottom edge. The caption
carries the pitch, the shot proves it, and running off the bottom implies the screen
continues rather than ending in a floating rectangle.

The raw captures are expected to already be at the target device's native resolution, so
the shot is only scaled down to sit inside the frame and never resampled upward.

Usage:
    python3 scripts/make-screenshots.py <raw-dir> <out-dir> [--device iphone|ipad]

`raw-dir` holds 01.png … 05.png, in the order of CAPTIONS below.
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont

BG = (10, 10, 10)
INK = (245, 245, 245)
MUTED = (163, 163, 163)
BORDER = (38, 38, 38)

# App Store expects one size per device family. These are the largest of each, which
# Apple scales down for the smaller ones.
CANVAS = {
    "iphone": (1320, 2868),   # 6.9"
    "ipad": (2064, 2752),     # 13"
}

# What each shot is being asked to prove. Short enough to read while scrolling a
# listing, and specific enough to be a claim rather than a mood.
CAPTIONS = [
    ("One idea at a time", "A vertical feed of 230 concepts across computer science, finance, math and science."),
    ("Recall it, don't just read it", "Every few cards, one comes back as a question. Answer before you scroll on."),
    ("Quiz what you are about to forget", "A focused run drawn from your own schedule, not from a fixed deck."),
    ("Search the whole library", "Filter by subject or by what you have learned, mastered, or not yet seen."),
    ("Watch it stick", "A daily goal, a streak, and four weeks of review history on one screen."),
]

# SF Pro is the face the app itself renders in, so a caption set in it reads as part of
# the same product rather than as marketing pasted above it. Helvetica is the fallback
# on a machine without SF Pro installed; PIL cannot address a variable font's weights,
# so each weight has to be a separate file.
FONTS = {
    "bold": ["/Library/Fonts/SF-Pro-Display-Bold.otf",
             ("/System/Library/Fonts/Supplemental/HelveticaNeue.ttc", 1)],
    "regular": ["/Library/Fonts/SF-Pro-Display-Regular.otf",
                ("/System/Library/Fonts/Supplemental/HelveticaNeue.ttc", 0)],
}


def load_font(size, weight="regular"):
    for entry in FONTS[weight]:
        path, index = entry if isinstance(entry, tuple) else (entry, 0)
        try:
            return ImageFont.truetype(path, size, index=index)
        except OSError:
            continue
    return ImageFont.load_default()


def wrap(draw, text, font, max_width):
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


# The caption sits in a band whose height is reserved for the longest caption in the
# set, not for this one. Every shot then starts at the same y, which is what makes five
# frames read as a set when the listing shows them in a row, and no subtitle can ever be
# pushed underneath its own screenshot.
TITLE_TOP = 0.052
MAX_TITLE_LINES = 2
MAX_SUBTITLE_LINES = 2
BAND_PADDING = 0.030    # below the caption, as a fraction of frame height

# A tablet's canvas is far wider than a phone's, so type set as a fraction of the width
# comes out oversized there. Each family gets its own ratios.
TYPE = {
    "iphone": {"title": 0.066, "subtitle": 0.032},
    "ipad": {"title": 0.048, "subtitle": 0.023},
}


def compose(shot_path, title, subtitle, size, family="iphone"):
    W, H = size
    frame = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(frame)

    margin = int(W * 0.075)
    max_width = W - margin * 2

    # Shrink a long headline until it fits the band rather than letting it run to a
    # third line and eat into the shot.
    title_size = int(W * TYPE[family]["title"])
    while title_size > int(W * TYPE[family]["title"] * 0.62):
        title_font = load_font(title_size, "bold")
        lines = wrap(d, title, title_font, max_width)
        if len(lines) <= MAX_TITLE_LINES:
            break
        title_size -= 2
    sub_font = load_font(int(W * TYPE[family]["subtitle"]), "regular")

    title_line = int(title_font.size * 1.14)
    sub_line = int(sub_font.size * 1.40)
    band_bottom = (
        int(H * TITLE_TOP)
        + MAX_TITLE_LINES * title_line
        + int(H * 0.010)
        + MAX_SUBTITLE_LINES * sub_line
        + int(H * BAND_PADDING)
    )

    # Both blocks are centred within the band rather than stacked from its top, so a
    # one-line headline does not leave the caption clinging to the ceiling.
    used = len(lines) * title_line + int(H * 0.010)
    sub_lines = wrap(d, subtitle, sub_font, int(max_width * 0.94))
    used += len(sub_lines) * sub_line
    y = int(H * TITLE_TOP) + max(0, (band_bottom - int(H * BAND_PADDING) - int(H * TITLE_TOP) - used) // 2)

    for line in lines:
        width = d.textlength(line, font=title_font)
        d.text(((W - width) / 2, y), line, font=title_font, fill=INK)
        y += title_line

    y += int(H * 0.010)
    for line in sub_lines:
        width = d.textlength(line, font=sub_font)
        d.text(((W - width) / 2, y), line, font=sub_font, fill=MUTED)
        y += sub_line

    shot = Image.open(shot_path).convert("RGB")
    # Wide enough that the shot always runs off the bottom edge: a shot that happens to
    # fit inside the frame reads as a floating rectangle, not as a screen continuing.
    target_w = int(W * 0.86)
    target_h = int(shot.height * (target_w / shot.width))
    shot = shot.resize((target_w, target_h), Image.LANCZOS)

    radius = int(target_w * 0.075)
    mask = Image.new("L", (target_w * 2, target_h * 2), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, target_w * 2 - 1, target_h * 2 - 1], radius=radius * 2, fill=255
    )
    mask = mask.resize((target_w, target_h), Image.LANCZOS)

    top = band_bottom
    frame.paste(shot, ((W - target_w) // 2, top), mask)
    d.rounded_rectangle(
        [(W - target_w) // 2, top, (W + target_w) // 2 - 1, top + target_h - 1],
        radius=radius,
        outline=BORDER,
        width=2,
    )
    return frame


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    raw_dir, out_dir = sys.argv[1], sys.argv[2]
    device = "iphone"
    if "--device" in sys.argv:
        device = sys.argv[sys.argv.index("--device") + 1]

    os.makedirs(out_dir, exist_ok=True)
    for i, (title, subtitle) in enumerate(CAPTIONS, start=1):
        shot = os.path.join(raw_dir, f"{i:02d}.png")
        if not os.path.exists(shot):
            print(f"skipping {i:02d}: no capture")
            continue
        frame = compose(shot, title, subtitle, CANVAS[device], family=device)
        out = os.path.join(out_dir, f"{device}-{i:02d}.png")
        frame.save(out)
        print(f"wrote {out}  {frame.size[0]}x{frame.size[1]}")


if __name__ == "__main__":
    main()
