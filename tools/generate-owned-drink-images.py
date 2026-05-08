#!/usr/bin/env python3
"""Generate text-based ChefSire-owned drink category artwork.

The generated assets are SVG files (not binary images), so pull requests can be
created in environments that reject binary file uploads while still serving
original, local category artwork from the public image folder.
"""
from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "client" / "public" / "images" / "drinks" / "potent-potables"

CATEGORIES = {
    "cocktails": {"colors": ("#40135a", "#d64976", "#f7a84d"), "liquid": "#e24d6b", "garnish": "citrus", "glass": "rocks"},
    "gin": {"colors": ("#0d4e52", "#49b79e", "#d8f2d9"), "liquid": "#d2f3e6", "garnish": "herb", "glass": "highball"},
    "rum": {"colors": ("#4a230d", "#be5c1a", "#ffb74c"), "liquid": "#ae561f", "garnish": "tropical", "glass": "rocks"},
    "vodka": {"colors": ("#0b3856", "#4fb0cd", "#dbf7ff"), "liquid": "#dff9ff", "garnish": "lime", "glass": "martini"},
    "whiskey-bourbon": {"colors": ("#32180a", "#8e4814", "#eb9d3c"), "liquid": "#c35e1c", "garnish": "orange", "glass": "rocks"},
    "scotch-irish-whiskey": {"colors": ("#231d12", "#6f4a22", "#d29144"), "liquid": "#a86227", "garnish": "smoke", "glass": "rocks"},
    "tequila-mezcal": {"colors": ("#21461f", "#9ea533", "#f9da69"), "liquid": "#f5df76", "garnish": "salt", "glass": "coupe"},
    "cognac-brandy": {"colors": ("#340c10", "#843120", "#dc894c"), "liquid": "#b14e23", "garnish": "swirl", "glass": "snifter"},
    "daiquiri": {"colors": ("#0d5b60", "#53c7ad", "#f5ea87"), "liquid": "#e5f498", "garnish": "lime", "glass": "coupe"},
    "martinis": {"colors": ("#212245", "#7c63c4", "#e6e1ff"), "liquid": "#dee8f5", "garnish": "olive", "glass": "martini"},
    "liqueurs": {"colors": ("#4b1443", "#bb3e85", "#ffbc86"), "liquid": "#c74b74", "garnish": "berry", "glass": "cordial"},
    "spritz": {"colors": ("#72210e", "#ec672d", "#ffcd7e"), "liquid": "#f47730", "garnish": "orange", "glass": "wine"},
    "mocktails": {"colors": ("#154b39", "#4db370", "#eef691"), "liquid": "#6fd277", "garnish": "herb", "glass": "highball"},
    "virgin-cocktails": {"colors": ("#12585b", "#52bec7", "#f7db6f"), "liquid": "#61cdc9", "garnish": "citrus", "glass": "hurricane"},
    "seasonal": {"colors": ("#4d121e", "#b44b2e", "#edb55b"), "liquid": "#ac382d", "garnish": "spice", "glass": "mug"},
    "hot-drinks": {"colors": ("#2f170e", "#894f29", "#e0a769"), "liquid": "#7c4826", "garnish": "steam", "glass": "mug"},
}


