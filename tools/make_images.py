"""Draws the project's illustrations as SVG files (no downloads, no copyright problems).

Run from the project folder:   python tools/make_images.py
Writes:  public/images/hero.svg, public/images/favicon.svg, public/uploads/seed-<name>.svg (one per demo produce item)
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public" / "images"
UPLOADS = ROOT / "public" / "uploads"
IMAGES.mkdir(parents=True, exist_ok=True)
UPLOADS.mkdir(parents=True, exist_ok=True)


def svg(w, h, inner):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">{inner}</svg>')


# ---------------------------------------------------------------- produce drawings (centred on 300,200; about 360 wide)
def tomatoes():
    defs = ('<defs><radialGradient id="tg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#F0705A"/>'
            '<stop offset="1" stop-color="#C5301F"/></radialGradient></defs>')

    def one(cx, cy, r):
        calyx = "".join(
            f'<ellipse cx="{cx}" cy="{cy - r * 0.86}" rx="{r * 0.3}" ry="{r * 0.09}" fill="#3F8F4F" transform="rotate({a} {cx} {cy - r * 0.86})"/>'
            for a in (0, 72, 144, 216, 288))
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#tg)"/>{calyx}'
                f'<rect x="{cx - 3}" y="{cy - r - 10}" width="6" height="16" rx="3" fill="#357A44"/>'
                f'<ellipse cx="{cx - r * 0.4}" cy="{cy - r * 0.35}" rx="{r * 0.18}" ry="{r * 0.1}" fill="#fff" opacity=".5" '
                f'transform="rotate(-35 {cx - r * 0.4} {cy - r * 0.35})"/>')
    return defs + one(225, 245, 62) + one(375, 245, 62) + one(300, 200, 70)


def _kale_leaf(angle, length, width, fill):
    cy = 300 - length / 2
    ruffles = "".join(
        f'<circle cx="{300 + width * math.cos(math.radians(t))}" cy="{cy + length / 2 * math.sin(math.radians(t))}" r="10" fill="{fill}"/>'
        for t in range(0, 360, 36))
    return (f'<g transform="rotate({angle} 300 300)"><ellipse cx="300" cy="{cy}" rx="{width}" ry="{length / 2}" fill="{fill}"/>{ruffles}'
            f'<line x1="300" y1="300" x2="300" y2="{300 - length + 10}" stroke="#A8D88F" stroke-width="4" stroke-linecap="round"/></g>')


def kale():
    leaves = (_kale_leaf(-42, 210, 44, "#2A6F37") + _kale_leaf(42, 210, 44, "#2A6F37") +
              _kale_leaf(-20, 240, 50, "#348442") + _kale_leaf(20, 240, 50, "#348442") + _kale_leaf(0, 255, 52, "#3E9650"))
    return leaves + '<rect x="268" y="285" width="64" height="22" rx="6" fill="#B8864B"/><rect x="268" y="285" width="64" height="7" rx="3" fill="#D3A468"/>'


def _spinach_leaf(angle, length, width, fill):
    top = 300 - length
    return (f'<g transform="rotate({angle} 300 300)">'
            f'<line x1="300" y1="300" x2="300" y2="332" stroke="#9BCB7F" stroke-width="6" stroke-linecap="round"/>'
            f'<path d="M300 300 C{300 - width} {300 - length * 0.3} {300 - width * 0.8} {top + length * 0.15} 300 {top} '
            f'C{300 + width * 0.8} {top + length * 0.15} {300 + width} {300 - length * 0.3} 300 300Z" fill="{fill}"/>'
            f'<path d="M300 300 L300 {top + 18}" stroke="#7FBF6A" stroke-width="3" stroke-linecap="round"/></g>')


def spinach():
    return (_spinach_leaf(-48, 190, 62, "#2B7D3B") + _spinach_leaf(48, 190, 62, "#2B7D3B") +
            _spinach_leaf(-24, 225, 66, "#339246") + _spinach_leaf(24, 225, 66, "#339246") + _spinach_leaf(0, 245, 70, "#3BA050") +
            '<rect x="272" y="300" width="56" height="18" rx="6" fill="#B8864B"/>')


def maize():
    defs = ('<defs><pattern id="kern" width="13" height="13" patternUnits="userSpaceOnUse"><rect width="13" height="13" fill="#F6DC78"/>'
            '<circle cx="6.5" cy="6.5" r="4.6" fill="#EBBE2B"/></pattern></defs>')

    def cob(x, y, rot):
        return (f'<g transform="translate({x} {y}) rotate({rot})">'
                '<path d="M-6 80 C-70 60 -62 -30 -38 -70 C-50 -20 -40 40 -4 70Z" fill="#4C9A52"/>'
                '<path d="M6 80 C70 60 62 -30 38 -70 C50 -20 40 40 4 70Z" fill="#3F8A48"/>'
                '<rect x="-34" y="-112" width="68" height="190" rx="32" fill="url(#kern)"/>'
                '<path d="M-6 90 C-30 50 -26 20 0 -40 C26 20 30 50 6 90Z" fill="#5BAA60"/>'
                '<rect x="-8" y="86" width="16" height="22" rx="5" fill="#B8864B"/></g>')
    return defs + cob(245, 215, -14) + cob(355, 215, 14)


def sorghum():
    heads = []
    cols = ["#A33C22", "#8E2F1B", "#B8512B", "#7C2A1A"]
    k = 0
    y = 62
    row = 0
    while y < 212:
        x_off = (row % 2) * 7
        half = 52 * math.sqrt(max(0.0, 1 - ((y - 137) / 82) ** 2))
        x = 300 - half + x_off
        while x <= 300 + half:
            heads.append(f'<circle cx="{x:.1f}" cy="{y}" r="7" fill="{cols[k % 4]}"/>')
            x += 14
            k += 1
        y += 12
        row += 1
    return ('<path d="M300 335 L300 205" stroke="#7B9140" stroke-width="9" stroke-linecap="round"/>'
            '<path d="M300 300 C230 290 190 250 170 215 C215 240 262 250 300 270Z" fill="#6E8A38"/>'
            '<path d="M300 270 C370 262 410 232 430 198 C385 222 338 232 300 246Z" fill="#7B9A40"/>' + "".join(heads))


def milk():
    return ('<g transform="translate(-45 0)"><path d="M272 112 H328 V152 C328 172 372 178 372 218 V300 Q372 316 356 316 H244 Q228 316 228 300 V218 C228 178 272 172 272 152Z" '
            'fill="#FFFFFF" stroke="#B9CCE0" stroke-width="4"/><rect x="266" y="96" width="68" height="20" rx="5" fill="#3B82C4"/>'
            '<rect x="236" y="222" width="128" height="64" rx="8" fill="#DCEBFA"/>'
            '<path d="M300 232 C288 248 284 254 284 262 A16 16 0 0 0 316 262 C316 254 312 248 300 232Z" fill="#3B82C4"/></g>'
            '<g transform="translate(70 0)"><path d="M352 190 H438 L428 312 Q427 318 421 318 H369 Q363 318 362 312Z" fill="#F4F9FF" stroke="#B9CCE0" stroke-width="4"/>'
            '<path d="M356 214 H434 L428 312 Q427 318 421 318 H369 Q363 318 362 312Z" fill="#FFFFFF"/></g>')


def eggs():
    def egg(x, y, fill):
        return (f'<ellipse cx="{x}" cy="{y}" rx="34" ry="44" fill="{fill}"/>'
                f'<ellipse cx="{x - 10}" cy="{y - 16}" rx="7" ry="12" fill="#fff" opacity=".45" transform="rotate(20 {x - 10} {y - 16})"/>')
    back = egg(235, 195, "#F4E3C8") + egg(300, 192, "#E6C79B") + egg(365, 195, "#F4E3C8")
    front = egg(268, 232, "#E6C79B") + egg(332, 232, "#F4E3C8") + egg(204, 232, "#F4E3C8") + egg(396, 232, "#E6C79B")
    tray = ('<path d="M160 250 L440 250 L418 322 Q416 330 406 330 H194 Q184 330 182 322Z" fill="#B7A387"/>'
            '<path d="M160 250 L440 250 L436 268 L164 268Z" fill="#CDBB9F"/>')
    return back + front + tray


def bananas():
    def banana(rot, shade):
        return (f'<g transform="rotate({rot} 300 300)"><path d="M180 175 C185 280 250 330 370 300 C300 300 235 260 225 175 Z" fill="{shade}"/>'
                f'<path d="M180 175 C185 280 250 330 370 300 C330 290 300 285 270 270" fill="none" stroke="#D9A91B" stroke-width="3" opacity=".7"/>'
                '<circle cx="372" cy="300" r="7" fill="#6B4A2B"/><rect x="190" y="150" width="22" height="34" rx="6" fill="#7A5A33"/></g>')
    return ('<g transform="translate(34 -6)">' + banana(-22, "#F2C230") + banana(-8, "#F7CE3F") +
            banana(8, "#F2C230") + banana(22, "#F7CE3F") + '</g>')


def potatoes():
    def pot(cx, cy, rx, ry, rot, fill):
        eyes = "".join(f'<ellipse cx="{cx + dx}" cy="{cy + dy}" rx="3.5" ry="2.4" fill="#8A6636"/>' for dx, dy in ((-rx * .35, -ry * .2), (rx * .3, ry * .25), (rx * .05, -ry * .5)))
        return (f'<g transform="rotate({rot} {cx} {cy})"><ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}"/>'
                f'<ellipse cx="{cx - rx * .3}" cy="{cy - ry * .4}" rx="{rx * .3}" ry="{ry * .15}" fill="#fff" opacity=".25"/>{eyes}</g>')
    return (pot(240, 255, 78, 52, -12, "#C4985F") + pot(365, 252, 72, 50, 14, "#D3AE79") + pot(300, 200, 82, 56, 4, "#B88D55") +
            pot(210, 200, 54, 40, 22, "#D3AE79") + pot(392, 200, 52, 40, -18, "#C4985F"))


def carrots():
    def carrot(x, y, rot):
        tops = "".join(f'<path d="M0 -92 C{dx} -125 {dx * 1.4} -150 {dx * 1.8} -170" stroke="#3F9D4A" stroke-width="8" stroke-linecap="round" fill="none"/>' for dx in (-26, 0, 26))
        ridges = "".join(f'<path d="M-{w} {yy} Q0 {yy + 6} {w} {yy}" stroke="#D86F10" stroke-width="3" fill="none" opacity=".6"/>' for yy, w in ((-55, 20), (-15, 16), (25, 12), (62, 7)))
        return (f'<g transform="translate({x} {y}) rotate({rot})">{tops}'
                f'<path d="M-25 -92 Q0 -108 25 -92 L7 108 Q0 122 -7 108Z" fill="#F28C28"/>{ridges}</g>')
    return ('<g transform="translate(300 205) scale(.8) translate(-300 -205)">' +
            carrot(245, 235, -16) + carrot(355, 235, 16) + carrot(300, 225, 0) + '</g>')


def onions():
    def onion(cx, cy, s):
        return (f'<g transform="translate({cx} {cy}) scale({s})">'
                '<path d="M0 -95 C20 -60 72 -40 72 10 C72 60 36 88 0 88 C-36 88 -72 60 -72 10 C-72 -40 -20 -60 0 -95Z" fill="#8E2C5E"/>'
                '<path d="M0 -88 C-30 -40 -52 -10 -48 40 C-46 62 -24 80 0 84" fill="none" stroke="#B9548C" stroke-width="5" opacity=".7"/>'
                '<path d="M0 -88 C30 -40 52 -10 48 40 C46 62 24 80 0 84" fill="none" stroke="#B9548C" stroke-width="5" opacity=".7"/>'
                '<path d="M0 -95 C-4 -112 4 -118 10 -126" stroke="#B58A5A" stroke-width="5" stroke-linecap="round" fill="none"/>'
                '<path d="M-14 86 L-18 102 M0 88 L0 106 M14 86 L18 102" stroke="#B58A5A" stroke-width="3" stroke-linecap="round"/></g>')
    return onion(235, 235, 0.72) + onion(365, 235, 0.72) + onion(300, 215, 0.85)


PRODUCE = {  # file name: (background, ground shadow, drawing)
    "tomatoes": ("#FBE6E0", "#EBC3B9", tomatoes),
    "kale": ("#E2F0DF", "#BFD9BA", kale),
    "spinach": ("#DBEED8", "#B6D6B0", spinach),
    "white-maize": ("#FBF1D0", "#E9D9A0", maize),
    "sorghum": ("#F5E4DA", "#E1C3B1", sorghum),
    "fresh-milk": ("#E3EFFA", "#C3D7EA", milk),
    "free-range-eggs": ("#F5EDDF", "#E2D3B8", eggs),
    "bananas": ("#FFF4CF", "#EFDB92", bananas),
    "irish-potatoes": ("#F2E9DA", "#DCCBAE", potatoes),
    "carrots": ("#FDE8D4", "#F0C8A2", carrots),
    "red-onions": ("#F2E3EC", "#DDBFD0", onions),
}


def product_svg(bg, ground, art):
    return svg(600, 400, f'<rect width="600" height="400" fill="{bg}"/><ellipse cx="300" cy="322" rx="185" ry="24" fill="{ground}"/>{art()}')


# ---------------------------------------------------------------- hero (720 x 440, same shape as the 360 x 220 box)
def place(art, x, y, s):
    return f'<g transform="translate({x} {y}) scale({s}) translate(-300 -200)">{art()}</g>'


def hero():
    sky = ('<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE3F4"/><stop offset="1" stop-color="#F3F8E8"/></linearGradient></defs>'
           '<rect width="720" height="440" fill="url(#sky)"/>'
           '<circle cx="590" cy="95" r="46" fill="#F7C948"/><circle cx="590" cy="95" r="62" fill="#F7C948" opacity=".25"/>'
           '<g fill="#fff" opacity=".9"><ellipse cx="130" cy="80" rx="52" ry="16"/><ellipse cx="170" cy="68" rx="34" ry="14"/>'
           '<ellipse cx="360" cy="130" rx="44" ry="13"/><ellipse cx="392" cy="120" rx="28" ry="11"/></g>')
    hills = ('<path d="M0 250 C120 190 240 200 360 235 C480 270 600 215 720 235 V440 H0Z" fill="#9CCB84"/>'
             '<path d="M0 290 C140 245 260 270 380 285 C500 300 620 265 720 285 V440 H0Z" fill="#6DAE5C"/>'
             '<path d="M0 340 C150 315 300 330 450 335 C560 338 650 325 720 330 V440 H0Z" fill="#46934B"/>')
    rows = "".join(f'<path d="M{-20 + i * 28} 440 L{250 + i * 14} 300" stroke="#5FAF63" stroke-width="3" opacity=".55"/>' for i in range(0, 14))
    crate = ('<rect x="330" y="318" width="330" height="96" rx="8" fill="#B9854C"/>'
             '<rect x="330" y="318" width="330" height="14" rx="6" fill="#D6A56A"/>'
             '<rect x="330" y="350" width="330" height="10" fill="#9C6D38"/><rect x="330" y="384" width="330" height="10" fill="#9C6D38"/>'
             '<rect x="346" y="318" width="14" height="96" fill="#9C6D38"/><rect x="630" y="318" width="14" height="96" fill="#9C6D38"/>')
    items = place(kale, 400, 300, 0.5) + place(carrots, 560, 285, 0.5) + place(tomatoes, 480, 300, 0.55)
    return svg(720, 440, sky + hills + rows + items + crate)


def favicon():
    return svg(64, 64, '<rect width="64" height="64" rx="14" fill="#2E7D32"/>'
               '<path d="M32 50 C32 34 38 22 52 14 C54 30 46 44 32 50Z" fill="#fff"/>'
               '<path d="M32 50 C32 38 26 30 14 26 C14 38 20 46 32 50Z" fill="#CFE8C8"/>'
               '<path d="M32 52 L32 30" stroke="#2E7D32" stroke-width="2.5" stroke-linecap="round"/>')


if __name__ == "__main__":
    for name, (bg, ground, art) in PRODUCE.items():
        (UPLOADS / f"seed-{name}.svg").write_text(product_svg(bg, ground, art), encoding="utf-8")
    (IMAGES / "hero.svg").write_text(hero(), encoding="utf-8")
    (IMAGES / "favicon.svg").write_text(favicon(), encoding="utf-8")
    print("wrote", len(PRODUCE), "produce images, hero.svg and favicon.svg")
