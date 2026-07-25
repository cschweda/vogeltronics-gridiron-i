#!/usr/bin/env python3
"""Generate a branded 1200x630 og:image for a VogelTronics game.

Reusable across every game in the universe: same dark, sleek layout —
logo top-left, big title block, "GAMES THAT THINK!" sticker, boxart
tilted on the right over a red LED glow, subtle 3x9 LED grid motif.

Usage:
  python3 tools/make-og-image.py \
      --boxart docs/images/gridiron-boxart.png \
      --title GRIDIRON \
      --subtitle "ELECTRONIC FOOTBALL · 1977" \
      --out docs/images/og-image.png

Requires Google Chrome (rendered via headless screenshot). No other deps.
"""

import argparse
import base64
import pathlib
import subprocess
import struct
import sys
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

W, H = 1200, 630

SVG_TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0b0e"/>
      <stop offset="1" stop-color="#16161c"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#f23a2b" stop-opacity=".38"/>
      <stop offset=".6" stop-color="#f23a2b" stop-opacity=".12"/>
      <stop offset="1" stop-color="#f23a2b" stop-opacity="0"/>
    </radialGradient>
    <filter id="boxshadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="28" flood-color="#000000" flood-opacity=".65"/>
    </filter>
  </defs>

  <rect width="{W}" height="{H}" fill="url(#bg)"/>

  <!-- subtle 3x9 LED field motif, echoing the game display -->
  <g fill="#f0281a">
{led_grid}
  </g>

  <!-- red glow behind the boxart -->
  <ellipse cx="950" cy="330" rx="330" ry="300" fill="url(#glow)"/>

  <!-- boxart, gently tilted -->
  <g transform="translate({art_cx} {art_cy}) rotate(3.5)" filter="url(#boxshadow)">
    <image x="-{art_hw}" y="-{art_hh}" width="{art_w}" height="{art_h}" xlink:href="data:image/png;base64,{boxart_b64}"/>
    <rect x="-{art_hw}" y="-{art_hh}" width="{art_w}" height="{art_h}" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="2"/>
  </g>

  <!-- VogelTronics logo -->
  <image x="72" y="58" width="400" height="80" xlink:href="data:image/svg+xml;base64,{logo_b64}"/>

  <!-- title block -->
  <text x="76" y="352" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="{title_size}" letter-spacing="4" fill="#f4efe6">{title}</text>
  <text x="80" y="404" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="26" letter-spacing="7" fill="#f23a2b">{subtitle}</text>

  <!-- brand sticker -->
  <g transform="translate(80 462) rotate(-3)">
    <rect x="0" y="0" rx="10" width="356" height="62" fill="#e01f10"/>
    <text x="178" y="41" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="27" letter-spacing="2.5" font-style="italic" fill="#ffffff">GAMES THAT THINK!</text>
  </g>

  <text x="80" y="586" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="500" font-size="20" letter-spacing="2" fill="#84848d">{url}</text>
</svg>
"""


def png_size(path: pathlib.Path) -> tuple[int, int]:
    data = path.read_bytes()
    return struct.unpack(">II", data[16:24])


def led_grid_svg() -> str:
    # 3 rows x 9 cols of dim blips, bottom-left, one "bright" runner blip
    rows, cols, r, gap = 3, 9, 7, 44
    ox, oy = 96, 190
    out = []
    for row in range(rows):
        for col in range(cols):
            bright = row == 1 and col == 2
            op = ".55" if bright else ".13"
            rad = r + 1 if bright else r
            out.append(
                f'    <circle cx="{ox + col * gap}" cy="{oy + row * gap}" r="{rad}" fill-opacity="{op}"/>'
            )
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--boxart", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", required=True)
    ap.add_argument("--logo", default="docs/images/vogeltronics-logo.svg")
    # The brand root, not the game's own subdomain: every game in the catalog
    # sits at <game>.vogeltronics.com, and the card should point at the house.
    ap.add_argument("--url", default="vogeltronics.com")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    boxart = pathlib.Path(args.boxart)
    logo = pathlib.Path(args.logo)
    out = pathlib.Path(args.out)

    bw, bh = png_size(boxart)
    art_h = 470
    art_w = round(art_h * bw / bh)

    # Shrink the title if it's long so it never collides with the boxart
    title_size = 96 if len(args.title) <= 10 else max(52, round(960 / len(args.title)))

    svg = SVG_TEMPLATE.format(
        W=W,
        H=H,
        led_grid=led_grid_svg(),
        boxart_b64=base64.b64encode(boxart.read_bytes()).decode(),
        logo_b64=base64.b64encode(logo.read_bytes()).decode(),
        art_w=art_w,
        art_h=art_h,
        art_hw=art_w // 2,
        art_hh=art_h // 2,
        art_cx=950,
        art_cy=315,
        title=args.title,
        subtitle=args.subtitle,
        title_size=title_size,
        url=args.url,
    )

    with tempfile.TemporaryDirectory() as td:
        page = pathlib.Path(td) / "og.html"
        page.write_text(
            f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>html,body{{margin:0;padding:0;overflow:hidden}}</style></head>"
            f"<body>{svg}</body></html>"
        )
        subprocess.run(
            [
                CHROME,
                "--headless=new",
                f"--screenshot={out.resolve()}",
                f"--window-size={W},{H}",
                "--hide-scrollbars",
                "--disable-gpu",
                f"file://{page}",
            ],
            check=True,
            capture_output=True,
        )
    print(f"wrote {out} ({W}x{H})")


if __name__ == "__main__":
    sys.exit(main())