def glass_svg(kind: str, liquid: str) -> str:
    stroke = "rgba(255,255,255,.72)"
    shine = "rgba(255,255,255,.36)"
    if kind == "martini":
        return f'''
        <polygon points="440,250 760,250 650,475 550,475" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M485 305 C550 340 650 340 715 305" fill="none" stroke="{shine}" stroke-width="5" />
        <path d="M500 330 L700 330 L635 455 L565 455 Z" fill="{liquid}" opacity=".78" />
        <path d="M600 475 L600 630 M515 635 L685 635" stroke="{stroke}" stroke-width="8" stroke-linecap="round" />'''
    if kind == "coupe":
        return f'''
        <path d="M420 320 C435 445 765 445 780 320 C760 235 440 235 420 320 Z" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M455 337 C505 385 695 385 745 337 L720 415 C665 455 535 455 480 415 Z" fill="{liquid}" opacity=".78" />
        <path d="M600 455 L600 630 M510 635 L690 635" stroke="{stroke}" stroke-width="8" stroke-linecap="round" />'''
    if kind == "snifter":
        return f'''
        <ellipse cx="600" cy="410" rx="165" ry="175" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M505 395 C560 440 640 440 695 395 L730 525 C670 570 530 570 470 525 Z" fill="{liquid}" opacity=".78" />
        <path d="M600 560 L600 650 M525 655 L675 655" stroke="{stroke}" stroke-width="8" stroke-linecap="round" />'''
    if kind == "wine":
        return f'''
        <path d="M465 225 C455 420 490 565 600 570 C710 565 745 420 735 225 Z" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M490 370 C545 410 655 410 710 370 L700 535 C650 560 550 560 500 535 Z" fill="{liquid}" opacity=".78" />
        <path d="M600 570 L600 655 M520 660 L680 660" stroke="{stroke}" stroke-width="8" stroke-linecap="round" />'''
    if kind == "mug":
        return f'''
        <rect x="430" y="300" width="315" height="320" rx="46" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M745 395 C845 395 845 525 745 525" fill="none" stroke="{stroke}" stroke-width="20" stroke-linecap="round" />
        <path d="M460 405 C535 445 640 445 715 405 L715 600 L460 600 Z" fill="{liquid}" opacity=".78" />'''
    if kind == "cordial":
        return f'''
        <rect x="510" y="245" width="180" height="275" rx="54" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M532 375 C575 400 625 400 668 375 L668 505 L532 505 Z" fill="{liquid}" opacity=".78" />
        <path d="M600 520 L600 640 M535 645 L665 645" stroke="{stroke}" stroke-width="8" stroke-linecap="round" />'''
    if kind == "hurricane":
        return f'''
        <path d="M470 220 L730 220 L690 385 L730 650 L470 650 L510 385 Z" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M505 365 C555 395 645 395 695 365 L715 625 L485 625 Z" fill="{liquid}" opacity=".78" />'''
    if kind == "highball":
        return f'''
        <rect x="465" y="205" width="270" height="450" rx="42" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M495 330 C550 360 650 360 705 330 L705 625 L495 625 Z" fill="{liquid}" opacity=".78" />'''
    return f'''
        <rect x="430" y="285" width="340" height="360" rx="48" fill="rgba(255,255,255,.14)" stroke="{stroke}" stroke-width="7" />
        <path d="M465 420 C535 455 665 455 735 420 L735 625 L465 625 Z" fill="{liquid}" opacity=".78" />'''


def garnish_svg(kind: str) -> str:
    if kind in {"lime", "citrus", "salt"}:
        fill = "#a9dd53" if kind != "citrus" else "#ffc54a"
        salt = ''.join(f'<circle cx="{x}" cy="248" r="3" fill="rgba(255,255,255,.72)" />' for x in range(430, 770, 24)) if kind == "salt" else ""
        return f'''<circle cx="760" cy="265" r="56" fill="{fill}" stroke="rgba(255,255,255,.75)" stroke-width="6" />
        <path d="M760 209 L760 321 M704 265 L816 265 M720 225 L800 305 M800 225 L720 305" stroke="rgba(255,255,255,.38)" stroke-width="3" />{salt}'''
    if kind == "orange":
        return '<circle cx="770" cy="310" r="62" fill="#f58531" stroke="rgba(255,239,181,.75)" stroke-width="6" /><circle cx="770" cy="310" r="36" fill="#fcbd49" opacity=".65" />'
    if kind == "olive":
        return '<path d="M660 220 L795 310" stroke="#d6b87e" stroke-width="7" stroke-linecap="round" /><ellipse cx="713" cy="258" rx="26" ry="20" fill="#6d8b3f" /><ellipse cx="758" cy="276" rx="26" ry="20" fill="#6d8b3f" />'
    if kind == "herb":
        return '<path d="M705 310 C745 260 785 225 835 195" stroke="#44854f" stroke-width="7" fill="none" /><ellipse cx="748" cy="250" rx="36" ry="15" fill="#4fb56b" transform="rotate(-25 748 250)" /><ellipse cx="795" cy="220" rx="36" ry="15" fill="#4fb56b" transform="rotate(-25 795 220)" />'
    if kind == "tropical":
        return '<circle cx="760" cy="280" r="66" fill="#ffce44" stroke="rgba(255,255,255,.7)" stroke-width="6" /><polygon points="742,188 763,135 786,188" fill="#50a652" /><polygon points="780,196 838,160 825,222" fill="#50a652" />'
    if kind == "berry":
        return '<circle cx="735" cy="270" r="25" fill="#801e5c" /><circle cx="780" cy="255" r="25" fill="#801e5c" /><circle cx="802" cy="300" r="25" fill="#801e5c" />'
    if kind in {"steam", "smoke"}:
        return '<path d="M535 305 C480 230 590 215 535 145 M600 305 C545 230 655 215 600 145 M665 305 C610 230 720 215 665 145" stroke="rgba(255,255,255,.48)" stroke-width="8" fill="none" stroke-linecap="round" />'
    if kind == "spice":
        return '<path d="M700 250 L800 335 M730 335 L830 250" stroke="#794222" stroke-width="13" stroke-linecap="round" />'
    if kind == "swirl":
        return '<path d="M685 305 C710 230 830 240 830 320 C830 390 710 400 700 330" stroke="rgba(255,225,166,.7)" stroke-width="9" fill="none" stroke-linecap="round" />'
    return ""


def make_svg(slug: str, spec: dict[str, object]) -> str:
    c1, c2, c3 = spec["colors"]  # type: ignore[misc]
    liquid = str(spec["liquid"])
    glass = str(spec["glass"])
    garnish = str(spec["garnish"])
    title = escape(slug.replace("-", " ").title())
    bokeh = "\n".join(
        f'<circle cx="{120 + i * 117 % 980}" cy="{110 + i * 67 % 560}" r="{18 + i * 11 % 54}" fill="rgba(255,255,255,.08)" />'
        for i in range(18)
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-labelledby="title desc">
  <title id="title">ChefSire {title} drink artwork</title>
  <desc id="desc">Original vector artwork for the {title} drink category.</desc>
  <defs>
    <radialGradient id="spot" cx="62%" cy="36%" r="70%">
      <stop offset="0" stop-color="{c3}" />
      <stop offset="48%" stop-color="{c2}" />
      <stop offset="100%" stop-color="{c1}" />
    </radialGradient>
    <linearGradient id="bar" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="rgba(20,12,14,.25)" />
      <stop offset="1" stop-color="rgba(12,8,13,.85)" />
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#spot)" />
  {bokeh}
  <ellipse cx="600" cy="405" rx="280" ry="320" fill="rgba(255,255,255,.12)" />
  <ellipse cx="600" cy="660" rx="340" ry="76" fill="rgba(0,0,0,.25)" />
  <rect y="650" width="1200" height="150" fill="url(#bar)" />
  {glass_svg(glass, liquid)}
  {garnish_svg(garnish)}
  <path d="M505 245 C485 365 480 490 475 605" stroke="rgba(255,255,255,.34)" stroke-width="7" fill="none" stroke-linecap="round" />
  <path d="M710 260 C728 380 735 500 735 610" stroke="rgba(255,255,255,.2)" stroke-width="5" fill="none" stroke-linecap="round" />
</svg>
'''


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for stale_asset in OUT.iterdir():
        if stale_asset.is_file() and stale_asset.suffix != ".svg":
            stale_asset.unlink()
    for slug, spec in CATEGORIES.items():
        (OUT / f"{slug}.svg").write_text(make_svg(slug, spec), encoding="utf-8")
    print(f"Generated {len(CATEGORIES)} SVG images in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
